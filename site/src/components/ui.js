import { PlaceholderInline } from "@/components/Placeholder";
import { formatText } from "@/lib/formatText";
import ScrollCue from "@/components/ScrollCue";

// Compact forest hero for interior pages. Spacing and the title measure live in
// CSS (see .hero-inner in globals.css) so they can tighten on short screens —
// inline styles can't be overridden by a media query.
export function PageHero({ eyebrow, title, sub }) {
  return (
    <section className="hero">
      <div className="container hero-inner">
        {eyebrow && (
          <div className="eyebrow" style={{ color: "var(--brass-soft)" }}>
            {eyebrow}
          </div>
        )}
        <h1 className="hero-title">{formatText(title)}</h1>
        {sub && <p className="hero-body">{formatText(sub)}</p>}
      </div>
      <ScrollCue />
    </section>
  );
}

// Centered section heading.
export function SectionHead({ eyebrow, title, sub, align = "center" }) {
  return (
    <div
      style={{
        textAlign: align,
        // Wide enough that section intros stay short vertically, so the content
        // below them (photos, cards) comes into view sooner.
        maxWidth: align === "center" ? "64ch" : "none",
        marginInline: align === "center" ? "auto" : 0,
        marginBottom: 44,
      }}
    >
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2
        style={{
          fontSize: "clamp(2rem, 4vw, 2.9rem)",
          marginTop: eyebrow ? 12 : 0,
        }}
      >
        {formatText(title)}
      </h2>
      {sub && (
        <p className="lead" style={{ marginTop: 16 }}>
          {formatText(sub)}
        </p>
      )}
    </div>
  );
}

export { PlaceholderInline };
