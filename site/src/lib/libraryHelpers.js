import { getAllPages } from "@/lib/pagesStore";
import { articleKind, bodyText, opensExternally } from "@/lib/articlesStore";
import { clampText, plainText, splitCredentials, personAnchor } from "@/lib/seo";

// -----------------------------------------------------------------------------
//  How Library articles connect to the rest of the site: the specialty page a
//  paper belongs to, the advisor who wrote it, and what to read next.
// -----------------------------------------------------------------------------

// Published specialty pages that collect articles by tag (Nike → "nike").
export async function getSeriesPages() {
  try {
    const pages = await getAllPages();
    return pages
      .filter((p) => p.published !== false && String(p.relatedTag || "").trim())
      .map((p) => ({
        slug: p.slug,
        audience: p.audience || p.heroTitle || p.slug,
        tag: String(p.relatedTag).trim().toLowerCase(),
      }));
  } catch {
    return [];
  }
}

const hasTag = (article, tag) =>
  (article.tags || []).some((t) => String(t).trim().toLowerCase() === tag);

// The specialty page this article belongs to, if any.
export function seriesFor(article, seriesPages) {
  return seriesPages.find((s) => hasTag(article, s.tag)) || null;
}

export function articlesInSeries(all, tag) {
  const t = String(tag || "").trim().toLowerCase();
  return t ? all.filter((a) => hasTag(a, t)) : [];
}

// The team member an article's byline refers to ("Jonathan Leslie, CFP®" →
// Jonathan's record), so the byline can link to their bio.
export function findAuthor(article, team) {
  const { name } = splitCredentials(article?.author);
  if (!name) return null;
  const lower = name.toLowerCase();
  return (
    team.find((m) => splitCredentials(m.name).name.toLowerCase() === lower) ||
    team.find((m) => {
      const first = splitCredentials(m.name).name.toLowerCase().split(" ")[0];
      return first && lower.split(" ")[0] === first && lower.includes(" ") === false;
    }) ||
    null
  );
}

export async function getTeamSafe() {
  // No team on a personal site — bylines don't link to member bios.
  return [];
}

export function authorProfilePath(member) {
  return `/about#${personAnchor(member.name)}`;
}

// Up to `n` articles to read next: the same series first, then whatever
// shares the most tags, then the newest.
export function relatedArticles(article, all, series, n = 3) {
  const others = all.filter((a) => a.slug !== article.slug && !opensExternally(a));
  const tags = new Set((article.tags || []).map((t) => String(t).toLowerCase()));
  const score = (a) => {
    let s = 0;
    if (series && hasTag(a, series.tag)) s += 100;
    for (const t of a.tags || []) if (tags.has(String(t).toLowerCase())) s += 10;
    return s;
  };
  return others
    .map((a, i) => ({ a, s: score(a), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, n)
    .map((x) => x.a);
}

// What search engines show for an article: the admin's override, or a
// shortened title / description derived from the article itself.
export function articleSeoTitle(article) {
  return plainText(article.seoTitle) || plainText(article.title);
}

export function articleSeoDescription(article) {
  const own = plainText(article.seoDescription) || plainText(article.excerpt);
  if (own) return clampText(own, 158);
  return clampText(bodyText(article), 158);
}

export function kindLabel(article) {
  switch (articleKind(article)) {
    case "pdf":
      return "White Paper";
    case "video":
      return "Video";
    case "linked":
      return "Article";
    default:
      return "Article";
  }
}

export function wordCount(article) {
  return bodyText(article).split(/\s+/).filter(Boolean).length;
}
