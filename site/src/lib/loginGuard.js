import crypto from "node:crypto";

// Protection for the one thing standing between the internet and the whole
// dashboard: a single shared password.
//
// The previous guard counted attempts per address and nothing else, which
// leaves two ways through. A spread-out attack from many addresses never hits
// a per-address limit at all. And the table it counted in was emptied wholesale
// once it grew past five thousand entries, so an attacker could wipe everyone's
// counters — their own included — just by touching enough addresses first.
//
// What is here instead:
//   * failures per address, with the wait growing each time
//   * a count across all addresses, so a spread-out attack slows down too
//   * oldest entries evicted when the table is full, never the whole table
//   * a successful sign-in clears that address
//
// All of it lives in memory, which is right for a single server: nothing to
// configure, and a restart only ever forgets, never lets someone in.

const g = globalThis;

const MAX_TRACKED = 20_000;
const WINDOW_MS = 15 * 60 * 1000;

// How long an address waits after each failure. The first few are free so a
// mistyped password is not punished; after that it climbs fast.
const LOCKOUTS = [0, 0, 0, 1_000, 5_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
const MAX_LOCKOUT = 60 * 60_000;

// Failures across every address before everyone is slowed down. A spread-out
// attack is the only thing that reaches this; it delays rather than refuses, so
// it cannot be used to lock the real admin out.
const GLOBAL_THRESHOLD = 120;
const GLOBAL_DELAY_MS = 2_000;

function store() {
  if (!g.__olsLoginGuard) {
    g.__olsLoginGuard = { byIp: new Map(), recent: [] };
  }
  return g.__olsLoginGuard;
}

function prune(state, now) {
  state.recent = state.recent.filter((t) => now - t < WINDOW_MS);
  if (state.byIp.size <= MAX_TRACKED) return;
  // Evict the least recently seen, not everything. Map preserves insertion
  // order and every touch re-inserts, so the front is the oldest.
  const overflow = state.byIp.size - MAX_TRACKED;
  let removed = 0;
  for (const key of state.byIp.keys()) {
    state.byIp.delete(key);
    if (++removed >= overflow) break;
  }
}

// How long this address must wait before another attempt is worth making.
// 0 means go ahead.
export function loginWaitMs(ip, now = Date.now()) {
  const state = store();
  prune(state, now);
  const entry = state.byIp.get(ip);
  if (!entry) return 0;
  // Forget an address only once it is both idle AND out of its lockout. The
  // idle sweep used to run first, so a half-hour lockout was cancelled after
  // fifteen minutes and the failure count went back to zero with it — which
  // handed the attacker the free attempts at the start of the ladder again,
  // so the wait never actually grew.
  if (now > entry.until && now - entry.last > WINDOW_MS) {
    state.byIp.delete(ip);
    return 0;
  }
  const wait = entry.until - now;
  return wait > 0 ? wait : 0;
}

// True when the site as a whole is under a spread-out attack right now.
export function underBroadAttack(now = Date.now()) {
  const state = store();
  prune(state, now);
  return state.recent.length >= GLOBAL_THRESHOLD;
}

export function recordFailure(ip, now = Date.now()) {
  const state = store();
  prune(state, now);
  const entry = state.byIp.get(ip) || { fails: 0, last: now, until: 0 };
  entry.fails += 1;
  entry.last = now;
  const step = LOCKOUTS[Math.min(entry.fails, LOCKOUTS.length - 1)];
  entry.until = now + Math.min(step, MAX_LOCKOUT);
  state.byIp.delete(ip); // re-insert so it moves to the back for eviction
  state.byIp.set(ip, entry);
  state.recent.push(now);
  return entry;
}

export function recordSuccess(ip) {
  const state = store();
  state.byIp.delete(ip);
}

// Hides whether a wrong password was rejected quickly or slowly, and makes a
// spread-out attack pay for every single guess.
export function attackDelay(now = Date.now()) {
  return underBroadAttack(now) ? GLOBAL_DELAY_MS : 0;
}

export function sleep(ms) {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

// ---- Optional second factor --------------------------------------------------
//
// Set ADMIN_TOTP_SECRET (a base32 secret from any authenticator app) and the
// dashboard asks for a six-digit code as well as the password. Knowing the
// password alone is then not enough, which is the single biggest improvement
// available to a shared-password sign-in. Unset, nothing changes.

export function totpEnabled() {
  return Boolean(process.env.ADMIN_TOTP_SECRET);
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

// Accepts the current code and the one either side of it, which covers a clock
// that is up to thirty seconds out.
export function verifyTotp(input, now = Date.now()) {
  if (!totpEnabled()) return true;
  const code = String(input || "").replace(/\D/g, "");
  if (code.length !== 6) return false;
  const secret = base32Decode(process.env.ADMIN_TOTP_SECRET);
  if (!secret.length) return false;
  const counter = Math.floor(now / 1000 / 30);
  for (const step of [-1, 0, 1]) {
    const expected = totpAt(secret, counter + step);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
