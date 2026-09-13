import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

// -----------------------------------------------------------------------------
//  Shared storage layer.
//  • PRODUCTION: Postgres (Railway injects DATABASE_URL). Survives redeploys.
//  • LOCAL DEV: JSON files under $DATA_DIR when DATABASE_URL is unset.
//  Both the pages store and the team store build on these helpers so they share
//  a single connection pool and the same seed/meta mechanism.
// -----------------------------------------------------------------------------

export const DATABASE_URL = process.env.DATABASE_URL;
export const USE_PG = Boolean(DATABASE_URL);

export const DATA_DIR_EXPLICIT = Boolean(process.env.DATA_DIR);
export const DATA_DIR =
  process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");

function pgSsl(url) {
  try {
    const host = new URL(url).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".railway.internal")
    ) {
      return false;
    }
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

const g = globalThis;

export function getPool() {
  if (!g.__olsPool) {
    g.__olsPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: pgSsl(DATABASE_URL),
      max: 5,
    });
    // An idle connection dropped by the database or by something in between
    // emits an error on the pool itself. With no listener, Node treats that as
    // an unhandled 'error' event and kills the process — taking the whole site
    // down over a connection the pool was about to discard anyway.
    g.__olsPool.on("error", (e) => {
      console.error("[db] idle client error:", e?.message || e);
    });
  }
  return g.__olsPool;
}

// Caches a one-time async setup (schema creation, seeding) per process — but
// NEVER caches a failure. A single connection blip at boot used to poison the
// cached promise for the life of the process, so a store stayed broken until
// the next deploy. On rejection the slot is cleared so the next request retries.
// Concurrent CREATE TABLE IF NOT EXISTS can also race in Postgres and raise
// duplicate_table/unique_violation; that means the table exists, so it is not
// an error worth failing on.
const BENIGN_PG_CODES = new Set(["23505", "42P07", "42710"]);

export function once(key, factory) {
  if (!g[key]) {
    g[key] = Promise.resolve()
      .then(factory)
      .catch((e) => {
        if (BENIGN_PG_CODES.has(e?.code)) return null;
        g[key] = null; // let the next caller try again
        throw e;
      });
  }
  return g[key];
}

// ---- JSON file helpers (local-dev fallback) --------------------------------

export async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(path.join(/*turbopackIgnore: true*/ DATA_DIR, file), "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(file, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const p = path.join(/*turbopackIgnore: true*/ DATA_DIR, file);
  // The scratch name has to be unique per write, not just per process. Two
  // requests saving the same file at once both wrote to one path, and whichever
  // renamed second found the file already gone and threw ENOENT — which is how
  // the one-time data upgrade kept failing at startup.
  const tmp = `${p}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  // Windows refuses to rename over a file another handle still has open, and
  // two requests saving at once do exactly that. The loser only has to wait a
  // moment. Elsewhere the rename is atomic and this retries nothing.
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, p);
      return;
    } catch (e) {
      if (e?.code !== "EPERM" && e?.code !== "EBUSY") throw e;
      if (attempt >= 5) {
        await fs.rm(tmp, { force: true });
        throw e;
      }
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
  }
}

// ---- Meta / one-time seed flags --------------------------------------------
// Used so we seed default content exactly once and never clobber later edits.

function ensurePgMeta() {
  return once("__olsMetaReady", () =>
    getPool().query(
      `CREATE TABLE IF NOT EXISTS app_meta (
         key   TEXT PRIMARY KEY,
         value TEXT
       );`
    )
  );
}

export async function getMeta(key) {
  if (USE_PG) {
    await ensurePgMeta();
    const { rows } = await getPool().query(
      "SELECT value FROM app_meta WHERE key = $1",
      [key]
    );
    return rows[0]?.value ?? null;
  }
  const meta = await readJson("meta.json", {});
  return meta[key] ?? null;
}

export async function setMeta(key, value) {
  if (USE_PG) {
    await ensurePgMeta();
    await getPool().query(
      `INSERT INTO app_meta (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, String(value)]
    );
    return;
  }
  const meta = await readJson("meta.json", {});
  meta[key] = String(value);
  await writeJson("meta.json", meta);
}

if (process.env.NODE_ENV === "production" && !USE_PG) {
  console.warn(
    "\n⚠️  [db] No DATABASE_URL set. Content is using the ephemeral JSON-file " +
      "fallback and WILL BE LOST on redeploy. Add a Postgres database in Railway.\n"
  );
}
