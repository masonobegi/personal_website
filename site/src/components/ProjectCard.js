import Link from "next/link";

// Project card matching the static site's .card / .thumb / .card-body markup.
export default function ProjectCard({ project: p, showFeatured = false }) {
  return (
    <Link href={`/projects/${p.slug}`} className={`card card-linked${p.featured ? " is-featured" : ""}`}>
      <div className="thumb">
        <span className="thumb-placeholder">Screenshot coming soon</span>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={`${p.title} screenshot`} loading="lazy" />
        ) : null}
        {showFeatured && p.featured ? <span className="thumb-badge">Featured</span> : null}
      </div>
      <div className="card-body">
        <div className="card-title">
          <h3>{p.title}</h3>
          {p.status ? <span className="status-note">{p.status}</span> : null}
        </div>
        {p.description ? <p className="desc">{p.description}</p> : null}
        {Array.isArray(p.tags) && p.tags.length > 0 ? (
          <p className="card-tags">{p.tags.join(", ")}</p>
        ) : null}
      </div>
    </Link>
  );
}
