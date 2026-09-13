import { getContent } from "@/lib/contentStore";
import { getPublishedProjects } from "@/lib/projectsStore";
import { getAllArticles, isPointerArticle } from "@/lib/articlesStore";
import { SITE_URL, plainText, clampText } from "@/lib/seo";

// /llms.txt — a plain-text map of the site for AI answer engines. Generated
// from live content so it never goes stale.
export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getContent();
  const BASE = SITE_URL;

  let projects = [];
  let articles = [];
  try { projects = await getPublishedProjects(); } catch { projects = []; }
  try { articles = await getAllArticles(); } catch { articles = []; }

  const L = [];
  L.push(`# ${content.siteName}`);
  L.push("");
  L.push(`> ${plainText(content.seo?.description) || content.tagline}`);
  L.push("");
  L.push(`${content.siteName} is a software engineer${content.location ? ` based in ${content.location}` : ""}. This is a personal portfolio: production client websites, published apps, and real-time multiplayer games.`);
  L.push("");

  L.push("## Contact");
  if (content.email) L.push(`- Email: ${content.email}`);
  if (content.githubUrl) L.push(`- GitHub: ${content.githubUrl}`);
  if (content.linkedinUrl) L.push(`- LinkedIn: ${content.linkedinUrl}`);
  L.push(`- Contact form: ${BASE}/contact`);
  L.push("");

  L.push("## Main pages");
  L.push(`- [Home](${BASE}/): Overview and featured work.`);
  L.push(`- [Projects](${BASE}/projects): Client sites, apps, and passion projects.`);
  L.push(`- [About](${BASE}/about): Background, experience, skills, and education.`);
  L.push(`- [Hire](${BASE}/hire): Custom website work for local businesses.`);
  L.push(`- [Library](${BASE}/library): Writing and notes.`);
  L.push(`- [Hobbies](${BASE}/hobbies): LEGO, lifting, and chess.`);
  L.push(`- [Contact](${BASE}/contact): Get in touch.`);
  L.push("");

  if (projects.length) {
    L.push("## Projects");
    for (const p of projects) {
      const desc = clampText(p.description || "", 240);
      L.push(`- [${plainText(p.title)}](${BASE}/projects/${p.slug})${desc ? `: ${desc}` : ""}`);
    }
    L.push("");
  }

  const onSite = articles.filter((a) => !isPointerArticle(a));
  if (onSite.length) {
    L.push("## Writing");
    for (const a of onSite.slice(0, 80)) {
      const desc = clampText(a.seoDescription || a.excerpt || "", 240);
      L.push(`- [${plainText(a.title)}](${BASE}/library/${a.slug})${desc ? `: ${desc}` : ""}`);
    }
    L.push("");
  }

  return new Response(L.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
