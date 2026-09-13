import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ArticleBody, { headingAnchors, VideoLinkCard } from "@/components/ArticleBody";
import ArticleCover from "@/components/ArticleCover";
import CTABand from "@/components/CTABand";
import JsonLd from "@/components/JsonLd";
import RichText from "@/components/RichText";
import SmartImage from "@/components/SmartImage";
import {
  absoluteUrl,
  breadcrumbLd,
  buildMetadata,
  clampText,
  displayDate,
  isoDate,
  plainText,
  splitCredentials,
  DEFAULT_SHARE_IMAGE,
  LOGO_URL,
  ORG_ID,
  SITE_URL,
  WEBSITE_ID,
} from "@/lib/seo";
import {
  getAllArticles,
  getArticle,
  articleKind,
  bodyText,
  isPointerArticle,
  opensExternally,
} from "@/lib/articlesStore";
import { getRedirect } from "@/lib/redirectsStore";
import { getMediaInfo, parseMediaUrl } from "@/lib/mediaStore";
import { getContent } from "@/lib/contentStore";
import {
  articleSeoDescription,
  articleSeoTitle,
  articlesInSeries,
  authorProfilePath,
  findAuthor,
  getSeriesPages,
  getTeamSafe,
  kindLabel,
  relatedArticles,
  seriesFor,
  wordCount,
} from "@/lib/libraryHelpers";
import { formatText as fmt } from "@/lib/formatText";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

// The article's share image with its real dimensions, when it's a stored file.
async function shareImageFor(article) {
  const thumb = article.thumbnail;
  if (!thumb || !/^(\/|https:)/.test(thumb)) return null;
  const parsed = parseMediaUrl(thumb);
  const info = parsed ? await getMediaInfo(parsed.id).catch(() => null) : null;
  return {
    url: thumb,
    ...(info?.width ? { width: info.width, height: info.height } : {}),
    alt: plainText(article.title),
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [article, content] = await Promise.all([getArticle(slug), getContent()]);
  if (!article || !article.published) {
    return { title: { absolute: `Not found | ${content.firmName}` }, robots: { index: false } };
  }
  const image = await shareImageFor(article);
  return buildMetadata({
    path: `/library/${slug}`,
    title: articleSeoTitle(article),
    description: articleSeoDescription(article),
    image,
    type: "article",
    firm: content.firmName,
    // Pages that only point somewhere else aren't worth a search listing.
    noindex: isPointerArticle(article),
    article: {
      publishedTime: isoDate(article.date) || article.createdAt,
      modifiedTime: article.updatedAt,
      authors: article.author ? [splitCredentials(article.author).name] : undefined,
      tags: article.tags,
    },
  });
}

// Words that mark a byline as a company rather than a human being.
const ORG_WORDS = new RegExp(
  String.raw`\b(research|insights?|team|group|partners?|advisors?|advisory|associates?|` +
    String.raw`capital|management|institute|investments?|financial|securities|wealth|` +
    String.raw`llc|inc|incorporated|corp|corporation|company|ltd|bank|trust|fund|funds)\b`,
  "i"
);

// A byline is treated as a person only when it reads like one: two or more
// capitalised words, none of them a company word. "Wade Pfau" is a person;
// "LPL Research", "LPL Financial" and "Prudential" are not.
function looksLikePerson(name) {
  const n = String(name || "").trim();
  if (ORG_WORDS.test(n)) return false;
  return n.split(/\s+/).filter(Boolean).length >= 2;
}

// Only an advisor on the team is described as working for the firm. Saying
// that "Prudential" or an outside economist we've reprinted works here would
// be a false statement about a real company or a real person.
function authorLd(member, plainName, suffix) {
  if (member) {
    return {
      "@type": "Person",
      name: plainName,
      ...(suffix ? { honorificSuffix: suffix } : {}),
      // The same identity the About page publishes, so a byline and the
      // advisor's profile are understood to be one person.
      "@id": absoluteUrl(authorProfilePath(member)),
      url: absoluteUrl(authorProfilePath(member)),
      jobTitle: member.title || undefined,
      worksFor: { "@id": ORG_ID },
    };
  }
  if (!looksLikePerson(plainName)) {
    return { "@type": "Organization", name: plainName };
  }
  return {
    "@type": "Person",
    name: plainName,
    ...(suffix ? { honorificSuffix: suffix } : {}),
  };
}


export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || !article.published) {
    // An address that was renamed keeps working: send visitors (and Google)
    // to where the article lives now.
    const moved = await getRedirect(`/library/${slug}`);
    if (moved) permanentRedirect(moved);
    notFound();
  }

  const [content, all, seriesPages, team, shareImage] = await Promise.all([
    getContent(),
    getAllArticles(),
    getSeriesPages(),
    getTeamSafe(),
    shareImageFor(article),
  ]);

  const kind = articleKind(article);
  const url = `${SITE_URL}/library/${slug}`;
  const series = seriesFor(article, seriesPages);
  const related = relatedArticles(article, all, series, 3);
  const author = findAuthor(article, team);
  const authorName = author ? author.name : article.author;
  const { name: authorPlainName, suffix: authorSuffix } = splitCredentials(
    author ? `${author.name}${author.credentials ? `, ${author.credentials}` : ""}` : article.author
  );
  const blocks = Array.isArray(article.blocks) ? article.blocks : [];
  const hasBody = bodyText(article).trim().length > 200;
  const anchors = headingAnchors(blocks);
  const toc = blocks
    .map((b, i) => (b.type === "heading" && b.level === 2 ? { text: b.text, id: anchors[i] } : null))
    .filter(Boolean);

  const published = displayDate(article.date || article.createdAt);
  const reviewed = displayDate(article.reviewedDate);
  const updated =
    !reviewed &&
    article.updatedAt &&
    article.createdAt &&
    new Date(article.updatedAt) - new Date(article.createdAt) > 36 * 3600 * 1000
      ? displayDate(article.updatedAt)
      : "";

  // ---- Structured data ----------------------------------------------------
  // Google asks for at least 1200px across before an article is eligible for an
  // image-bearing result, and all but one of the thumbnails are smaller than
  // that. Offer both: the article's own picture when it qualifies, and the
  // site's share card, which does. Ordered widest-first, which is the one
  // Google prefers.
  const fullTitle = plainText(article.title);
  const headline = clampText(fullTitle, 110, { ellipsis: false });

  const articleImages = [
    ...(shareImage?.url && (shareImage.width || 0) >= 1200 ? [absoluteUrl(shareImage.url)] : []),
    absoluteUrl(DEFAULT_SHARE_IMAGE.url),
  ];
  const image = articleImages[0];
  // Modified = the latest of the review date and the last save, and never
  // before publication ("Reviewed August 2026" parses as August 1st).
  const datePublished = isoDate(article.date) || article.createdAt || undefined;
  const dateModified =
    [isoDate(article.reviewedDate), article.updatedAt, datePublished].filter(Boolean).sort().pop() || undefined;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    // Shortening a headline can change what it claims — "how much Nike stock
    // is too much" becoming "how much Nike stock is" — so the whole title is
    // published alongside it whenever it had to be cut.
    ...(headline !== fullTitle ? { alternativeHeadline: fullTitle } : {}),
    description: articleSeoDescription(article),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: articleImages,
    datePublished,
    dateModified,
    inLanguage: "en-US",
    isPartOf: { "@id": WEBSITE_ID },
    // Only an advisor on the team is described as working for the firm. A
    // byline like "LPL Research" or "Prudential" is an organisation, and an
    // outside author (an economist we've reprinted) is a person who does not
    // work here — claiming either would be a false statement about a real
    // company or a real person.
    author: authorName ? authorLd(author, authorPlainName, authorSuffix) : { "@id": ORG_ID },
    // A reference, not a second description of the same organisation with a
    // differently-shaped logo attached to it.
    publisher: { "@id": ORG_ID },
    keywords: (article.tags || []).join(", ") || undefined,
    ...(series ? { about: { "@type": "Thing", name: series.audience } } : {}),
    ...(hasBody ? { wordCount: wordCount(article) } : {}),
    ...(article.pdf && /^\//.test(article.pdf)
      ? { associatedMedia: { "@type": "MediaObject", contentUrl: `${url}/file.pdf`, encodingFormat: "application/pdf" } }
      : {}),
  };

  const crumbs = [
    { name: "Home", path: "/" },
    series ? { name: series.audience, path: `/${series.slug}` } : { name: "Library", path: "/library" },
    { name: article.title, path: `/library/${slug}` },
  ];

  return (
    <>
      {/* A page that only points at something published elsewhere does not
          get an Article entry. It would have named this firm as the publisher
          of work that belongs to Prudential, LPL Research or a state library,
          and described that source as a person employed here. The breadcrumb
          still goes out, which is all such a page needs. */}
      {!isPointerArticle(article) && <JsonLd data={articleLd} />}
      <JsonLd data={breadcrumbLd(crumbs)} />
      <article>
        {/* Header */}
        <section className="hero" style={{ minHeight: 420 }}>
          <div className="container hero-inner" style={{ maxWidth: 860 }}>
            <nav aria-label="Breadcrumb" className="eyebrow" style={{ color: "var(--brass-soft)" }}>
              <Link href="/library" style={{ color: "inherit" }}>
                Library
              </Link>
              {" · "}
              {series ? (
                <Link href={`/${series.slug}`} style={{ color: "inherit" }}>
                  {series.audience}
                </Link>
              ) : (
                kindLabel(article)
              )}
            </nav>
            <h1 style={{ marginTop: 14, maxWidth: "26ch" }}>{fmt(article.title)}</h1>
            <p className="hero-body article-byline" style={{ marginTop: 18, fontSize: "1.02rem" }}>
              {authorName && (
                <>
                  By{" "}
                  {author ? (
                    <Link href={authorProfilePath(author)} style={{ color: "#f1ebdd", textDecoration: "underline", textUnderlineOffset: 3 }}>
                      {article.author || authorName}
                    </Link>
                  ) : (
                    article.author
                  )}
                </>
              )}
              {authorName && published && " · "}
              {published && <>Published {published}</>}
              {(reviewed || updated) && (
                <>
                  {" · "}
                  {reviewed ? `Last reviewed ${reviewed}` : `Updated ${updated}`}
                </>
              )}
            </p>
          </div>
        </section>

        {/* Body */}
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container" style={{ maxWidth: 780 }}>
            {article.excerpt && (
              <p className="lead" style={{ marginBottom: 30, fontStyle: "italic" }}>
                {fmt(article.excerpt)}
              </p>
            )}

            {/* Jump links for long papers. */}
            {toc.length >= 3 && (
              <nav aria-label="In this article" className="article-toc">
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  In this {kind === "pdf" ? "paper" : "article"}
                </div>
                <ol>
                  {toc.map((t) => (
                    <li key={t.id}>
                      <a href={`#${t.id}`}>{fmt(t.text)}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {kind === "video" && article.videoUrl && (
              <VideoLinkCard url={article.videoUrl} title={article.title} thumbnail={article.thumbnail} />
            )}

            <ArticleBody blocks={blocks} />

            {/* External article: a clean preview card that links to the source.
                (Raw iframe embedding is unreliable — most publishers block it —
                so we present a polished card instead.) */}
            {kind === "linked" && article.externalUrl && <ExternalArticleCard article={article} />}

            {/* White paper: the text above is the article; the PDF is the
                branded download. A paper with no text yet keeps the preview. */}
            {article.pdf && <PdfPanel article={article} showPreview={!hasBody} />}

            {(article.sources || reviewed) && (
              <section className="fine-print" aria-labelledby="sources-heading">
                <h2 id="sources-heading">Sources and documents reviewed</h2>
                {article.sources && <RichText text={article.sources} />}
                {reviewed && <p style={{ marginTop: 10 }}>Information reviewed as of {reviewed}.</p>}
              </section>
            )}

            {article.disclosures && (
              <section className="fine-print" aria-labelledby="disclosures-heading">
                <h2 id="disclosures-heading">Disclosures</h2>
                <RichText text={article.disclosures} />
              </section>
            )}

            {/* Series + author: the links that tie a paper to the rest of the site. */}
            {(series || author) && (
              <div className="article-links">
                {series && (
                  <Link href={`/${series.slug}`} className="card article-link-card">
                    <span className="eyebrow">Part of a series</span>
                    <span className="alc-title">Planning for {series.audience}</span>
                    <span className="alc-cta">See every paper and how we help →</span>
                  </Link>
                )}
                {author && (
                  <Link href={authorProfilePath(author)} className="card article-link-card author-card">
                    {author.headshot && (
                      <span className="author-photo">
                        <SmartImage src={author.headshot} alt={author.name} fill sizes="72px" />
                      </span>
                    )}
                    <span>
                      <span className="eyebrow">About the author</span>
                      <span className="alc-title">
                        {author.name}
                        {author.credentials ? `, ${author.credentials}` : ""}
                      </span>
                      {author.title && <span className="muted alc-sub">{author.title}</span>}
                      <span className="alc-cta">Read full bio →</span>
                    </span>
                  </Link>
                )}
              </div>
            )}

            {Array.isArray(article.tags) && article.tags.length > 0 && (
              <div className="article-tags">
                <span className="article-tags-label">Topics</span>
                {article.tags.map((t) => (
                  <Link key={t} href={`/library?tag=${encodeURIComponent(t)}`} className="tag-chip">
                    {t}
                  </Link>
                ))}
              </div>
            )}

            <div style={{ marginTop: 44, paddingTop: 24, borderTop: "1px solid var(--line-soft)" }}>
              <Link href="/library" style={{ color: "var(--ember)", fontWeight: 600 }}>
                ← Back to the Library
              </Link>
            </div>
          </div>
        </section>
      </article>

      {related.length > 0 && (
        <section className="section" style={{ background: "var(--cream-deep)" }} aria-labelledby="related-heading">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div className="eyebrow">Keep reading</div>
              <h2 id="related-heading" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.4rem)", marginTop: 12 }}>
                {series && articlesInSeries(related, series.tag).length === related.length
                  ? `More for ${series.audience}`
                  : "Related insights"}
              </h2>
            </div>
            <div className="grid-3" style={{ gap: 28 }}>
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/library/${a.slug}`}
                  className="card"
                  style={{ background: "#fff", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
                >
                  <ArticleCover thumbnail={a.thumbnail} alt="" height={170} />
                  <div style={{ padding: "20px 22px 24px" }}>
                    <div className="card-meta">{kindLabel(a)}</div>
                    <h3 style={{ fontSize: "1.3rem", lineHeight: 1.25 }}>{fmt(a.title)}</h3>
                    <span className="card-cta">Read →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTABand />
    </>
  );
}

function PdfPanel({ article, showPreview }) {
  const href = `/library/${article.slug}/file.pdf`;
  return (
    <div style={{ marginTop: 40 }}>
      <div className="card pdf-card">
        <div aria-hidden="true" className="pdf-icon">
          PDF
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", lineHeight: 1.2 }}>
            {showPreview ? "Read the full paper" : "Download the formatted PDF"}
          </div>
          {/* Exported filenames run long with no spaces, which would otherwise
              push straight off a phone screen. */}
          <div className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, marginTop: 4, overflowWrap: "anywhere" }}>
            {article.pdfName || `${article.slug}.pdf`}
            {article.pdfSize ? ` · ${formatBytes(article.pdfSize)}` : ""}
          </div>
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-ember">
          {showPreview ? "Open the PDF" : "Download PDF"}
        </a>
      </div>

      {/* Only for papers whose text isn't on the page yet. Phones render PDF
          iframes badly, so the preview is desktop-only. */}
      {showPreview && (
        <div className="pdf-preview" style={{ marginTop: 18 }}>
          <iframe
            src={`${href}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`}
            title={article.pdfName || article.title}
            style={{ width: "100%", height: 900, border: "1px solid var(--line)", background: "#fff", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}

// Polished, always-works presentation for a linked outside article.
function ExternalArticleCard({ article }) {
  const domain = domainOf(article.externalUrl);
  return (
    <a
      href={article.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        border: "1px solid var(--line)",
        borderRadius: 4,
        overflow: "hidden",
        background: "#fff",
        textDecoration: "none",
        marginTop: article.blocks?.length ? 32 : 0,
      }}
    >
      <ArticleCover thumbnail={article.thumbnail} alt={plainText(article.title)} height={300} />
      <div style={{ padding: "26px 28px" }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--brass)",
            marginBottom: 8,
          }}
        >
          Originally published on {domain}
        </div>
        <h2 style={{ fontSize: "1.6rem", color: "var(--ink)" }}>{fmt(article.title)}</h2>
        {article.excerpt && (
          <p className="muted" style={{ marginTop: 10 }}>
            {fmt(article.excerpt)}
          </p>
        )}
        <span className="btn btn-ember" style={{ marginTop: 20, display: "inline-flex" }}>
          Read the Full Article on {domain} →
        </span>
      </div>
    </a>
  );
}
