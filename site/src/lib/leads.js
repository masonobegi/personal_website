import { getContent } from "@/lib/contentStore";
import { signValue, verifySignedValue } from "@/lib/auth";
import {
  attributionSummary,
  escapeHtml,
  firmInbox,
  isDeliverable,
  sendEmail,
} from "@/lib/mailer";
import { SITE_URL } from "@/lib/seo";

// -----------------------------------------------------------------------------
//  Shared pieces of the lead flow: who gets notified, the notification email,
//  and the signed download link a visitor receives after submitting.
// -----------------------------------------------------------------------------

// Where a landing page's leads go. A personal site has one inbox (the email in
// the Content tab / CONTACT_TO_EMAIL), plus any address the landing page sets.
export async function landingRecipients(landing) {
  const out = new Set(firmInbox().filter(isDeliverable));
  const extra = String(landing?.notify?.email || "").trim();
  if (isDeliverable(extra)) out.add(extra);
  return [...out];
}

// How long a gated download link works for. It is signed, so it cannot be
// invented — but it can be forwarded, and a week is a long time for a link that
// is meant to be the reward for filling in a form. Two hours is plenty for
// somebody to finish downloading, and short enough that a link pasted into a
// group chat is no longer a way around the form.
const DOWNLOAD_WINDOW = 2 * 3600;

export function downloadUrl(slug, submissionId) {
  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_WINDOW;
  const sig = signValue(`dl:${slug}:${submissionId}:${exp}`);
  return `/go/${slug}/download?s=${encodeURIComponent(submissionId)}&e=${exp}&t=${sig}`;
}

export function verifyDownload(slug, s, e, t) {
  const exp = Number(e);
  if (!s || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  return verifySignedValue(`dl:${slug}:${s}:${exp}`, t);
}

// Where the "Schedule" button goes: the page's own link, else a booking link
// from the Hire content, else the site's Contact page.
export async function scheduleUrlFor(landing) {
  if (landing?.offer?.scheduleUrl) return landing.offer.scheduleUrl;
  const c = await getContent();
  if (c.hire?.bookingUrl && c.hire.bookingUrl.startsWith("http")) return c.hire.bookingUrl;
  return "/contact";
}

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

// The email the advisors receive for a new lead: who, how to reach them,
// their raw score and every answer, and which campaign brought them in.
export function leadEmail(sub) {
  const q = sub.quiz;
  const row = (label, value) =>
    value
      ? `<tr><td style="padding:6px 14px 6px 0;color:#6b6b60;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;color:#23231f">${value}</td></tr>`
      : "";
  const answers = q?.answers?.length
    ? `<h3 style="font-family:Georgia,serif;font-weight:normal;margin:26px 0 8px">Answers</h3>
       <table style="border-collapse:collapse;width:100%;font-size:14px">
         ${q.answers
           .map(
             (a) => `<tr>
               <td style="border-top:1px solid #e6e0d3;padding:8px 10px 8px 0;vertical-align:top">${escapeHtml(a.question)}</td>
               <td style="border-top:1px solid #e6e0d3;padding:8px 10px;vertical-align:top"><strong>${escapeHtml(a.answer || "—")}</strong></td>
               <td style="border-top:1px solid #e6e0d3;padding:8px 0;vertical-align:top;text-align:right;color:#6b6b60;white-space:nowrap">${a.points === null ? "" : `${a.points} pt${a.points === 1 ? "" : "s"}`}</td>
             </tr>`
           )
           .join("")}
       </table>`
    : "";

  const scoreLine = q && q.max > 0 ? `${q.score} / ${q.max}${q.band?.title ? ` — ${escapeHtml(q.band.title)}` : ""}` : "";
  const campaign = attributionSummary(sub.attribution);
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;color:#23231f">
    <p style="text-transform:uppercase;letter-spacing:.14em;font-size:12px;color:#a2854f;margin:0 0 6px">${
      sub.kind === "lead" ? "New lead" : "New inquiry"
    }</p>
    <h2 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 4px">${escapeHtml(sub.name)}</h2>
    <p style="margin:0 0 18px;color:#6b6b60">${escapeHtml(sub.landing?.headline || sub.source || "Website")}</p>
    ${
      scoreLine
        ? `<div style="background:#f4f0e8;border:1px solid #d9d1c2;padding:14px 18px;margin-bottom:18px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b60">Score</div><div style="font-size:26px;font-family:Georgia,serif">${scoreLine}</div></div>`
        : ""
    }
    ${
      sub.note
        ? `<div style="background:#fdf3ee;border:1px solid #b24a26;padding:14px 18px;margin-bottom:18px;font-size:15px;color:#9c3f20"><strong>${escapeHtml(sub.note)}</strong></div>`
        : ""
    }
    <table style="border-collapse:collapse;font-size:15px">
      ${row("Email", `<a href="mailto:${escapeHtml(sub.email)}">${escapeHtml(sub.email)}</a>`)}
      ${row("Phone", sub.phone ? `<a href="tel:${escapeHtml(sub.phone.replace(/[^0-9+]/g, ""))}">${escapeHtml(sub.phone)}</a>` : "")}
      ${row("Message", sub.message ? escapeHtml(sub.message).replace(/\n/g, "<br>") : "")}
      ${row("Next step", sub.offer === "download" ? "Downloaded the guide" : sub.offer === "schedule" ? "Offered a consultation link" : "")}
      ${row("Campaign", escapeHtml(campaign))}
      ${row("Received", escapeHtml(when(sub.createdAt || new Date().toISOString())))}
    </table>
    ${answers}
    <p style="margin-top:28px;font-size:13px;color:#8a8a7e">Reply to this email to respond directly.${
      sub.note
        ? " This one is <strong>not</strong> in the dashboard Inbox — this email is the only record of it."
        : ` Every submission is also saved in the <a href="${SITE_URL}/admin">dashboard Inbox</a>.`
    }</p>
  </div>`;

  const subject =
    sub.kind === "lead"
      ? `New lead: ${sub.name} — ${sub.landing?.name || sub.landing?.headline || "landing page"}${scoreLine ? ` (score ${q.score}/${q.max})` : ""}`
      : `New inquiry from ${sub.name} (${sub.source || "website"})`;

  return { subject, html };
}

export async function notifyAboutSubmission(sub, recipients) {
  const { subject, html } = leadEmail(sub);
  return sendEmail({ to: recipients, subject, html, replyTo: sub.email });
}
