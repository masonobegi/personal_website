import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/contentStore";
import { formatText as fmt } from "@/lib/formatText";
import { breadcrumbLd, buildMetadata, plainText, ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.about || {};
  return buildMetadata({ path: "/about", title: p.title || "About", description: p.description, firm: c.siteName });
}

export default async function AboutPage() {
  const c = await getContent();
  const about = c.about || {};
  const experience = c.experience || [];
  const skills = c.skills || [];
  const edu = c.education || {};

  const aboutLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about#page`,
    url: `${SITE_URL}/about`,
    name: plainText(about.heroTitle) || "About",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORG_ID },
    mainEntity: { "@id": ORG_ID },
  };

  return (
    <>
      <JsonLd data={aboutLd} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />

      <h1 className="page-title">{about.heroTitle || "About"}</h1>

      <div className="about-intro">
        <div className="about-body">
          {(about.body || []).map((para, i) => <p key={i}>{fmt(para)}</p>)}
        </div>
        {c.heroImage && (
          <div className="about-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.heroImage} alt={c.siteName} />
          </div>
        )}
      </div>

      {experience.length > 0 && (
        <section className="experience" id="experience">
          <h2>Experience</h2>
          <div className="exp-list">
            {experience.map((job, i) => (
              <article className="exp-item" key={i}>
                <div className="exp-meta">
                  <span className="exp-date">{job.dates}</span>
                  <span className="exp-company">{job.company}</span>
                </div>
                <div className="exp-detail">
                  <h3>{job.title}</h3>
                  <ul>
                    {(job.bullets || []).map((b, k) => <li key={k}>{b}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          {edu.school && (
            <div className="education">
              <h3 className="edu-title">{about.educationTitle || "Education"}</h3>
              <p>
                <strong>{edu.degree}</strong>, {edu.school}{edu.year ? ` (${edu.year})` : ""}
                {edu.details ? ` — ${edu.details}` : ""}
              </p>
            </div>
          )}
        </section>
      )}

      {skills.length > 0 && (
        <>
          <hr className="divider" />
          <section className="skills" id="skills">
            <h2>{about.skillsTitle || "Skills"}</h2>
            <dl className="skills-list">
              {skills.map((s, i) => (
                <div className="skill-row" key={i}>
                  <dt>{s.group}</dt>
                  <dd>{s.items}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
      <div style={{ height: "4rem" }} />
    </>
  );
}
