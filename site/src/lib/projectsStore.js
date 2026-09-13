import { cache } from "react";
import {
  USE_PG,
  getPool,
  readJson,
  writeJson,
  getMeta,
  setMeta,
  once,
} from "@/lib/db";
import { normalizeSlug } from "@/lib/slugs";
import { SEED_PROJECTS } from "@/lib/seedProjects";

// -----------------------------------------------------------------------------
//  Store for portfolio PROJECTS. Each project is keyed by slug and served at
//  /projects/<slug>. Projects group into free-text categories (e.g. "Client
//  Work", "Apps") and an optional subsection within a category. They carry a
//  photo gallery, tech tags, and links. Order is controlled by `order`.
// -----------------------------------------------------------------------------

export const RESERVED_PROJECT_SLUGS = new Set(["new", "admin", "api"]);

export function validateProjectSlug(slug) {
  if (!slug) return "A URL slug is required.";
  if (slug.length > 60) return "Slug must be 60 characters or fewer.";
  if (!/^[a-z0-9-]+$/.test(slug))
    return "Slug may only contain lowercase letters, numbers, and hyphens.";
  if (RESERVED_PROJECT_SLUGS.has(slug)) return `"${slug}" is reserved.`;
  return null;
}

// Allow only same-site media/paths or https links as image sources.
function cleanSrc(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("/") || s.startsWith("https://") || s.startsWith("data:image/")) return s.slice(0, 2000);
  return "";
}

function strList(v, max, cap) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, cap ?? 30).map((x) => x.slice(0, max ?? 60));
}

export function sanitizeProjectInput(input) {
  const slug = normalizeSlug(input.slug);
  const gallery = Array.isArray(input.gallery)
    ? input.gallery
        .map((g) => ({ src: cleanSrc(g?.src), caption: String(g?.caption || "").trim().slice(0, 400) }))
        .filter((g) => g.src)
        .slice(0, 40)
    : [];
  const long = Array.isArray(input.long)
    ? input.long.map((p) => String(p).trim()).filter(Boolean).slice(0, 20).map((p) => p.slice(0, 4000))
    : [];
  return {
    slug,
    title: String(input.title || "").trim().slice(0, 200),
    category: String(input.category || "").trim().slice(0, 80),
    subsection: String(input.subsection || "").trim().slice(0, 80),
    description: String(input.description || "").trim().slice(0, 600),
    long,
    tags: strList(input.tags, 40, 12),
    tools: strList(input.tools, 60, 30),
    image: cleanSrc(input.image),
    gallery,
    liveUrl: String(input.liveUrl || "").trim().slice(0, 600),
    liveLabel: String(input.liveLabel || "").trim().slice(0, 80),
    codeUrl: String(input.codeUrl || "").trim().slice(0, 600),
    status: String(input.status || "").trim().slice(0, 40),
    featured: input.featured === true,
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    published: input.published !== false,
  };
}

// ---- raw backend ops -------------------------------------------------------

function ensurePgSchema() {
  return once("__moProjectsReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS projects (
        slug        TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

async function rawGetAll() {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT data FROM projects ORDER BY sort_order ASC, created_at ASC");
    return rows.map((r) => r.data);
  }
  const list = await readJson("projects.json", []);
  return list.slice().sort(byOrder);
}

async function rawGet(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT data FROM projects WHERE slug = $1", [slug]);
    return rows[0]?.data || null;
  }
  const list = await readJson("projects.json", []);
  return list.find((p) => p.slug === slug) || null;
}

async function rawSave(project) {
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      `INSERT INTO projects (slug, data, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, now()), now())
       ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, sort_order = EXCLUDED.sort_order, updated_at = now()`,
      [project.slug, project, project.order ?? 0, project.createdAt || null]
    );
    return project;
  }
  const list = await readJson("projects.json", []);
  const idx = list.findIndex((p) => p.slug === project.slug);
  if (idx >= 0) list[idx] = project;
  else list.push(project);
  await writeJson("projects.json", list);
  return project;
}

async function rawDelete(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query("DELETE FROM projects WHERE slug = $1", [slug]);
    return res.rowCount > 0;
  }
  const list = await readJson("projects.json", []);
  const next = list.filter((p) => p.slug !== slug);
  await writeJson("projects.json", next);
  return list.length !== next.length;
}

// ---- one-time seed of Mason's real projects --------------------------------

async function doSeed() {
  if (await getMeta("seeded_projects_v1")) return;
  const existing = await rawGetAll();
  const have = new Set(existing.map((p) => p.slug));
  const now = new Date().toISOString();
  for (const p of SEED_PROJECTS) {
    if (have.has(p.slug)) continue;
    const clean = sanitizeProjectInput({ ...p, published: true });
    await rawSave({ ...clean, createdAt: now, updatedAt: now });
  }
  await setMeta("seeded_projects_v1", "1");
}

function ensureSeed() {
  return once("__moSeedProjects", doSeed);
}

// ---- public API ------------------------------------------------------------

export const getAllProjects = cache(async () => {
  await ensureSeed();
  return rawGetAll();
});

export async function getPublishedProjects() {
  await ensureSeed();
  return (await rawGetAll()).filter((p) => p.published !== false);
}

export async function getProject(slug) {
  await ensureSeed();
  return rawGet(slug);
}

export async function saveProject(project) {
  const now = new Date().toISOString();
  return rawSave({ createdAt: now, ...project, updatedAt: now });
}

export async function deleteProject(slug) {
  return rawDelete(slug);
}

// Group published projects into { category, subsections: [{ name, items }] }.
// Category order follows the lowest `order` value in each category.
export function groupProjects(projects) {
  const cats = new Map();
  for (const p of projects) {
    const cat = p.category || "Projects";
    if (!cats.has(cat)) cats.set(cat, { category: cat, minOrder: p.order ?? 0, subs: new Map() });
    const entry = cats.get(cat);
    entry.minOrder = Math.min(entry.minOrder, p.order ?? 0);
    const sub = p.subsection || "";
    if (!entry.subs.has(sub)) entry.subs.set(sub, []);
    entry.subs.get(sub).push(p);
  }
  return [...cats.values()]
    .sort((a, b) => a.minOrder - b.minOrder)
    .map((c) => ({
      category: c.category,
      subsections: [...c.subs.entries()].map(([name, items]) => ({ name, items })),
    }));
}
