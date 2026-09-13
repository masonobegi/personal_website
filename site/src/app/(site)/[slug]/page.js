import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHero, SectionHead } from "@/components/ui";
import RichText from "@/components/RichText";
import ContentLink from "@/components/ContentLink";
import { getPage } from "@/lib/pagesStore";
import { getContent } from "@/lib/contentStore";
import { getAllArticles, opensExternally } from "@/lib/articlesStore";
import { articlesInSeries } from "@/lib/libraryHelpers";
import JsonLd from "@/components/JsonLd";
import { breadcrumbLd, buildMetadata, plainText, ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";

// Root-level catch-all for hidden custom pages the admin creates (any single
// slug not matched by a static route). Not linked in the primary nav.
export const dynamic = "force-dynamic";

function pageSeo(page) {
  return {
    title: page.seoTitle || page.heroTitle || page.slug,
    description: page.seoDescription || plainText(page.heroSub) || "",
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, content] = await Promise.all([getPage(slug), getContent()]);
  if (!page || !page.published) {
    return { title: { absolute: `Not found | ${content.siteName}` }, robots: { index: false } };
  }
  const seo = pageSeo(page);
  return buildMetadata({ path: `/${slug}`, title: seo.title, description: seo.description, firm: content.siteName });
}

export default async function CustomPage({ params }) {
  const { slug } = await params;
  const [page, content] = await Promise.all([getPage(slug), getContent()]);
  if (!page || !page.published) notFound();

  let series = [];
  if (page.relatedTag) {
    try {
      series = articlesInSeries(await getAllArticles(), page.relatedTag).filter((a) => !opensExternally(a));
    } catch {
      series = [];
    }
  }

  const seo = pageSeo(page);
  const url = `${SITE_URL}/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    url,
    name: seo.title,
    description: seo.description,
    isPartOf: { "@id": WEBSITE_ID },
    provider: { "@id": ORG_ID },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: page.heroTitle || slug, path: `/${slug}` }])} />
      <PageHero eyebrow={page.heroEyebrow || page.audience} title={page.heroTitle || slug} sub={page.heroSub} />

      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {page.serveLine && <p className="lead">{fmt(page.serveLine)}</p>}

          {Array.isArray(page.questions) && page.questions.length > 0 && (
            <ul className="qlist" style={{ marginTop: 24 }}>
              {page.questions.map((q, i) => <li key={i}>{fmt(q)}</li>)}
            </ul>
          )}

          {Array.isArray(page.blocks) && page.blocks.map((b, i) => (
            <div key={i} style={{ marginTop: 40 }}>
              {b.heading && <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", marginBottom: 12 }}>{fmt(b.heading)}</h2>}
              {b.body && <RichText text={b.body} className="muted" />}
              {b.linkHref && b.linkLabel && <ContentLink href={b.linkHref} label={b.linkLabel} />}
            </div>
          ))}
        </div>
      </section>

      {series.length > 0 && (
        <section className="section" style={{ background: "var(--cream-deep)" }}>
          <div className="container">
            <SectionHead eyebrow={page.relatedEyebrow || "Related"} title={page.relatedTitle || "Related reading"} />
            <div className="grid-3" style={{ gap: 28 }}>
              {series.map((a) => (
                <Link key={a.slug} href={`/library/${a.slug}`} className="card">
                  <h3 style={{ fontSize: "1.2rem" }}>{fmt(a.title)}</h3>
                  <span className="card-cta">Read →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
