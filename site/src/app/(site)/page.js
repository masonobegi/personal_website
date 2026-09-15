import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";
import { getContent } from "@/lib/contentStore";
import { getPublishedProjects } from "@/lib/projectsStore";
import { formatText as fmt } from "@/lib/formatText";
import { buildMetadata } from "@/lib/seo";

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
  const [c, projects] = await Promise.all([getContent(), getPublishedProjects().catch(() => [])]);
  const home = c.home || {};
  const featured = projects.filter((p) => p.featured).slice(0, 4);
  const firstJob = (c.experience || [])[0];

  return (
    <>
      {/* Hero */}
      <section className="hero" id="intro">
        <div className="hero-text">
          <h1>{fmt(home.heroTitle)}</h1>
          <p className="role">{fmt(home.heroRole)}</p>
          <p className="bio">{fmt(home.heroBody)}</p>
          <div className="hero-links">
            <Link href="/projects">View projects →</Link>
            {c.githubUrl && <a href={c.githubUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>}
            {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
          </div>
        </div>
        <div className="hero-media">
          <div className="hero-image">
            <span className="hero-placeholder">Add a cover photo in the admin</span>
            {c.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.heroImage} alt={c.siteName} />
            ) : null}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <>
          <hr className="divider" />
          <div className="section-head">
            <h2>{home.featuredTitle || "Featured Projects"}</h2>
            <Link className="view-all" href="/projects">View all projects →</Link>
          </div>
          <div className="card-grid">
            {featured.map((p) => <ProjectCard key={p.slug} project={p} showFeatured />)}
          </div>
        </>
      )}

      {/* About */}
      <hr className="divider" />
      <div className="section-head">
        <h2>{home.aboutTitle || "About"}</h2>
        <Link className="view-all" href="/about">More about me →</Link>
      </div>
      <div className="about-body">
        {home.aboutBody && <p>{fmt(home.aboutBody)}</p>}
        {home.aboutBody2 && <p>{fmt(home.aboutBody2)}</p>}
      </div>

      {/* Experience */}
      {firstJob && (
        <>
          <hr className="divider" />
          <div className="section-head">
            <h2>{home.experienceTitle || "Experience"}</h2>
            <Link className="view-all" href="/about">Full experience →</Link>
          </div>
          <div className="exp-list">
            <article className="exp-item">
              <div className="exp-meta">
                <span className="exp-date">{firstJob.dates}</span>
                <span className="exp-company">{firstJob.company}</span>
              </div>
              <div className="exp-detail">
                <h3>{firstJob.title}</h3>
                <ul>
                  {(firstJob.bullets || []).map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            </article>
          </div>
        </>
      )}

      {/* Contact */}
      <hr className="divider" />
      <div className="section-head">
        <h2>{home.contactTitle || "Get In Touch"}</h2>
        <Link className="view-all" href="/contact">Contact →</Link>
      </div>
      <p className="page-lead">{fmt(home.contactBody)}</p>
      <div className="contact-lines">
        {c.email && <a className="contact-link" href={`mailto:${c.email}`}>{c.email} →</a>}
        {c.phone && <a className="contact-link" href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}>{c.phone} →</a>}
      </div>
      <div style={{ height: "4rem" }} />
    </>
  );
}
