import { isAdminRequest } from "@/lib/auth";
import { getContent } from "@/lib/contentStore";
import { looksSpammy, isEmail, sendEmail, escapeHtml } from "@/lib/mailer";
import { getArticle } from "@/lib/articlesStore";
import { SITE_URL } from "@/lib/seo";
import { addComment, listComments, deleteComment, getComment, sanitizeCommentInput, nameAllowed } from "@/lib/commentsStore";

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
  // Note: x.email is deliberately never included — it stays server-side.
  const publicList = comments.map((x) => ({ id: x.id, name: x.name || "", body: x.body, isAdmin: !!x.isAdmin, createdAt: x.createdAt, parentId: x.parentId || "" }));
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
  const { name, body: text, email, parentId } = sanitizeCommentInput(body);
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  if (!text) return Response.json({ error: "Write something first." }, { status: 400 });
  if (email && !isEmail(email)) return Response.json({ error: "That email doesn't look right — fix it or leave it blank." }, { status: 400 });

  const admin = await isAdminRequest();

  // Bot checks (skip for a logged-in admin). Submitted-instantly + link/keyword
  // spam are the two strongest signals; the honeypot + throttle above catch the rest.
  if (!admin) {
    const elapsed = Number(body.elapsedMs);
    if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 1500) {
      return Response.json({ error: "That was too fast — try again." }, { status: 400 });
    }
    if (looksSpammy(text) || looksSpammy(name)) {
      return Response.json({ error: "That looked like spam and wasn't posted." }, { status: 400 });
    }
  }

  let finalName = name;
  if (admin) {
    const c = await getContent();
    finalName = c.siteName || "Admin"; // autofill, ignore submitted name
  } else if (name && !nameAllowed(name)) {
    return Response.json({ error: "That name isn't allowed — try another (or leave it blank)." }, { status: 400 });
  }

  // A reply points at a parent comment. Ignore a parentId that doesn't resolve
  // to a real comment on this same article — keeps threads from being forged.
  let parent = null;
  if (parentId) {
    parent = await getComment(parentId);
    if (!parent || parent.slug !== slug) parent = null;
  }

  const rec = await addComment({
    slug, name: finalName, body: text, isAdmin: admin,
    email, parentId: parent ? parent.id : "",
  });

  // Notify the parent's author, if they left an address and this isn't them
  // replying to their own comment. Never blocks (or fails) the post.
  if (parent?.email && isEmail(parent.email) && parent.email !== email) {
    try { await notifyReply({ parent, reply: rec }); } catch { /* non-fatal */ }
  }

  return Response.json({ ok: true, comment: { id: rec.id, name: rec.name, body: rec.body, isAdmin: rec.isAdmin, createdAt: rec.createdAt, parentId: rec.parentId || "" } });
}

// Emails the author of `parent` that their comment got a reply. The address is
// one they typed themselves; it is never shown to anyone else.
async function notifyReply({ parent, reply }) {
  const [article, c] = await Promise.all([
    getArticle(parent.slug).catch(() => null),
    getContent(),
  ]);
  const site = c.siteName || "the site";
  const title = article?.title || "an article";
  const url = `${SITE_URL}/library/${parent.slug}#comments`;
  const who = reply.isAdmin ? (reply.name || site) : (reply.name || "Someone");
  const subject = `${who} replied to your comment on ${site}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.6">
      <p>Hi ${escapeHtml(parent.name || "there")},</p>
      <p><strong>${escapeHtml(who)}</strong> replied to your comment on &ldquo;${escapeHtml(title)}&rdquo;:</p>
      <blockquote style="margin:0 0 1rem;padding:0.6rem 1rem;border-left:3px solid #ccc;color:#333;white-space:pre-wrap">${escapeHtml(reply.body)}</blockquote>
      <p><a href="${url}">Read it and reply on the site &rarr;</a></p>
      <p style="color:#888;font-size:0.85rem">You got this because you left your email when commenting. We only use it to tell you about replies.</p>
    </div>`;
  const text = `${who} replied to your comment on "${title}":\n\n${reply.body}\n\nRead it and reply: ${url}`;
  await sendEmail({ to: [parent.email], subject, html, text, fromName: site });
}

// DELETE /api/comments?id=... → admin only (moderation).
export async function DELETE(request) {
  if (!(await isAdminRequest())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  const ok = await deleteComment(id);
  return Response.json({ ok });
}
