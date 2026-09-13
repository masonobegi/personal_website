import { getAllArticles, articleKind, isPointerArticle, bodyText } from "@/lib/articlesStore";
import { getAllPages } from "@/lib/pagesStore";
import { getPublishedProjects } from "@/lib/projectsStore";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Every URL here is the canonical, indexable version of a page — no
// redirects, no noindex pages (login, admin, ad landing pages), no links out.
// Regenerated on every request, so a newly published article is listed the
// moment it goes live.
export default async function sitemap() {
  const staticRoutes = [
    { path: "", priority: 1.0 },
    { path: "/projects", priority: 0.9 },
    { path: "/about", priority: 0.8 },
    { path: "/hire", priority: 0.8 },
    { path: "/library", priority: 0.7 },
    { path: "/hobbies", priority: 0.5 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ].map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: "monthly",
    priority: r.priority,
  }));

  let projectRoutes = [];
  try {
    const projects = await getPublishedProjects();
    projectRoutes = projects.map((p) => ({
      url: `${SITE_URL}/projects/${p.slug}`,
      lastModified: p.updatedAt || undefined,
      changeFrequency: "monthly",
      priority: p.featured ? 0.8 : 0.6,
    }));
  } catch {
    // DB unreachable (e.g. during build) — skip these.
  }

  let specialtyRoutes = [];
  try {
    const pages = await getAllPages();
    specialtyRoutes = pages
      .filter((p) => p.published !== false)
      .map((p) => ({
        url: `${SITE_URL}/${p.slug}`,
        lastModified: p.updatedAt || undefined,
        changeFrequency: "monthly",
        priority: 0.9,
      }));
  } catch {
    // DB unreachable (e.g. during build) — skip these.
  }

  let articleRoutes = [];
  try {
    const articles = await getAllArticles();
    for (const a of articles) {
      if (isPointerArticle(a)) continue;
      const image =
        typeof a.thumbnail === "string" && /^(\/|https:)/.test(a.thumbnail) ? [absoluteUrl(a.thumbnail)] : undefined;
      articleRoutes.push({
        url: `${SITE_URL}/library/${a.slug}`,
        lastModified: a.updatedAt || a.createdAt || undefined,
        changeFrequency: "monthly",
        priority: articleKind(a) === "pdf" ? 0.8 : 0.6,
        ...(image ? { images: image } : {}),
      });
      // A PDF with no web version yet is indexed on its own. Once its text is
      // on the article page, the PDF points search engines to that page
      // instead (see library/[slug]/file.pdf) and drops out of here.
      if (a.pdf && bodyText(a).trim().length <= 200) {
        articleRoutes.push({
          url: `${SITE_URL}/library/${a.slug}/file.pdf`,
          lastModified: a.updatedAt || a.createdAt || undefined,
          changeFrequency: "yearly",
          priority: 0.5,
        });
      }
    }
  } catch {
    // DB unreachable (e.g. during build) — still return the static routes.
  }

  return [...staticRoutes, ...projectRoutes, ...specialtyRoutes, ...articleRoutes];
}
