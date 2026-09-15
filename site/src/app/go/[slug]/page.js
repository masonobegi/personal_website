import { notFound, permanentRedirect } from "next/navigation";
import LandingFlow from "@/components/landing/LandingFlow";
import SmartImage from "@/components/SmartImage";
import RichText from "@/components/RichText";
import { getLandingPage } from "@/lib/landingStore";
import { getContent } from "@/lib/contentStore";
import { isAdminRequest } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";
import { getRedirect } from "@/lib/redirectsStore";

// /go/<slug> — an ad landing page. Deliberately outside the (site) group, so
// there's no header navigation or footer menu: one offer, one form, one next
// step. Kept out of search results (it's for ad traffic), but shareable.
export const dynamic = "force-dynamic";

async function loadPage(slug) {
  const landing = await getLandingPage(slug);
  if (!landing) return { landing: null, preview: false };
  if (landing.published) return { landing, preview: false };
  // Drafts are visible only to a signed-in admin, as a preview.
  return (await isAdminRequest()) ? { landing, preview: true } : { landing: null, preview: false };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [{ landing }, c] = await Promise.all([loadPage(slug), getContent()]);
  if (!landing) return { title: { absolute: c.siteName }, robots: { index: false } };
  return buildMetadata({
    path: `/go/${slug}`,
    title: landing.headline || c.siteName,
    description: landing.subhead,
    image: landing.image || undefined,
    firm: c.siteName,
    noindex: true,
  });
}

export default async function LandingPage({ params }) {
  const { slug } = await params;
  const [{ landing, preview }, c] = await Promise.all([loadPage(slug), getContent()]);
  if (!landing) {
    // A renamed page leaves a redirect behind, so an ad pointing at the old
    // address still reaches the right place instead of a missing page.
    const moved = await getRedirect(`/go/${slug}`);
    if (moved) permanentRedirect(moved);
    notFound();
  }

  // Only what the browser needs. Score bands, notification settings, and the
  // gated file's location stay on the server.
  const quiz = landing.quiz?.enabled
    ? {
        title: landing.quiz.title,
        intro: landing.quiz.intro,
        startLabel: landing.quiz.startLabel,
        showPoints: landing.quiz.showPoints,
        questions: landing.quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          help: q.help,
          type: q.type,
          required: q.required,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            ...(landing.quiz.showPoints ? { points: o.points } : {}),
          })),
        })),
      }
    : null;

  const config = {
    slug: landing.slug,
    headline: landing.headline,
    quiz,
    form: landing.form,
    offer: {
      type: landing.offer.type,
      downloadLabel: landing.offer.downloadLabel,
      scheduleLabel: landing.offer.scheduleLabel,
    },
    thanks: landing.thanks,
    preview,
  };

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap">
          <span className="lp-brand">
            <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="0.6" />
              <path d="M20 9 L20 31 M11 20 L29 20 M13.5 13.5 L26.5 26.5 M26.5 13.5 L13.5 26.5" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
            </svg>
            <span>{c.siteName}</span>
          </span>
        </div>
      </header>

      {preview && (
        <div className="lp-preview" role="status">
          Draft preview — only you can see this page until it&apos;s published.
        </div>
      )}

      <main id="main-content" className="lp-main">
        <div className="lp-wrap lp-grid">
          <section className="lp-copy" aria-labelledby="lp-headline">
            {landing.eyebrow && <div className="eyebrow lp-eyebrow">{landing.eyebrow}</div>}
            <h1 id="lp-headline">{fmt(landing.headline)}</h1>
            {landing.subhead && <p className="lp-sub">{fmt(landing.subhead)}</p>}
            {landing.bullets?.length > 0 && (
              <ul className="lp-bullets">
                {landing.bullets.map((b, i) => (
                  <li key={i}>{fmt(b)}</li>
                ))}
              </ul>
            )}
            {landing.image && (
              <div className="lp-image">
                <SmartImage src={landing.image} alt="" sizes="(max-width: 900px) 100vw, 520px" priority />
              </div>
            )}
          </section>

          <section className="lp-card" aria-label={quiz ? "Questionnaire" : "Request form"}>
            <LandingFlow config={config} />
          </section>
        </div>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <p className="lp-links">
            <a href="/privacy">Privacy</a>
            <span aria-hidden="true"> · </span>
            <a href="/terms">Terms</a>
            <span aria-hidden="true"> · </span>© {new Date().getFullYear()} {c.siteName}
          </p>
        </div>
      </footer>
    </div>
  );
}
