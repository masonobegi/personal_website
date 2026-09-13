import { cache } from "react";
import {
  USE_PG,
  getPool,
  readJson,
  writeJson,
  getMeta,
  setMeta,
  once,
  DATA_DIR,
  DATA_DIR_EXPLICIT,
} from "@/lib/db";
import { normalizeSlug } from "@/lib/slugs";

// -----------------------------------------------------------------------------
//  Store for professional / segment pages (built-in + admin-created).
//  All pages live in the same table and are served at /<slug>. The three
//  built-in segments (nike, intel, healthcare) are seeded once so they appear
//  in the admin list and are fully editable.
// -----------------------------------------------------------------------------


// Slugs that collide with real app routes and can't be used by a page.
export const RESERVED_SLUGS = new Set([
  "about",
  "projects",
  "hobbies",
  "hire",
  "contact",
  "library",
  "admin",
  "privacy",
  "terms",
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "static",
  "public",
  "icon.svg",
  "go",
  "media",
]);

export { normalizeSlug };

export function validateSlug(slug) {
  if (!slug) return "A URL slug is required.";
  if (slug.length > 40) return "Slug must be 40 characters or fewer.";
  if (!/^[a-z0-9-]+$/.test(slug))
    return "Slug may only contain lowercase letters, numbers, and hyphens.";
  if (RESERVED_SLUGS.has(slug))
    return `"${slug}" is reserved by the site and can't be used.`;
  return null;
}

// Default wording for every label on a specialty page. These are what the
// admin form pre-fills, and what older pages (saved before a field existed)
// fall back to at render time — so adding fields never blanks a live page.
export const PAGE_LABEL_DEFAULTS = {
  heroTagline: "Enduring Wealth. Structured Decisions.",
  heroCtaLabel: "Begin a Private Conversation",
  serveEyebrow: "Who We Serve",
  successEyebrow: "The Complexity Beneath Success",
  questionsIntro: "The questions that remain are the ones that matter most:",
  approachEyebrow: "A More Structured Approach",
  relatedEyebrow: "From the Library",
  relatedTitle: "Related insights",
};

// Keeps a text field optional-but-defaultable: undefined stays undefined (so
// render falls back to the default), anything else is trimmed and capped.
function optText(value, max) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().slice(0, max);
}

// Maximum lengths for page fields. Generous on purpose: these used to be tight
// enough that a long paragraph was silently cut off mid-word on the live page
// (the Intel hero ended "…family wealth, and le"). The dashboard enforces the
// same limits in the form, so nothing is ever cut without the admin seeing it.
export const PAGE_LIMITS = {
  heroTitle: 200,
  heroSub: 2000,
  serveLine: 600,
  successLine: 600,
  questionsIntro: 400,
  seoTitle: 120,
  seoDescription: 320,
};

export function sanitizePageInput(input) {
  const slug = normalizeSlug(input.slug);
  const questions = Array.isArray(input.questions)
    ? input.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 12)
    : [];
  // Freeform sections: heading + body, plus an optional "read more" link that
  // can point anywhere (another page on the site, or an outside URL).
  const blocks = Array.isArray(input.blocks)
    ? input.blocks
        .map((b) => ({
          heading: String(b.heading || "").trim().slice(0, 200),
          body: String(b.body || "").trim().slice(0, 10000),
          linkLabel: String(b.linkLabel || "").trim().slice(0, 80),
          linkHref: String(b.linkHref || "").trim().slice(0, 600),
        }))
        .filter((b) => b.heading || b.body)
        .slice(0, 40)
    : [];

  return {
    slug,
    audience: String(input.audience || "").trim().slice(0, 120),
    heroEyebrow: optText(input.heroEyebrow, 120),
    heroTitle: String(input.heroTitle || "").trim().slice(0, PAGE_LIMITS.heroTitle),
    heroTagline: optText(input.heroTagline, 200),
    heroSub: String(input.heroSub || "").trim().slice(0, PAGE_LIMITS.heroSub),
    heroCtaLabel: optText(input.heroCtaLabel, 80),
    serveEyebrow: optText(input.serveEyebrow, 120),
    serveLine: String(input.serveLine || "").trim().slice(0, PAGE_LIMITS.serveLine),
    successEyebrow: optText(input.successEyebrow, 120),
    successLine: String(input.successLine || "").trim().slice(0, PAGE_LIMITS.successLine),
    questionsIntro: optText(input.questionsIntro, PAGE_LIMITS.questionsIntro),
    questions,
    blocks,
    // What search engines show for this page. Blank = a default written for
    // the page (see lib/specialtySeo).
    seoTitle: String(input.seoTitle || "").trim().slice(0, PAGE_LIMITS.seoTitle),
    seoDescription: String(input.seoDescription || "").trim().slice(0, PAGE_LIMITS.seoDescription),
    // "A More Structured Approach" band (shared, editable in Content tab).
    approachEyebrow: optText(input.approachEyebrow, 120),
    showApproach: input.showApproach !== false,
    // Related Library articles, pulled in by tag.
    relatedTag: String(input.relatedTag || "").trim().slice(0, 40),
    relatedEyebrow: optText(input.relatedEyebrow, 120),
    relatedTitle: optText(input.relatedTitle, 200),
    published: input.published !== false,
  };
}

// ---- raw backend ops (no seeding) ------------------------------------------

function ensurePgSchema() {
  return once("__olsPagesReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS custom_pages (
        slug        TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

async function rawGetAll() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data FROM custom_pages ORDER BY updated_at DESC"
    );
    return rows.map((r) => r.data);
  }
  return readJson("pages.json", []);
}

async function rawGet(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data FROM custom_pages WHERE slug = $1",
      [slug]
    );
    return rows[0]?.data || null;
  }
  const list = await readJson("pages.json", []);
  return list.find((p) => p.slug === slug) || null;
}

async function rawSave(page) {
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      `INSERT INTO custom_pages (slug, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [page.slug, page]
    );
    return page;
  }
  const list = await readJson("pages.json", []);
  const idx = list.findIndex((p) => p.slug === page.slug);
  // Replaces, it does not patch — callers pass a complete record. The Postgres
  // path has always replaced the whole row, and this one quietly merged, so a
  // field cleared in the dashboard came back on the local fallback and not in
  // production. The path that gets less use was the one that behaved
  // differently.
  if (idx >= 0) list[idx] = page;
  else list.push(page);
  await writeJson("pages.json", list);
  return page;
}

async function rawDelete(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query(
      "DELETE FROM custom_pages WHERE slug = $1",
      [slug]
    );
    return res.rowCount > 0;
  }
  const list = await readJson("pages.json", []);
  const next = list.filter((p) => p.slug !== slug);
  await writeJson("pages.json", next);
  return list.length !== next.length;
}

// ---- seed --------------------------------
// A personal site ships with no pre-made hidden pages; you create them in the
// admin (Pages tab).
async function doSeed() {
  return;
}

function ensureSeed() {
  return once("__moSeedPages", doSeed);
}

// ---- public API ------------------------------------------------------------

// Read several times per render (the footer, the page, the structured data),
// so the answer is held for the length of one request.
export const getAllPages = cache(async () => {
  await ensureSeed();
  return rawGetAll();
});

export async function getPage(slug) {
  await ensureSeed();
  return rawGet(slug);
}

export async function savePage(page) {
  await ensureSeed();
  return rawSave(page);
}

export async function deletePage(slug) {
  await ensureSeed();
  return rawDelete(slug);
}

export async function getStorageStatus() {
  if (USE_PG) {
    let connected = false;
    let error = null;
    try {
      await ensurePgSchema();
      await getPool().query("SELECT 1");
      connected = true;
    } catch (e) {
      error = e?.message || "Could not connect to the database.";
    }
    return { mode: "postgres", persistent: true, connected, error };
  }
  return {
    mode: "file",
    persistent: DATA_DIR_EXPLICIT && !DATA_DIR.startsWith(process.cwd()),
    connected: true,
    dataDir: DATA_DIR,
    production: process.env.NODE_ENV === "production",
  };
}
