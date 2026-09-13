import { PageHero, SectionHead } from "@/components/ui";
import CTABand from "@/components/CTABand";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/contentStore";
import { formatText as fmt } from "@/lib/formatText";
import { breadcrumbLd, buildMetadata, plainText, ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.about || {};
  return buildMetadata({
    path: "/about",
    title: p.title || "About",
    description: p.description,
    firm: c.siteName,
  });
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
      <PageHero eyebrow="About" title={about.heroTitle || "About"} />

      {/* Story */}
      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {(about.body || []).map((para, i) => (
            <p key={i} className={i === 0 ? "lead" : "muted"} style={{ marginTop: i === 0 ? 0 : 16 }}>
              {fmt(para)}
            </p>
          ))}
        </div>
      </section>

      {/* Experience */}
      {experience.length > 0 && (
        <section className="section" style={{ background: "var(--cream-deep)" }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <SectionHead eyebrow="Experience" title="Where I've worked" />
            <div style={{ display: "grid", gap: 32 }}>
              {experience.map((job, i) => (
                <div key={i}>
                  <h3 style={{ fontSize: "1.35rem" }}>{job.title} · {job.company}</h3>
                  <p className="card-meta">{job.dates}</p>
                  <ul className="qlist" style={{ marginTop: 12 }}>
                    {(job.bullets || []).map((b, k) => <li key={k}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <SectionHead eyebrow="Skills" title={about.skillsTitle || "Technical Skills"} />
            <div style={{ display: "grid", gap: 12 }}>
              {skills.map((s, i) => (
                <p key={i} style={{ fontSize: 16.5 }}>
                  <strong>{s.group}:</strong> <span className="muted">{s.items}</span>
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Education */}
      {edu.school && (
        <section className="section" style={{ background: "var(--cream-deep)" }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <SectionHead eyebrow="Education" title={about.educationTitle || "Education"} />
            <h3 style={{ fontSize: "1.35rem" }}>{edu.school} {edu.year ? <span className="card-meta">· {edu.year}</span> : null}</h3>
            <p className="muted" style={{ marginTop: 6 }}>{edu.degree}</p>
            {edu.details && <p className="muted" style={{ marginTop: 6 }}>{edu.details}</p>}
          </div>
        </section>
      )}

      <CTABand title="Get in touch." />
    </>
  );
}
