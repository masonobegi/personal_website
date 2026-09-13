import { PageHero } from "@/components/ui";
import CTABand from "@/components/CTABand";
import LibraryBrowser from "@/components/LibraryBrowser";
import JsonLd from "@/components/JsonLd";
import { absoluteUrl, breadcrumbLd, buildMetadata, plainText, SITE_URL, WEBSITE_ID } from "@/lib/seo";
import { getAllArticles, articleKind, bodyText, opensExternally } from "@/lib/articlesStore";
import { getContent } from "@/lib/contentStore";
import { kindLabel } from "@/lib/libraryHelpers";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.library || {};
  return buildMetadata({
    path: "/library",
    title: p.title || "Library",
    description: p.description,
    firm: c.firmName,
  });
}

export default async function LibraryPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const initialTag = typeof sp.tag === "string" ? sp.tag : "";
  const initialType = typeof sp.type === "string" ? sp.type : "";

  const [all, content] = await Promise.all([getAllArticles(), getContent()]);

  // A lightweight, searchable index for the client. Images are URLs now, and
  // the body text is trimmed — enough to match searches without shipping every
  // white paper in full to the browser.
  const items = all.map((a) => {
    const kind = articleKind(a);
    return {
      slug: a.slug,
      title: a.title || "",
      author: a.author || "",
      date: a.date || "",
      createdAt: a.createdAt || "",
      excerpt: a.excerpt || "",
      thumbnail: a.thumbnail || null,
      tags: Array.isArray(a.tags) ? a.tags : [],
      kind,
      kindLabel: kindLabel(a),
      href: opensExternally(a) ? (kind === "video" ? a.videoUrl : a.externalUrl) : `/library/${a.slug}`,
      external: opensExternally(a),
      search: [a.title, a.author, (a.tags || []).join(" "), a.excerpt, bodyText(a).slice(0, 2500)]
        .join(" ")
        .toLowerCase(),
    };
  });

  const allTags = [...new Set(all.flatMap((a) => a.tags || []))];
  const kinds = [...new Set(items.map((i) => i.kind))];

  // CollectionPage + ItemList: tells search engines this page is an index of
  // the firm's articles, and lists them in order.
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/library#page`,
    url: `${SITE_URL}/library`,
    name: "Library",
    description: plainText(content.seo?.pages?.library?.description) || undefined,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.filter((i) => !i.external).length,
      itemListElement: items
        .filter((i) => !i.external)
        .map((i, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: absoluteUrl(i.href),
          name: plainText(i.title),
        })),
    },
  };

  return (
    <>
      <JsonLd data={collectionLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Library", path: "/library" },
        ])}
      />
      <PageHero
        eyebrow="Library"
        title="Insights & Articles"
        sub="Perspectives on wealth, planning, and the decisions that shape a legacy."
      />

      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container">
          <LibraryBrowser
            items={items}
            allTags={allTags}
            kinds={kinds}
            initialTag={initialTag}
            initialType={initialType}
          />
        </div>
      </section>

      <CTABand />
    </>
  );
}
