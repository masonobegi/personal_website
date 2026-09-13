import { cache } from "react";
import { USE_PG, getPool, readJson, writeJson, once } from "@/lib/db";
import { defaultContent } from "@/lib/defaultContent";
import { applyDefaultUpgrades } from "@/lib/contentUpgrades";

// -----------------------------------------------------------------------------
//  Store for editable site content (Content tab in the admin dashboard).
//  Stores a single document of admin overrides; getContent() deep-merges those
//  over the defaults so new default fields keep working after future updates.
// -----------------------------------------------------------------------------


function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, over) {
  if (over === undefined || over === null) return base;
  if (!isObj(over)) return over;
  const out = isObj(base) ? { ...base } : {};
  for (const k of Object.keys(over)) {
    const b = isObj(base) ? base[k] : undefined;
    out[k] = isObj(b) && isObj(over[k]) ? deepMerge(b, over[k]) : over[k];
  }
  return out;
}

// What the admin has actually changed, with everything still matching the
// code's defaults left out.
//
// The Content tab shows the merged document — defaults included — and used to
// save the whole thing back, so every default became a stored value as if
// someone had typed it. After that, improving the wording in the code never
// reached the live site again: the stored copy won, the deploy looked fine, and
// nothing said otherwise. That matters most for the regulated disclosure block,
// where new wording from compliance would simply not appear.
//
// Arrays are compared whole. deepMerge above replaces an array outright rather
// than merging item by item, so a partial array diff would quietly drop FAQ
// questions and service areas.
export function overridesOnly(value, base) {
  if (!isObj(value) || !isObj(base)) {
    // An empty string is a real choice — someone clearing a field — so it is
    // only dropped when the default is empty too.
    return JSON.stringify(value) === JSON.stringify(base) ? undefined : value;
  }
  const out = {};
  for (const k of Object.keys(value)) {
    const diff = overridesOnly(value[k], base[k]);
    if (diff !== undefined) out[k] = diff;
  }
  return Object.keys(out).length ? out : undefined;
}

function ensurePg() {
  return once("__olsContentReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS site_content (
        id         TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

async function rawGet() {
  if (USE_PG) {
    await ensurePg();
    const { rows } = await getPool().query(
      "SELECT data FROM site_content WHERE id = 'main'"
    );
    return rows[0]?.data || {};
  }
  return readJson("content.json", {});
}

async function rawSet(obj) {
  if (USE_PG) {
    await ensurePg();
    await getPool().query(
      `INSERT INTO site_content (id, data, updated_at)
       VALUES ('main', $1, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [obj]
    );
    return;
  }
  await writeJson("content.json", obj);
}

// Full, ready-to-render content (defaults + admin overrides).
// Falls back to defaults if the database is unreachable — this keeps the
// production BUILD working (Railway's DB isn't reachable during builds) and
// keeps the site up if the DB ever hiccups at runtime.
async function readContent() {
  let saved = {};
  try {
    saved = await rawGet();
  } catch (e) {
    console.error("[contentStore] DB unavailable, using default content:", e?.message);
    saved = {};
  }
  return applyDefaultUpgrades(deepMerge(defaultContent, saved), saved, defaultContent);
}

// Almost everything that renders asks for this — the layout, the header, the
// footer, the page itself — and it was a separate identical query every time,
// seven to thirteen per page. React's cache holds the answer for the length of
// one request and no longer, so nothing can go stale between requests.
export const getContent = cache(readContent);

// Persist the admin-provided content document.
export async function saveContent(obj) {
  await rawSet(obj);
  // Deliberately not the cached reader: if anything in this request had
  // already read the content, the cache would hand back what was there before
  // the write and the dashboard would show the save as having done nothing.
  return readContent();
}

// The admin's overrides ONLY, with no defaults merged in — what backups store,
// so a restore re-merges over whatever the code's defaults are at that time
// rather than freezing a copy of today's defaults into the database.
export async function getRawContent() {
  return rawGet();
}

// Site content is one document, so restoring it replaces every word of site
// copy at once. Before that happens we keep a copy of what was there, so an
// admin who replaces the wrong thing is not left with no way back.
export async function snapshotContent() {
  const current = await rawGet();
  if (USE_PG) {
    await ensurePg();
    await getPool().query(
      `INSERT INTO site_content (id, data, updated_at)
       VALUES ('main_prerestore', $1, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [current]
    );
  } else {
    await writeJson("content.prerestore.json", current);
  }
  return current;
}

// What the site copy looked like immediately before the last content restore,
// or null if no restore has replaced it.
export async function getContentSnapshot() {
  if (USE_PG) {
    await ensurePg();
    const { rows } = await getPool().query(
      "SELECT data FROM site_content WHERE id = 'main_prerestore'"
    );
    return rows[0]?.data || null;
  }
  const saved = await readJson("content.prerestore.json", null);
  return saved && Object.keys(saved).length ? saved : null;
}

// As saveArticleIfUnchanged, for the single site-content document. This is the
// one that matters most: the row is replaced whole, so losing the race loses
// every edit in it.
export async function saveContentIfUnchanged(next, snapshot) {
  if (USE_PG) {
    await ensurePg();
    const res = await getPool().query(
      `UPDATE site_content SET data = $1, updated_at = now()
        WHERE id = 'main' AND data = $2::jsonb`,
      [next, JSON.stringify(snapshot)]
    );
    return res.rowCount > 0;
  }
  const current = await readJson("content.json", {});
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) return false;
  await writeJson("content.json", next);
  return true;
}
