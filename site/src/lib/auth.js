import crypto from "node:crypto";
import { cookies } from "next/headers";

// Very small shared-password auth for the admin dashboard.
// The only credential is ADMIN_PASSWORD. Once a visitor proves they know it,
// we hand them a signed cookie (HMAC) so we don't store the password anywhere.

export const SESSION_COOKIE = "mo_admin";

// How long a sign-in lasts. The token carries its own expiry, so an old cookie
// copied out of a browser stops working even if the cookie itself is kept.
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

const DEFAULT_PASSWORD = "changeme";

export function getAdminPassword() {
  // PLACEHOLDER default password. CHANGE via ADMIN_PASSWORD env var.
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

// True while the dashboard is still on the built-in password. Surfaced inside
// the dashboard (after sign-in) rather than on the sign-in page, so the site
// never tells a stranger what the password is.
export function usingDefaultPassword() {
  return !process.env.ADMIN_PASSWORD;
}

// The signing key for session cookies and download links.
//
// It must never fall back to a constant that lives in this repository: anyone
// who could read the source could then mint a valid admin cookie without
// knowing the password. In order of preference:
//   1. ADMIN_SESSION_SECRET  — set this; sessions then survive restarts.
//   2. derived from ADMIN_PASSWORD — stable across restarts, not guessable.
//   3. random per process    — safe, but everyone is signed out on redeploy
//                              and old download links stop resolving.
function sessionSecret() {
  const g = globalThis;
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.ADMIN_PASSWORD) {
    return crypto
      .createHash("sha256")
      .update(`mo-session-key-v1:${process.env.ADMIN_PASSWORD}`)
      .digest("hex");
  }
  if (!g.__olsEphemeralSecret) g.__olsEphemeralSecret = crypto.randomBytes(32).toString("hex");
  return g.__olsEphemeralSecret;
}

function sign(payload) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

// "<expiry seconds>.<nonce>.<signature>" — a fresh value for every sign-in, so
// two people signing in don't share one token and a leaked one can be outlived.
export function createSessionToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const nonce = crypto.randomBytes(12).toString("hex");
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d{1,12}$/.test(expires) || !/^[a-f0-9]{24}$/.test(nonce)) return false;
  if (Number(expires) * 1000 < Date.now()) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`${expires}.${nonce}`));
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// For API routes: true when the request carries a valid admin session.
export async function isAdminRequest() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

// HMAC-signs a short string (download links, unsubscribe-style tokens) with
// the same secret as the session cookie, so nothing extra needs configuring.
export function signValue(value) {
  return sign(String(value)).slice(0, 32);
}

export function verifySignedValue(value, signature) {
  const a = Buffer.from(signValue(value));
  const b = Buffer.from(String(signature || ""));
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkPassword(input) {
  // Hash both sides first: timingSafeEqual needs equal lengths, and comparing
  // raw strings would otherwise leak the password's length through which
  // attempts return early.
  const hash = (v) => crypto.createHash("sha256").update(String(v ?? "")).digest();
  try {
    return crypto.timingSafeEqual(hash(input), hash(getAdminPassword()));
  } catch {
    return false;
  }
}
