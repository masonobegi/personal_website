import ProjectCard from "@/components/ProjectCard";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/contentStore";
import { getPublishedProjects, groupProjects } from "@/lib/projectsStore";
import { breadcrumbLd, buildMetadata, ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.projects || {};
  return buildMetadata({ path: "/projects", title: p.title || "Projects", description: p.description, firm: c.siteName });
}

export default async function ProjectsPage() {
  const [c, projects] = await Promise.all([getContent(), getPublishedProjects().catch(() => [])]);
  const groups = groupProjects(projects);
  const pp = c.projectsPage || {};

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Projects", path: "/projects" }])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE_URL}/projects#page`, url: `${SITE_URL}/projects`, name: "Projects", isPartOf: { "@id": WEBSITE_ID }, about: { "@id": ORG_ID } }} />

      <h1 className="page-title">{pp.heroTitle || "Projects"}</h1>
      {pp.heroSub && <p className="page-lead">{pp.heroSub}</p>}

      <div id="project-groups">
        {groups.length === 0 && <p className="muted">Projects are on their way.</p>}
        {groups.map((g) => (
          <div className="project-group" key={g.category}>
            <h2 className="group-title">{g.category}</h2>
            {g.subsections.map((sub) => (
              <div key={sub.name || "_"}>
                {sub.name && <h3 className="group-title" style={{ opacity: 0.75, marginTop: "1rem" }}>{sub.name}</h3>}
                <div className="card-grid">
                  {sub.items.map((p) => <ProjectCard key={p.slug} project={p} showFeatured />)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ height: "4rem" }} />
    </>
  );
}
