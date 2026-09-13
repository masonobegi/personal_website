import RichText from "@/components/RichText";
import SmartImage from "@/components/SmartImage";
import { PlayBadge } from "@/components/ArticleCover";
import { formatText as fmt } from "@/lib/formatText";

// Stable anchor ids for an article's section headings ("#build-the-exposure-map"),
// shared by the headings themselves and the table of contents.
export function headingAnchors(blocks = []) {
  const used = new Map();
  return blocks.map((b) => {
    if (b.type !== "heading") return null;
    const base =
      String(b.text || "")
        .toLowerCase()
        .replace(/\*+/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "section";
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A thumbnail card that opens a video on LinkedIn (or wherever it's hosted).
// Videos are never uploaded to or played on this site.
export function VideoLinkCard({ url, title, thumbnail, compact = false }) {
  const host = hostOf(url);
  const onLinkedIn = /linkedin\.com$/.test(host);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="video-card"
      style={{
        display: "block",
        margin: compact ? 0 : "30px 0",
        border: "1px solid var(--line)",
        background: "#fff",
        textDecoration: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--forest)" }}>
        {thumbnail ? (
          <SmartImage src={thumbnail} alt={title || "Video thumbnail"} fill sizes="(max-width: 860px) 100vw, 760px" />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #14201a 0%, #24382b 100%)",
            }}
          />
        )}
        <PlayBadge size={72} />
      </div>
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "var(--ink)" }}>
          {title ? fmt(title) : "Watch the video"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ember)",
            whiteSpace: "nowrap",
          }}
        >
          {onLinkedIn ? "Watch on LinkedIn ↗" : `Watch on ${host || "the source"} ↗`}
        </span>
      </div>
    </a>
  );
}

// Renders an article's ordered blocks: section headings, text (paragraphs,
// lists, links, **bold**), figures with captions, and video link cards.
export default function ArticleBody({ blocks = [] }) {
  const anchors = headingAnchors(blocks);
  return (
    <div className="article-body">
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const Tag = b.level === 3 ? "h3" : "h2";
          return (
            <Tag key={i} id={anchors[i]} className={b.level === 3 ? "ab-h3" : "ab-h2"}>
              {fmt(b.text)}
            </Tag>
          );
        }
        if (b.type === "image") {
          return (
            <figure key={i} style={{ margin: "30px 0" }}>
              <SmartImage
                src={b.src}
                // Falling back to the caption made a screen reader read the
                // same sentence twice: once as the picture, once as the
                // caption below it. An empty alt with a caption present is
                // correct — the caption is the description.
                alt={b.alt || ""}
                width={b.width}
                height={b.height}
                sizes="(max-width: 860px) 100vw, 760px"
                style={{ borderRadius: 2 }}
              />
              {b.caption && (
                <figcaption
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: "var(--ink-soft)",
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  {b.caption}
                </figcaption>
              )}
            </figure>
          );
        }
        if (b.type === "video") {
          return <VideoLinkCard key={i} url={b.url} title={b.title} thumbnail={b.thumbnail} />;
        }
        return (
          <RichText
            key={i}
            text={b.text}
            style={{ fontSize: 18.5, lineHeight: 1.75, color: "var(--ink)", margin: "0 0 1.1em" }}
            pStyle={{ margin: "0 0 1.1em" }}
          />
        );
      })}
    </div>
  );
}
