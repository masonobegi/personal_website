import { PageHero } from "@/components/ui";
import ContactForm from "@/components/ContactForm";
import { getContent } from "@/lib/contentStore";
import { buildMetadata } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.contact || {};
  return buildMetadata({ path: "/contact", title: p.title || "Contact", description: p.description, firm: c.siteName });
}

export default async function ContactPage() {
  const c = await getContent();
  const ct = c.contact || {};

  return (
    <>
      <PageHero eyebrow="Contact" title={ct.heroTitle || "Get In Touch"} sub={ct.heroSub} />
      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container grid-2" style={{ alignItems: "start", gap: 48 }}>
          <div>
            <h2 style={{ fontSize: "1.5rem" }}>{ct.noteHeading || "Send a message"}</h2>
            {ct.noteBody && <p className="muted" style={{ marginTop: 8, marginBottom: 18 }}>{fmt(ct.noteBody)}</p>}
            <ContactForm source="contact" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.5rem" }}>Or reach me directly</h2>
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {c.email && <a href={`mailto:${c.email}`} style={{ color: "var(--ember)", fontWeight: 600 }}>{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`} style={{ color: "var(--ink)" }}>{c.phone}</a>}
              {c.githubUrl && <a href={c.githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)" }}>GitHub ↗</a>}
              {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)" }}>LinkedIn ↗</a>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
