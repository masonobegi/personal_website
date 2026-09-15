import { isAdminRequest } from "@/lib/auth";
import { getContent } from "@/lib/contentStore";
import { addComment, listComments, deleteComment, sanitizeCommentInput, nameAllowed } from "@/lib/commentsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Light per-IP throttle so the public endpoint can't be flooded.
const HITS = (globalThis.__moCommentHits ||= new Map());
const WINDOW = 60_000;
const MAX_PER_WINDOW = 6;
function throttled(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= MAX_PER_WINDOW) { HITS.set(ip, arr); return true; }
  arr.push(now);
  HITS.set(ip, arr);
  return false;
}
const ipOf = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

// GET /api/comments?slug=... → public list, plus whether the viewer is admin.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  const [comments, viewerIsAdmin, c] = await Promise.all([
    listComments(slug).catch(() => []),
    isAdminRequest(),
    getContent(),
  ]);
  const publicList = comments.map((x) => ({ id: x.id, name: x.name || "", body: x.body, isAdmin: !!x.isAdmin, createdAt: x.createdAt }));
  return Response.json({ comments: publicList, viewerIsAdmin, adminName: c.siteName || "" });
}

// POST /api/comments → create. Anyone may post; name optional.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (String(body.website || "").trim()) return Response.json({ ok: true, skipped: true });

  if (throttled(ipOf(request))) return Response.json({ error: "You're commenting too fast — wait a moment." }, { status: 429 });

  const slug = String(body.slug || "").trim().slice(0, 80);
  const { name, body: text } = sanitizeCommentInput(body);
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  if (!text) return Response.json({ error: "Write something first." }, { status: 400 });

  const admin = await isAdminRequest();
  let finalName = name;
  if (admin) {
    const c = await getContent();
    finalName = c.siteName || "Admin"; // autofill, ignore submitted name
  } else if (name && !nameAllowed(name)) {
    return Response.json({ error: "That name isn't allowed — try another (or leave it blank)." }, { status: 400 });
  }

  const rec = await addComment({ slug, name: finalName, body: text, isAdmin: admin });
  return Response.json({ ok: true, comment: { id: rec.id, name: rec.name, body: rec.body, isAdmin: rec.isAdmin, createdAt: rec.createdAt } });
}

// DELETE /api/comments?id=... → admin only (moderation).
export async function DELETE(request) {
  if (!(await isAdminRequest())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  const ok = await deleteComment(id);
  return Response.json({ ok });
}
