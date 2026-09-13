import Link from "next/link";

// A project card for the home grid and the Projects page.
export default function ProjectCard({ project: p }) {
  return (
    <Link
      href={`/projects/${p.slug}`}
      className="card"
      style={{ background: "#fff", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", background: "var(--cream-deep, #ece7db)", overflow: "hidden" }}>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        ) : null}
      </div>
      <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <h3 style={{ fontSize: "1.25rem", lineHeight: 1.25 }}>
          {p.title}
          {p.status ? <span className="card-meta" style={{ marginLeft: 8 }}>· {p.status}</span> : null}
        </h3>
        {p.description ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 16, lineHeight: 1.5 }}>{p.description}</p>
        ) : null}
        {Array.isArray(p.tags) && p.tags.length > 0 && (
          <p className="card-meta" style={{ marginTop: "auto", paddingTop: 14 }}>{p.tags.join(", ")}</p>
        )}
      </div>
    </Link>
  );
}
