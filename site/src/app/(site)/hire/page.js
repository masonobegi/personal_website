import Link from "next/link";
import { getContent } from "@/lib/contentStore";
import { getPublishedProjects } from "@/lib/projectsStore";
import ProjectCard from "@/components/ProjectCard";
import { SectionHead } from "@/components/ui";
import { buildMetadata } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.hire || {};
  return buildMetadata({ path: "/hire", title: p.title || "Work With Me", description: p.description, firm: c.siteName });
}

export default async function HirePage() {
  const [c, projects] = await Promise.all([getContent(), getPublishedProjects().catch(() => [])]);
  const h = c.hire || {};
  const bookHref = h.bookingUrl && h.bookingUrl.startsWith("http") ? h.bookingUrl : "/contact";
  const work = projects.filter((p) => (p.category || "").toLowerCase().includes("client")).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="hero hero-home">
        <div className="container hero-inner">
          <div className="eyebrow" style={{ color: "var(--brass-soft)" }}>{h.eyebrow}</div>
          <h1>{fmt(h.heroTitle)}</h1>
          <p className="hero-body" style={{ marginTop: 16 }}>{fmt(h.heroBody)}</p>
          <div className="btn-row">
            <a href={bookHref} className="btn btn-ember" {...(bookHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Book a free 20-min call →</a>
            <Link href="#work" className="btn btn-ghost-light">See my work</Link>
          </div>
          {h.heroNote && <p className="muted" style={{ marginTop: 14, color: "#c9c3b3" }}>{h.heroNote}</p>}
        </div>
      </section>

      {/* Pillars */}
      {Array.isArray(h.pillars) && h.pillars.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container">
            <SectionHead eyebrow={h.pillarsEyebrow} title={h.pillarsTitle} />
            <div className="grid-3">
              {h.pillars.map((p, i) => (
                <div key={i} className="card">
                  <h3>{fmt(p.title)}</h3>
                  <p className="muted" style={{ marginTop: 10 }}>{fmt(p.body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {Array.isArray(h.packages) && h.packages.length > 0 && (
        <section className="section" style={{ background: "var(--cream-deep)" }}>
          <div className="container">
            <SectionHead eyebrow={h.pricingEyebrow} title={h.pricingTitle} sub={h.pricingSub} />
            <div className="grid-3">
              {h.packages.map((pk, i) => (
                <div key={i} className="card" style={pk.featured ? { borderColor: "var(--ember)", boxShadow: "0 8px 30px rgba(0,0,0,0.08)" } : undefined}>
                  {pk.featured && <div className="eyebrow" style={{ color: "var(--ember)" }}>Most popular</div>}
                  <h3>{fmt(pk.name)}</h3>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "6px 0" }}>{fmt(pk.price)}</p>
                  <p className="muted" style={{ fontSize: 15 }}>{fmt(pk.for)}</p>
                  <ul className="qlist" style={{ marginTop: 14 }}>
                    {(pk.features || []).map((f, k) => <li key={k}>{f}</li>)}
                  </ul>
                  <a href={bookHref} className={pk.featured ? "btn btn-ember" : "btn btn-outline"} style={{ marginTop: 16 }} {...(bookHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Get started</a>
                </div>
              ))}
            </div>
            {h.carePlan && (
              <div className="card" style={{ marginTop: 20, borderStyle: "dashed" }}>
                <strong>{h.carePlan}</strong>
                <p className="muted" style={{ marginTop: 6 }}>{fmt(h.carePlanBody)}</p>
              </div>
            )}
            {h.priceNote && <p className="muted" style={{ marginTop: 14, fontStyle: "italic", fontSize: 14.5 }}>{fmt(h.priceNote)}</p>}
          </div>
        </section>
      )}

      {/* Process */}
      {Array.isArray(h.process) && h.process.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container">
            <SectionHead eyebrow={h.processEyebrow} title={h.processTitle} />
            <div className="grid-3">
              {h.process.map((s, i) => (
                <div key={i} className="step">
                  <span className="step-n" style={{ color: "var(--ember)" }}>{s.n}</span>
                  <div>
                    <h3>{fmt(s.title)}</h3>
                    <p className="muted" style={{ marginTop: 4 }}>{fmt(s.body)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Work */}
      {work.length > 0 && (
        <section className="section" id="work" style={{ background: "var(--cream-deep)" }}>
          <div className="container">
            <SectionHead eyebrow={h.workEyebrow} title={h.workTitle} sub={h.workSub} />
            <div className="grid-3">
              {work.map((p) => <ProjectCard key={p.slug} project={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {Array.isArray(h.faq) && h.faq.length > 0 && (
        <section className="section" style={{ background: "var(--cream)" }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <SectionHead eyebrow={h.faqEyebrow} title={h.faqTitle} />
            <div style={{ display: "grid", gap: 6 }}>
              {h.faq.map((f, i) => (
                <details key={i} style={{ borderBottom: "1px solid var(--line)", padding: "14px 0" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
                  <p className="muted" style={{ marginTop: 8 }}>{fmt(f.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section" style={{ background: "var(--cream-deep)", borderTop: "1px solid var(--line)", textAlign: "center" }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)" }}>{fmt(h.ctaTitle)}</h2>
          {h.ctaBody && <p className="muted" style={{ marginTop: 12 }}>{fmt(h.ctaBody)}</p>}
          <div className="btn-row" style={{ justifyContent: "center", marginTop: 22 }}>
            <a href={bookHref} className="btn btn-ember" {...(bookHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Book a free 20-min call →</a>
          </div>
        </div>
      </section>
    </>
  );
}
