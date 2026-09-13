import { getLandingPage, scoreAnswers } from "@/lib/landingStore";
import { addSubmission, patchSubmission, newSubmissionId } from "@/lib/submissionsStore";
import { downloadUrl, landingRecipients, notifyAboutSubmission, scheduleUrlFor } from "@/lib/leads";
import {
  cleanAttribution,
  isEmail,
  isHoneypot,
  rateLimited,
  readJsonBody,
  submittedTooFast,
} from "@/lib/mailer";
import { isAdminRequest } from "@/lib/auth";

// POST /api/lead — a landing-page form submission.
//
// The score is always recalculated here from the page's current questions;
// the browser only says which answers were picked. The submission is saved to
// the Inbox before any email is attempted, so a lead is never lost.

const clip = (v, max) => String(v ?? "").trim().slice(0, max);

export async function POST(request) {
  if (rateLimited(request)) {
    return Response.json({ error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });
  }

  const parsed = await readJsonBody(request);
  if (parsed.tooLarge) {
    return Response.json({ error: "That request is too large." }, { status: 413 });
  }
  if (parsed.invalid) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.body;

  const landing = await getLandingPage(clip(body.slug, 60));
  // Drafts accept submissions only from a signed-in admin previewing them.
  if (!landing || (!landing.published && !(await isAdminRequest()))) {
    return Response.json({ error: "This page is no longer available." }, { status: 404 });
  }

  const name = clip(body.name, 200);
  const email = clip(body.email, 254);
  const phone = clip(body.phone, 40);
  const message = clip(body.message, 4000);

  if (!name) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!isEmail(email)) return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (landing.form.phone === "required" && phone.replace(/\D/g, "").length < 7) {
    return Response.json({ error: "Please enter a phone number." }, { status: 400 });
  }
  if (landing.form.message === "required" && !message) {
    return Response.json({ error: "Please add a short message." }, { status: 400 });
  }

  const quiz = landing.quiz?.enabled ? scoreAnswers(landing.quiz, body.answers || {}) : null;
  if (quiz?.missing.length) {
    return Response.json({ error: `Please answer: ${quiz.missing[0]}` }, { status: 400 });
  }

  const offerType = landing.offer?.type || "none";
  const scheduleUrl = await scheduleUrlFor(landing);
  const result = quiz
    ? {
        score: quiz.score,
        max: quiz.max,
        showScore: landing.quiz.showScore !== false && quiz.max > 0,
        band: quiz.band
          ? { title: quiz.band.title, message: quiz.band.message, showSchedule: quiz.band.showSchedule }
          : null,
      }
    : null;

  // A filled honeypot is a script. It gets a convincing success and no file,
  // but the attempt is still written down — archived, so it never shows up as
  // something to deal with — because the alternative was throwing away
  // anything the filter got wrong, and nobody would ever have known.
  if (isHoneypot(body)) {
    await addSubmission({
      kind: "lead",
      status: "archived",
      suspectedSpam: "honeypot",
      name,
      email,
      phone,
      message,
      source: `landing:${landing.slug}`,
      landing: { slug: landing.slug, name: landing.name, headline: landing.headline },
      page: `/go/${landing.slug}`,
    }).catch(() => {});
    return Response.json({
      ok: true,
      result,
      download: null,
      scheduleUrl: offerType === "schedule" || result?.band?.showSchedule ? scheduleUrl : null,
    });
  }

  const record = {
    kind: "lead",
    name,
    email,
    phone,
    message,
    source: `landing:${landing.slug}`,
    landing: { slug: landing.slug, name: landing.name, headline: landing.headline },
    quiz: quiz
      ? {
          score: quiz.score,
          max: quiz.max,
          band: quiz.band ? { title: quiz.band.title, message: quiz.band.message } : null,
          answers: quiz.answers,
        }
      : null,
    offer: offerType,
    attribution: cleanAttribution(body.attribution),
    page: `/go/${landing.slug}`,
    // Flagged, not refused: an autofilled form can be this quick. The advisors
    // still get it, with the flag on the record so the Inbox can show it.
    ...(submittedTooFast(body) ? { suspectedSpam: "timing" } : {}),
    id: newSubmissionId(),
  };

  // Save to the Inbox, then email the advisors. These are two independent ways
  // of not losing the lead, so a failure in either must not cancel the other:
  // if the database is unreachable the email still goes out, and if email is
  // misconfigured the record is still in the Inbox.
  let sub = record;
  let saved = true;
  try {
    sub = await addSubmission(record);
  } catch (e) {
    saved = false;
    console.error("[lead] could not save submission:", e?.message || e);
  }

  const recipients = await landingRecipients(landing);
  const mail = await notifyAboutSubmission(
    saved ? sub : { ...sub, note: "NOT SAVED TO THE INBOX — the database was unreachable." },
    recipients
  );
  if (saved) {
    await patchSubmission(sub.id, { emailStatus: mail.status, notified: mail.to || recipients }).catch(() => {});
  }

  // Nothing holds this request: not the Inbox, and not an email that actually
  // went. "Not configured" and "no recipients" count here as much as a bounce —
  // from the visitor's side they are the same thing, and the contact form has
  // always treated them that way.
  if (!saved && mail.status !== "sent") {
    return Response.json(
      { error: "We couldn't record your request. Please call (503) 746-2184 or email us directly." },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    result,
    download: offerType === "download" ? downloadUrl(landing.slug, sub.id) : null,
    scheduleUrl: offerType === "schedule" || result?.band?.showSchedule ? scheduleUrl : null,
  });
}
