import { USE_PG, getPool, readJson, writeJson, once } from "@/lib/db";

// -----------------------------------------------------------------------------
//  Comments on Library articles. Persisted in Postgres (JSON-file fallback), so
//  they survive redeploys. Anyone may post; a name is optional (blank = shown as
//  "Anonymous"). Admin comments are flagged verified.
// -----------------------------------------------------------------------------

// Names containing any of these (letters/digits only, case-insensitive) are
// rejected: slurs/offensive terms, plus impersonation of the site owner / staff.
const BLOCKED = [
  "hitler", "nazi", "stalin", "kkk",
  "nigger", "nigga", "faggot", "kike", "spic", "chink", "wetback", "retard", "tranny",
  "fuck", "shit", "bitch", "cunt", "whore", "slut", "rape", "cock", "dick", "pussy", "penis", "vagina", "poop",
  "admin", "verified", "official", "moderator", "masonobegi", "masonobgi",
];

export function nameAllowed(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return true; // empty is fine (Anonymous)
  return !BLOCKED.some((w) => n.includes(w));
}

export function sanitizeCommentInput(input) {
  const name = String(input.name || "").trim().slice(0, 40);
  const body = String(input.body || "").trim().slice(0, 2000);
  // Optional: an address to notify when this comment gets a reply, and the id
  // of the comment being replied to. Both are validated by the caller.
  const email = String(input.email || "").trim().slice(0, 254);
  const parentId = String(input.parentId || "").trim().slice(0, 40);
  return { name, body, email, parentId };
}

function ensurePgSchema() {
  return once("__moCommentsReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS comments (
        id         TEXT PRIMARY KEY,
        slug       TEXT NOT NULL,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS comments_slug_idx ON comments (slug, created_at);
    `));
}

const newId = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function addComment({ slug, name, body, isAdmin, email, parentId }) {
  const rec = {
    id: newId(), slug, name: name || "", body, isAdmin: !!isAdmin,
    // Kept server-side only — never returned by the public listing.
    ...(email ? { email } : {}),
    ...(parentId ? { parentId } : {}),
    createdAt: new Date().toISOString(),
  };
  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      "INSERT INTO comments (id, slug, data, created_at) VALUES ($1, $2, $3, now())",
      [rec.id, slug, rec]
    );
    return rec;
  }
  const list = await readJson("comments.json", []);
  list.push(rec);
  await writeJson("comments.json", list);
  return rec;
}

export async function listComments(slug) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT data FROM comments WHERE slug = $1 ORDER BY created_at ASC",
      [slug]
    );
    return rows.map((r) => r.data);
  }
  const list = await readJson("comments.json", []);
  return list.filter((c) => c.slug === slug).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

// One comment by id, with its private fields (email/parentId) — for the API to
// look up the parent author when a reply comes in. Never sent to the browser.
export async function getComment(id) {
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query("SELECT data FROM comments WHERE id = $1", [id]);
    return rows[0]?.data || null;
  }
  const list = await readJson("comments.json", []);
  return list.find((c) => c.id === id) || null;
}

export async function deleteComment(id) {
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query("DELETE FROM comments WHERE id = $1", [id]);
    return res.rowCount > 0;
  }
  const list = await readJson("comments.json", []);
  const next = list.filter((c) => c.id !== id);
  await writeJson("comments.json", next);
  return next.length !== list.length;
}
