import { addSubmission, patchSubmission, newSubmissionId } from "@/lib/submissionsStore";
import { notifyAboutSubmission } from "@/lib/leads";
import {
  cleanAttribution,
  firmInbox,
  isEmail,
  isHoneypot,
  submittedTooFast,
  rateLimited,
  readJsonBody,
} from "@/lib/mailer";

// POST /api/contact
// "Schedule a Conversation" / contact-form submissions. Saved to the Inbox
// first, then emailed to the firm inbox (CONTACT_TO_EMAIL, comma-separated for
// several people). Until a real RESEND_API_KEY is set, nothing is emailed but
// the submission is still saved, and the response says so.

export async function POST(request) {
  if (rateLimited(request)) {
    return Response.json({ error: "Too many messages. Please try again in a few minutes." }, { status: 429 });
  }

  const parsed = await readJsonBody(request);
  if (parsed.tooLarge) {
    return Response.json({ error: "That request is too large." }, { status: 413 });
  }
  if (parsed.invalid) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.body;

  // Strip control characters so a name cannot break a log line or a header.
  const clean = (v) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim();
  const name = clean(body?.name);
  const email = (body?.email || "").toString().trim();
  const concern = String(body?.concern ?? "").trim();
  const source = (clean(body?.source) || "website").slice(0, 80);

  if (!name || name.length > 200) {
    return Response.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (concern.length > 4000) {
    return Response.json({ error: "Message is too long." }, { status: 400 });
  }

  // A filled honeypot is a script. It gets a normal-looking success, but the
  // message is still written down and archived rather than thrown away — this
  // is the firm's main enquiry form, and a filter that silently deletes real
  // enquiries is worse than one that files them in the wrong place.
  if (isHoneypot(body)) {
    await addSubmission({
      kind: "contact",
      status: "archived",
      suspectedSpam: "honeypot",
      name,
      email,
      message: concern,
      source: `contact:${source}`,
    }).catch(() => {});
    return Response.json({ ok: true });
  }

  const record = {
    kind: "contact",
    name,
    email,
    phone: (body?.phone || "").toString().trim().slice(0, 40),
    message: concern,
    source: `contact:${source}`,
    attribution: cleanAttribution(body?.attribution),
    // Flagged, not refused — see the note in the landing-page route.
    ...(submittedTooFast(body) ? { suspectedSpam: "timing" } : {}),
    id: newSubmissionId(),
  };

  // Saving and emailing are two independent ways of not losing the message,
  // so one failing must not cancel the other.
  let sub = record;
  let saved = true;
  try {
    sub = await addSubmission(record);
  } catch (e) {
    saved = false;
    console.error("[contact] could not save submission:", e?.message || e);
  }

  const mail = await notifyAboutSubmission(
    saved ? sub : { ...sub, note: "NOT SAVED TO THE INBOX — the database was unreachable." },
    firmInbox()
  );
  if (saved) {
    await patchSubmission(sub.id, { emailStatus: mail.status, notified: mail.to || [] }).catch(() => {});
  }

  // What the visitor is told depends on whether their message is safe, not on
  // whether the email went — and a message in the Inbox is safe, because the
  // firm sees it there with its real delivery status against it. Turning "no
  // email key configured" into an error told every visitor the site was broken
  // while their message sat perfectly well in the Inbox, and it disagreed with
  // the landing-page form, which has always treated it as success.
  if (!saved) {
    return Response.json(
      { error: "We couldn't record your message. Please call (503) 746-2184 or email us directly." },
      { status: 502 }
    );
  }
  // Saved, but the notification bounced outright — worth saying, because a
  // failed send is different from one that was never attempted.
  if (mail.status === "failed") {
    return Response.json(
      { error: "We saved your message but couldn't send the notification. Please also call or email us." },
      { status: 502 }
    );
  }
  // Nothing about how the server is configured: that is the firm's business.
  return Response.json({ ok: true });
}
