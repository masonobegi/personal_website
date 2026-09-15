import { PlaceholderInline } from "@/components/Placeholder";
import { formatText } from "@/lib/formatText";

// Minimal interior page header (matches the static site): title + lead, no
// hero band, no scroll cue.
export function PageHero({ eyebrow, title, sub }) {
  return (
    <section style={{ paddingTop: "3rem" }}>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: "0.5rem" }}>{eyebrow}</div>}
      <h1 className="page-title">{formatText(title)}</h1>
      {sub && <p className="page-lead">{formatText(sub)}</p>}
    </section>
  );
}

// Left-aligned section heading (matches the static site's .section-head).
export function SectionHead({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: sub ? "1.25rem" : "2rem" }}>
      <div className="section-head" style={{ marginBottom: sub ? "0.5rem" : "2rem" }}>
        <h2>{formatText(title)}</h2>
      </div>
      {sub && <p className="page-lead" style={{ marginBottom: 0 }}>{formatText(sub)}</p>}
    </div>
  );
}

export { PlaceholderInline };
