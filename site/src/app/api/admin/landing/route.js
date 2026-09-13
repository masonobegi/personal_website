import { isAdminRequest } from "@/lib/auth";
import {
  deleteLandingPage,
  getAllLandingPages,
  getLandingPage,
  maxScore,
  sanitizeLandingInput,
  saveLandingPage,
  validateLandingSlug,
} from "@/lib/landingStore";
import { listSubmissions } from "@/lib/submissionsStore";
import { landingRecipients } from "@/lib/leads";
import { emailConfigured, firmInbox, isDeliverable } from "@/lib/mailer";
import { addRedirect, removeRedirect, removeRedirectsTo } from "@/lib/redirectsStore";

const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401 });

// GET → every landing page with its submission count, plus what the editor
// needs to show who will be emailed.
export async function GET() {
  if (!(await isAdminRequest())) return unauthorized();
  const [pages, subs] = await Promise.all([
    getAllLandingPages(),
    listSubmissions({ limit: 5000 }).catch(() => []),
  ]);
  const counts = {};
  for (const s of subs) {
    const slug = s.landing?.slug;
    if (slug) counts[slug] = (counts[slug] || 0) + 1;
  }
  return Response.json({
    pages: pages.map((p) => ({ ...p, submissions: counts[p.slug] || 0, maxScore: maxScore(p.quiz) })),
    team: [],
    firmInbox: firmInbox(),
    emailConfigured: emailConfigured(),
  });
}

// POST → create or update. Send `originalSlug` when editing an existing page.
export async function POST(request) {
  if (!(await isAdminRequest())) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const page = sanitizeLandingInput(body);
  const err = validateLandingSlug(page.slug);
  if (err) return Response.json({ error: err }, { status: 400 });
  if (!page.headline) return Response.json({ error: "Please add a headline." }, { status: 400 });

  const originalSlug = typeof body.originalSlug === "string" ? body.originalSlug : "";
  const existing = await getLandingPage(page.slug);
  if (existing && originalSlug !== page.slug) {
    return Response.json({ error: `/go/${page.slug} is already used by another landing page.` }, { status: 409 });
  }
  const previous = originalSlug ? await getLandingPage(originalSlug) : null;
  const now = new Date().toISOString();
  const saved = await saveLandingPage({ ...page, createdAt: previous?.createdAt || now, updatedAt: now });
  if (originalSlug && originalSlug !== page.slug) {
    await deleteLandingPage(originalSlug);
    // Ads already in flight point at the old address. Without this they land
    // on a 404 — on paid traffic, which is the worst place for it.
    await addRedirect(`/go/${originalSlug}`, `/go/${saved.slug}`);
  }
  // An address that is a real page again must not redirect away from itself.
  await removeRedirect(`/go/${saved.slug}`);

  return Response.json({ ok: true, page: saved, recipients: await landingRecipients(saved) });
}

export async function DELETE(request) {
  if (!(await isAdminRequest())) return unauthorized();
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  await deleteLandingPage(slug);
  await removeRedirectsTo(`/go/${slug}`);
  return Response.json({ ok: true });
}
