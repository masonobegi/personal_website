import { Resend } from "resend";

// -----------------------------------------------------------------------------
//  Email notifications (via Resend) for form submissions.
//
//  Until a real RESEND_API_KEY is set, nothing is sent — but every submission
//  is still saved to the Inbox, so no inquiry is ever lost.
// -----------------------------------------------------------------------------

const PLACEHOLDER_PREFIX = "re_PLACEHOLDER";

export function isEmail(v) {
  return typeof v === "string" && v.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v);
}

// A real, deliverable address — not the seeded "…@oswegolegacy.example"
// placeholders or anything marked PLACEHOLDER.
export function isDeliverable(v) {
  return isEmail(v) && !/\.example$|placeholder/i.test(v);
}

// The firm inbox(es) from CONTACT_TO_EMAIL (comma-separated allowed).
export function firmInbox() {
  return String(process.env.CONTACT_TO_EMAIL || "")
    .split(",")
    .map((e) => e.trim())
    .filter(isDeliverable);
}

export function emailConfigured() {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key) && !key.startsWith(PLACEHOLDER_PREFIX);
}

export function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Returns { status: "sent" | "not-configured" | "no-recipients" | "failed" }.
export async function sendEmail({ to, subject, html, text, replyTo, fromName }) {
  const recipients = [...new Set((to || []).filter(isDeliverable))];
  if (!recipients.length) return { status: "no-recipients" };
  if (!emailConfigured()) {
    // Deliberately without the subject: it carries the sender's name, and
    // application logs are not the place for it. The Inbox already records
    // that this one was never sent.
    console.log("[mail] No live RESEND_API_KEY; not sent (saved to the Inbox).");
    return { status: "not-configured" };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";
    const { error } = await resend.emails.send({
      from: `${fromName || "Oswego Legacy Partners"} <${from}>`,
      to: recipients.slice(0, 50),
      ...(replyTo && isEmail(replyTo) ? { replyTo } : {}),
      subject: String(subject).replace(/[\r\n]+/g, " ").slice(0, 200),
      html,
      ...(text ? { text } : {}),
    });
    if (error) {
      console.error("[mail] Resend error:", error);
      return { status: "failed", error: error.message || String(error) };
    }
    return { status: "sent", to: recipients };
  } catch (e) {
    console.error("[mail] send failed:", e);
    return { status: "failed", error: e?.message };
  }
}

// ---- abuse protection for the public forms ----------------------------------
//
// Ads bring bots. Three cheap filters that real visitors never notice:
//   • a hidden "website" field only bots fill in
//   • a minimum time between page load and submit
//   • a per-address cap on submissions

const g = globalThis;

// A hidden field no person can see, let alone fill in. Anything in it is a
// script filling every input it finds, which is as close to certain as this
// gets — so it is the only signal allowed to refuse a submission outright.
export function isHoneypot(body) {
  return Boolean(String(body?.website || "").trim());
}

// Submitted faster than a person could plausibly type. This is a much weaker
// signal than the honeypot: someone whose browser autofills the whole form can
// trip it, so it flags a submission for review rather than refusing it. The
// old threshold of 2.5 seconds was long enough to catch real people.
export function submittedTooFast(body) {
  const elapsed = Number(body?.elapsedMs);
  return Number.isFinite(elapsed) && elapsed > 0 && elapsed < 800;
}

// Cheap link/keyword spam signal for free-text (messages, comments). Bots dump
// several links or known spam terms; real messages almost never do.
export function looksSpammy(text) {
  const s = String(text || "");
  const links = (s.match(/https?:\/\/|www\.|\[url|\[link/gi) || []).length;
  if (links >= 3) return true;
  return /\b(viagra|cialis|casino|porn|crypto\s*giveaway|bit\.ly|tinyurl|loan offer|seo services|buy followers)\b/i.test(s);
}

// Reads a JSON request body with a hard ceiling on how much is read. Without
// one, an unauthenticated caller can make the server buffer as much as it cares
// to send. 64 KB is far more than any form here produces.
export async function readJsonBody(request, { maxBytes = 64 * 1024 } = {}) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { tooLarge: true };

  const reader = request.body?.getReader?.();
  if (!reader) {
    // No stream to meter (some runtimes); fall back to the declared length,
    // which has already been checked.
    try {
      return { body: await request.json() };
    } catch {
      return { invalid: true };
    }
  }

  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    // A chunked request declares no length, so the running total is the only
    // thing standing between us and an unbounded read.
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  try {
    return { body: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { invalid: true };
  }
}

export function clientIp(request) {
  return (
    (request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "")
      .split(",")[0]
      .trim() || "unknown"
  );
}

// `bucket` keeps counters separate per endpoint, so a burst of form
// submissions can't use up someone's login attempts (or the reverse).
export function rateLimited(request, { max = 8, windowMs = 10 * 60 * 1000, bucket = "form" } = {}) {
  const key = `${bucket}|${clientIp(request)}`;
  if (!g.__olsRate) g.__olsRate = new Map();
  const now = Date.now();
  const hits = (g.__olsRate.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  g.__olsRate.set(key, hits);
  if (g.__olsRate.size > 5000) g.__olsRate.clear(); // keep memory bounded
  return hits.length > max;
}

// Campaign details captured by the browser (utm_*, click ids, landing page).
export function cleanAttribution(a) {
  const out = {};
  if (!a || typeof a !== "object") return out;
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "li_fat_id",
    "msclkid",
    "landingPage",
    "referrer",
  ]) {
    const v = String(a[k] || "").trim().slice(0, 300);
    if (v) out[k] = v;
  }
  return out;
}

export function attributionSummary(a = {}) {
  const parts = [];
  if (a.utm_source) parts.push(`source: ${a.utm_source}`);
  if (a.utm_medium) parts.push(`medium: ${a.utm_medium}`);
  if (a.utm_campaign) parts.push(`campaign: ${a.utm_campaign}`);
  if (a.utm_content) parts.push(`ad: ${a.utm_content}`);
  if (a.gclid) parts.push("Google Ads click");
  if (a.li_fat_id) parts.push("LinkedIn ad click");
  if (a.fbclid) parts.push("Meta ad click");
  if (!parts.length && a.referrer) parts.push(`referred by ${a.referrer}`);
  return parts.join(" · ");
}
