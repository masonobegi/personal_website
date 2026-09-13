import { cache } from "react";
import { USE_PG, getPool, readJson, writeJson, once } from "@/lib/db";
import { RESERVED_SLUGS } from "@/lib/pagesStore";
import { normalizeSlug, suggestSlug } from "@/lib/slugs";

export { suggestSlug, isTruncatedSlug } from "@/lib/slugs";

// -----------------------------------------------------------------------------
//  Store for Library (blog) articles. DB-backed (Postgres) in production so
//  articles persist across redeploys. Falls back to a JSON file locally.
//
//  Every article has a KIND:
//    written  an article composed (or imported from Word/PDF) in the dashboard
//    pdf      a white paper: the full text as an article, plus the PDF download
//    linked   an article published elsewhere (previewed here, or linked out)
//    video    a LinkedIn video: a thumbnail card that opens the post
//
//  An article body is an ordered list of BLOCKS so the admin controls exactly
//  where everything sits:
//    { type: "text",    text }                         paragraphs, lists, links
//    { type: "heading", level: 2|3, text }              section headings
//    { type: "image",   src, caption, width, height }   figures
//    { type: "video",   url, title, thumbnail }         link card to a video
//
//  Images and PDFs are stored in the media store; records hold /media/... URLs.
// -----------------------------------------------------------------------------


export const ARTICLE_KINDS = ["written", "pdf", "linked", "video"];

// Reserve /library itself plus the app routes already reserved for pages.
const RESERVED = new Set([...RESERVED_SLUGS, "library"]);

export function validateArticleSlug(slug) {
  if (!slug) return "A web address is required.";
  if (slug.length > 80) return "The web address must be 80 characters or fewer.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return "The web address may only contain lowercase letters, numbers, and single hyphens.";
  if (RESERVED.has(slug))
    return `"${slug}" is reserved by the site and can't be used.`;
  return null;
}

// The article's kind, including for records saved before `kind` existed.
export function articleKind(a) {
  if (ARTICLE_KINDS.includes(a?.kind)) return a.kind;
  if (a?.pdf) return "pdf";
  if (a?.externalUrl) return "linked";
  return "written";
}

// A page that exists only to point somewhere else: a link to an article
// published elsewhere, or a video card. There is nothing on it worth a search
// listing — a couple of hundred words of teaser and a link away — so it stays
// out of search results and out of the sitemap. Kept next to opensExternally,
// which answers the different question of where the Library card should go,
// and defined once because the page and the sitemap had already drifted apart
// on it.
export function isPointerArticle(a) {
  const kind = articleKind(a);
  return kind === "linked" || kind === "video";
}

// True when the Library card should open another site instead of our page.
export function opensExternally(a) {
  const kind = articleKind(a);
  if (kind === "video") return Boolean(a.videoUrl);
  return kind === "linked" && a.externalMode === "link" && Boolean(a.externalUrl);
}

// Plain text of the body, for search snippets and word counts.
export function bodyText(a) {
  return (a?.blocks || [])
    .filter((b) => b.type === "text" || b.type === "heading")
    .map((b) => b.text || "")
    .join("\n\n");
}

// Somewhere safe to point an <img> or a link. Legacy data URLs are still
// accepted (the media migration converts them), anything else is dropped.
function cleanSrc(v, { allowPdf = false } = {}) {
  if (typeof v !== "string" || !v) return "";
  if (/^\/media\/[a-f0-9]{32}p?\.[a-z0-9]{2,5}$/.test(v)) return v;
  if (/^\/(?!\/)[\w./-]+$/.test(v)) return v; // committed /public files
  if (/^https:\/\/[^\s"'<>]+$/i.test(v) && v.length <= 800) return v;
  if (allowPdf && /^data:application\/pdf;base64,/i.test(v) && v.length <= 30_000_000) return v;
  if (/^data:image\/[a-z+.-]+;base64,/i.test(v) && v.length <= 3_500_000) return v;
  return "";
}

function cleanUrl(v) {
  const s = String(v || "").trim().slice(0, 800);
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => {
      if (b?.type === "image") {
        return {
          type: "image",
          src: cleanSrc(b.src),
          caption: String(b.caption || "").trim().slice(0, 300),
          alt: String(b.alt || "").trim().slice(0, 300),
          width: toInt(b.width),
          height: toInt(b.height),
        };
      }
      if (b?.type === "heading") {
        return {
          type: "heading",
          level: Number(b.level) === 3 ? 3 : 2,
          text: String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 300),
        };
      }
      if (b?.type === "video") {
        return {
          type: "video",
          url: cleanUrl(b.url),
          title: String(b.title || "").trim().slice(0, 200),
          thumbnail: cleanSrc(b.thumbnail),
        };
      }
      return { type: "text", text: String(b?.text || "").slice(0, 40000) };
    })
    .filter((b) =>
      b.type === "image" ? b.src : b.type === "video" ? b.url : b.text.trim()
    )
    .slice(0, 300);
}

// Accepts an array or a comma-separated string; returns a clean array of tags.
export function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input || "").split(",");
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const t = String(raw).trim().slice(0, 40);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out.slice(0, 20);
}

export function sanitizeArticleInput(input) {
  const kind = ARTICLE_KINDS.includes(input.kind) ? input.kind : articleKind(input);
  const externalUrl = kind === "linked" ? cleanUrl(input.externalUrl) : "";
  // "embed" previews the source on our page; "link" sends the reader straight
  // to the original. Only meaningful for linked articles.
  const externalMode = input.externalMode === "link" ? "link" : "embed";
  const slug = normalizeSlug(input.slug) || suggestSlug(input.title);
  // A written article may also offer the PDF it came from. Tying the file to
  // the "white paper" kind meant importing a PDF into an article the admin had
  // deliberately written silently reclassified it — or dropped the file.
  const pdf = kind === "video" || kind === "linked" ? "" : cleanSrc(input.pdf, { allowPdf: true });

  return {
    slug: slug.slice(0, 80).replace(/-+$/, ""),
    kind,
    title: String(input.title || "").trim().slice(0, 300),
    author: String(input.author || "").trim().slice(0, 120),
    date: String(input.date || "").trim().slice(0, 60),
    // "Last reviewed" date shown on the article and in its structured data.
    reviewedDate: String(input.reviewedDate || "").trim().slice(0, 60),
    excerpt: String(input.excerpt || "").trim().slice(0, 1200),
    // Optional overrides for what search engines show. Blank = derived from
    // the title and excerpt.
    seoTitle: String(input.seoTitle || "").trim().slice(0, 120),
    seoDescription: String(input.seoDescription || "").trim().slice(0, 320),
    // "Sources and documents reviewed", and the piece's own regulatory
    // disclosures — both shown in small print at the end of the article.
    sources: String(input.sources || "").trim().slice(0, 6000),
    disclosures: String(input.disclosures || "").trim().slice(0, 8000),
    tags: parseTags(input.tags),
    thumbnail: cleanSrc(input.thumbnail) || null,
    externalUrl,
    externalMode,
    videoUrl: kind === "video" ? cleanUrl(input.videoUrl) : "",
    pdf: pdf || null,
    pdfName: pdf ? String(input.pdfName || "").trim().slice(0, 200) : "",
    pdfSize: pdf ? toInt(input.pdfSize) || null : null,
    blocks: kind === "video" ? [] : sanitizeBlocks(input.blocks),
    published: input.published !== false,
  };
}

function ensurePgSchema() {
  return once("__olsArticlesReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS articles (
        slug        TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

async function rawGetAll() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data FROM articles ORDER BY created_at DESC"
    );
    return rows.map((r) => r.data);
  }
  const list = await readJson("articles.json", []);
  // newest first by createdAt
  return [...list].sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

async function rawGet(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data FROM articles WHERE slug = $1",
      [slug]
    );
    return rows[0]?.data || null;
  }
  const list = await readJson("articles.json", []);
  return list.find((a) => a.slug === slug) || null;
}

async function rawSave(article) {
  if (USE_PG) {
    await ensurePgSchema();
    // created_at mirrors the article's own createdAt so the list order
    // survives a rename or a restore from backup.
    await getPool().query(
      `INSERT INTO articles (slug, data, created_at, updated_at)
       VALUES ($1, $2, COALESCE($3::timestamptz, now()), now())
       ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [article.slug, article, article.createdAt || null]
    );
    return article;
  }
  const list = await readJson("articles.json", []);
  const idx = list.findIndex((a) => a.slug === article.slug);
  if (idx >= 0) list[idx] = article;
  else list.push(article);
  await writeJson("articles.json", list);
  return article;
}

async function rawDelete(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query(
      "DELETE FROM articles WHERE slug = $1",
      [slug]
    );
    return res.rowCount > 0;
  }
  const list = await readJson("articles.json", []);
  const next = list.filter((a) => a.slug !== slug);
  await writeJson("articles.json", next);
  return list.length !== next.length;
}

// ---- public API ----

// includeDrafts=false → only published (for the public site).
// Cached for the length of one request. The Library page, an article page and
// the specialty pages each read the whole list more than once while rendering,
// and it was a fresh query every time. Keyed on the argument, so the admin's
// includeDrafts read never shares an answer with a public one.
const readAll = cache(async (includeDrafts) => {
  const all = await rawGetAll();
  return includeDrafts ? all : all.filter((a) => a.published);
});

export async function getAllArticles({ includeDrafts = false } = {}) {
  return readAll(Boolean(includeDrafts));
}

export const getArticle = cache(async (slug) => rawGet(slug));

export async function saveArticle(article) {
  return rawSave(article);
}

export async function deleteArticle(slug) {
  return rawDelete(slug);
}

// Writes an article only if it still looks exactly as it did when it was read.
// The startup migration reads every record and writes it back; without this, a
// save made from the dashboard in that window is silently reverted.
// Returns false when the record changed underneath, and the caller leaves it.
export async function saveArticleIfUnchanged(article, snapshot) {
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query(
      `UPDATE articles SET data = $2, updated_at = now()
        WHERE slug = $1 AND data = $3::jsonb`,
      [article.slug, article, JSON.stringify(snapshot)]
    );
    return res.rowCount > 0;
  }
  const list = await readJson("articles.json", []);
  const idx = list.findIndex((a) => a.slug === article.slug);
  if (idx < 0 || JSON.stringify(list[idx]) !== JSON.stringify(snapshot)) return false;
  list[idx] = article;
  await writeJson("articles.json", list);
  return true;
}
