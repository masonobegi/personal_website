import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { getContent } from "@/lib/contentStore";
import { getProject } from "@/lib/projectsStore";
import { getRedirect } from "@/lib/redirectsStore";
import { breadcrumbLd, buildMetadata, plainText, SITE_URL } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [p, c] = await Promise.all([getProject(slug), getContent()]);
  if (!p || p.published === false) {
    return { title: { absolute: `Not found | ${c.siteName}` }, robots: { index: false } };
  }
  return buildMetadata({
    path: `/projects/${slug}`,
    title: `${p.title} | ${c.siteName}`,
    exactTitle: true,
    description: p.description,
    image: p.image || undefined,
    firm: c.siteName,
  });
}

export default async function ProjectDetail({ params }) {
  const { slug } = await params;
  const [p, c] = await Promise.all([getProject(slug), getContent()]);
  if (!p || p.published === false) {
    const to = await getRedirect(`/projects/${slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }

  const live = p.liveUrl && p.liveUrl.startsWith("http") ? p.liveUrl : "";
  const code = p.codeUrl && p.codeUrl.startsWith("http") ? p.codeUrl : "";

  return (
    <>
      <JsonLd data={breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Projects", path: "/projects" },
        { name: p.title, path: `/projects/${slug}` },
      ])} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": `${SITE_URL}/projects/${slug}#work`,
        name: plainText(p.title),
        description: plainText(p.description),
        url: `${SITE_URL}/projects/${slug}`,
        image: p.image ? (p.image.startsWith("http") ? p.image : `${SITE_URL}${p.image}`) : undefined,
      }} />

      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <Link href="/projects" className="card-cta" style={{ display: "inline-block", marginBottom: 18 }}>← Back to projects</Link>
          <div className="eyebrow">{p.category}{p.status ? ` · ${p.status}` : ""}</div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", marginTop: 8 }}>{p.title}</h1>
          {p.description && <p className="lead" style={{ marginTop: 14 }}>{p.description}</p>}

          <div className="btn-row" style={{ marginTop: 20 }}>
            {live && <a href={live} target="_blank" rel="noopener noreferrer" className="btn btn-ember">{p.liveLabel || "Visit live site ↗"}</a>}
            {code && <a href={code} target="_blank" rel="noopener noreferrer" className="btn btn-outline">View code ↗</a>}
          </div>

          {/* Long write-up */}
          {Array.isArray(p.long) && p.long.length > 0 && (
            <div style={{ marginTop: 34 }}>
              {p.long.map((para, i) => (
                <p key={i} className="muted" style={{ marginTop: i === 0 ? 0 : 14, fontSize: 17, lineHeight: 1.65 }}>{fmt(para)}</p>
              ))}
            </div>
          )}

          {/* Tools */}
          {Array.isArray(p.tools) && p.tools.length > 0 && (
            <p className="card-meta" style={{ marginTop: 26 }}>
              <strong style={{ color: "var(--ink)" }}>Built with:</strong> {p.tools.join(", ")}
            </p>
          )}

          {/* Gallery */}
          {Array.isArray(p.gallery) && p.gallery.length > 0 && (
            <div style={{ marginTop: 36, display: "grid", gap: 34 }}>
              {p.gallery.map((g, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.src} alt={g.caption || ""} loading="lazy" style={{ width: "100%", borderRadius: 10, display: "block", border: "1px solid var(--line)" }} />
                  {g.caption && <figcaption className="muted" style={{ marginTop: 10, fontSize: 15 }}>{g.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
