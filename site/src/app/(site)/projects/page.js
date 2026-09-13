import { PageHero, SectionHead } from "@/components/ui";
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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/projects#page`,
          url: `${SITE_URL}/projects`,
          name: "Projects",
          isPartOf: { "@id": WEBSITE_ID },
          about: { "@id": ORG_ID },
        }}
      />
      <PageHero eyebrow="Work" title={pp.heroTitle || "Projects"} sub={pp.heroSub} />

      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container">
          {groups.length === 0 && <p className="muted">Projects are on their way.</p>}
          {groups.map((g, gi) => (
            <div key={g.category} style={{ marginTop: gi === 0 ? 0 : 56 }}>
              <SectionHead eyebrow={`0${gi + 1}`} title={g.category} />
              {g.subsections.map((sub) => (
                <div key={sub.name} style={{ marginBottom: 28 }}>
                  {sub.name && (
                    <h3 style={{ fontSize: "1.2rem", margin: "8px 0 18px", color: "var(--ink-soft)" }}>{sub.name}</h3>
                  )}
                  <div className="grid-3">
                    {sub.items.map((p) => <ProjectCard key={p.slug} project={p} />)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
