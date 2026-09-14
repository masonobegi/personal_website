import Link from "next/link";
import CTABand from "@/components/CTABand";
import ArticleCover from "@/components/ArticleCover";
import { SectionHead } from "@/components/ui";
import { getContent } from "@/lib/contentStore";
import { getPublishedProjects } from "@/lib/projectsStore";
import { getAllArticles, opensExternally } from "@/lib/articlesStore";
import { kindLabel } from "@/lib/libraryHelpers";
import ScrollCue from "@/components/ScrollCue";
import { formatText as fmt } from "@/lib/formatText";
import { buildMetadata, plainText } from "@/lib/seo";
import ProjectCard from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  return buildMetadata({
    path: "/",
    title: c.seo?.title || c.siteName,
    exactTitle: true,
    description: c.seo?.description,
    firm: c.siteName,
  });
}

export default async function HomePage() {
  const [c, projects, articles] = await Promise.all([
    getContent(),
    getPublishedProjects().catch(() => []),
    getAllArticles().catch(() => []),
  ]);
  const home = c.home || {};
  const featured = projects.filter((p) => p.featured).slice(0, 4);
  const firstJob = (c.experience || [])[0];
  const recent = articles.filter((a) => !opensExternally(a)).slice(0, 3);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="hero hero-home">
        <div className="container hero-inner">
          <h1>{fmt(home.heroTitle)}</h1>
          <p className="hero-sub">{fmt(home.heroRole)}</p>
          <p className="hero-body">{fmt(home.heroBody)}</p>
          <div className="btn-row">
            <Link href="/projects" className="btn btn-ember">View Projects</Link>
            {c.githubUrl && (
              <a href={c.githubUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light">GitHub ↗</a>
            )}
            {c.linkedinUrl && (
              <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light">LinkedIn ↗</a>
            )}
          </div>
        </div>
        <ScrollCue />
      </section>

      {/* ---------------- FEATURED PROJECTS ---------------- */}
      {featured.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container">
            <SectionHead eyebrow="Featured" title={home.featuredTitle || "Featured Projects"} />
            <div className="grid-3">
              {featured.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link href="/projects" className="btn btn-outline">View all projects</Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- ABOUT ---------------- */}
      <section className="section" style={{ background: "var(--cream-deep)" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <SectionHead eyebrow="About" title={home.aboutTitle || "About"} />
          <p className="lead">{fmt(home.aboutBody)}</p>
          {home.aboutBody2 && <p className="muted" style={{ marginTop: 14 }}>{fmt(home.aboutBody2)}</p>}
          <div className="btn-row" style={{ marginTop: 24 }}>
            <Link href="/about" className="btn btn-outline">More about me</Link>
          </div>
        </div>
      </section>

      {/* ---------------- EXPERIENCE ---------------- */}
      {firstJob && (
        <section className="section" style={{ background: "var(--cream-deep)" }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <div className="eyebrow">{home.experienceTitle || "Experience"}</div>
            <h2 style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginTop: 12 }}>
              {firstJob.title} · {firstJob.company}
            </h2>
            <p className="card-meta" style={{ marginTop: 6 }}>{firstJob.dates}</p>
            <ul className="qlist" style={{ marginTop: 18 }}>
              {(firstJob.bullets || []).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <div className="btn-row" style={{ marginTop: 26 }}>
              <Link href="/about" className="btn btn-outline">Full experience</Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- FROM THE LIBRARY ---------------- */}
      {recent.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container">
            <SectionHead eyebrow="Writing" title="Recent notes" />
            <div className="grid-3" style={{ gap: 28 }}>
              {recent.map((a) => (
                <Link key={a.slug} href={`/library/${a.slug}`} className="card" style={{ background: "#fff", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
                  <ArticleCover thumbnail={a.thumbnail} alt="" height={170} />
                  <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                    <div className="card-meta">{kindLabel(a)}</div>
                    <h3 style={{ fontSize: "1.3rem", lineHeight: 1.25 }}>{fmt(a.title)}</h3>
                    <span className="card-cta">Read →</span>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 36 }}>
              <Link href="/library" className="btn btn-outline">Visit the Library</Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- CONTACT CTA ---------------- */}
      <CTABand title={home.contactTitle || "Get In Touch"} sub={home.contactBody} bg="var(--forest)" />
    </>
  );
}
