import { USE_PG, getPool, readJson, writeJson, once } from "@/lib/db";

// -----------------------------------------------------------------------------
//  Permanent redirects, created automatically when an article's web address is
//  changed in the dashboard. The old URL keeps working — for anyone holding a
//  link from LinkedIn or email, and for Google, which moves the old URL's
//  standing to the new one.
//
//  Paths are site-relative ("/library/old-slug"). Chains are flattened on
//  write, so a visitor is never bounced more than once.
// -----------------------------------------------------------------------------


function ensurePgSchema() {
  return once("__olsRedirectsReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS redirects (
        from_path   TEXT PRIMARY KEY,
        to_path     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

export async function getAllRedirects() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT from_path, to_path, created_at FROM redirects ORDER BY created_at DESC"
    );
    return rows.map((r) => ({ from: r.from_path, to: r.to_path, createdAt: r.created_at }));
  }
  return readJson("redirects.json", []);
}

export async function getRedirect(fromPath) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT to_path FROM redirects WHERE from_path = $1",
      [fromPath]
    );
    return rows[0]?.to_path || null;
  }
  const list = await readJson("redirects.json", []);
  return list.find((r) => r.from === fromPath)?.to || null;
}

// Adds from → to, re-pointing any existing redirect that led to `from` so it
// goes straight to `to`, and dropping any redirect that would shadow `to`
// (an address that has been reused).
export async function addRedirect(from, to) {
  if (!from || !to || from === to) return;
  if (USE_PG) {
    await ensurePgSchema();
    const pool = getPool();
    await pool.query("DELETE FROM redirects WHERE from_path = $1", [to]);
    await pool.query("UPDATE redirects SET to_path = $1 WHERE to_path = $2", [to, from]);
    await pool.query(
      `INSERT INTO redirects (from_path, to_path) VALUES ($1, $2)
       ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path`,
      [from, to]
    );
    return;
  }
  let list = await readJson("redirects.json", []);
  list = list
    .filter((r) => r.from !== to && r.from !== from)
    .map((r) => (r.to === from ? { ...r, to } : r));
  list.unshift({ from, to, createdAt: new Date().toISOString() });
  await writeJson("redirects.json", list);
}

// A path that's now a live page again shouldn't redirect away from itself.
export async function removeRedirect(from) {
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query("DELETE FROM redirects WHERE from_path = $1", [from]);
    return;
  }
  const list = await readJson("redirects.json", []);
  await writeJson("redirects.json", list.filter((r) => r.from !== from));
}

// Every redirect that leads to a page which no longer exists. Deleting an
// article used to leave its old addresses bouncing visitors into a missing
// page, which is worse than the missing page on its own — a search engine
// follows the redirect and then finds nothing at the end of it.
export async function removeRedirectsTo(to) {
  if (!to) return;
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query("DELETE FROM redirects WHERE to_path = $1", [to]);
    return;
  }
  const list = await readJson("redirects.json", []);
  await writeJson("redirects.json", list.filter((r) => r.to !== to));
}

// Puts a redirect back from a backup without disturbing anything live.
//
// A restore used to run these through addRedirect, which deletes and rewrites
// neighbouring rows to keep chains flat. Replaying an old backup therefore
// re-pointed current redirects at addresses that had since moved, leaving
// permanent redirects into missing pages — and a permanent redirect is the
// hardest kind to take back, because browsers and search engines remember it.
//
// This only fills gaps: an address that already redirects somewhere keeps
// doing so, and a redirect that would point at itself is dropped.
export async function restoreRedirect(from, to, createdAt) {
  if (!from || !to || from === to) return false;
  const existing = await getRedirect(from);
  if (existing) return false; // live state wins

  // If the destination has itself moved on since the backup, follow it, so the
  // restored row lands where the address actually is now.
  const onward = await getRedirect(to);
  const target = onward && onward !== from ? onward : to;
  if (target === from) return false;

  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      `INSERT INTO redirects (from_path, to_path, created_at)
       VALUES ($1, $2, COALESCE($3::timestamptz, now()))
       ON CONFLICT (from_path) DO NOTHING`,
      [from, target, createdAt || null]
    );
    return true;
  }
  const list = await readJson("redirects.json", []);
  if (list.some((r) => r.from === from)) return false;
  list.unshift({ from, to: target, createdAt: createdAt || new Date().toISOString() });
  await writeJson("redirects.json", list);
  return true;
}
