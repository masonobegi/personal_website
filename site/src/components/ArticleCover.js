import SmartImage from "@/components/SmartImage";

// Article cover image. When an article has no thumbnail, renders an elegant
// branded panel (deep-forest gradient + brass monogram) instead of an empty
// block, so the Library grid always looks intentional and professional.
// `video` adds a play badge so video cards read as videos at a glance.
export default function ArticleCover({
  thumbnail,
  alt = "",
  height = 200,
  video = false,
  sizes = "(max-width: 860px) 100vw, 380px",
  priority = false,
}) {
  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", flexShrink: 0 }}>
      {thumbnail ? (
        <SmartImage src={thumbnail} alt={alt} fill sizes={sizes} priority={priority} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #14201a 0%, #24382b 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: Math.round(height * 0.34),
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "#c2ab7e",
              lineHeight: 1,
            }}
          >
            OLP
          </span>
        </div>
      )}
      {video && <PlayBadge />}
    </div>
  );
}

export function PlayBadge({ size = 62 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(20, 32, 26, 0.72)",
        border: "1.5px solid rgba(244, 239, 226, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
      }}
    >
      <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 20 20">
        <path d="M6 3.5 L17 10 L6 16.5 Z" fill="#f4efe2" />
      </svg>
    </span>
  );
}
