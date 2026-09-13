// Loud, obvious placeholder wrappers so nothing accidentally ships to
// production looking finished. Every real asset the client still owes us
// should be wrapped in one of these.

export function PlaceholderBanner({ children, style }) {
  return (
    <div
      className="ph"
      style={{ padding: "18px 20px", borderRadius: 2, ...style }}
    >
      <span className="ph-badge">⚠ Placeholder</span>{" "}
      <span className="ph-note">{children}</span>
    </div>
  );
}

// A boxed placeholder that fills a slot (e.g. a headshot or embedded map).
export function PlaceholderBox({ label, height = 240, style }) {
  return (
    <div
      className="ph"
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
        padding: 18,
        borderRadius: 2,
        ...style,
      }}
    >
      <span className="ph-badge">⚠ Placeholder</span>
      <span className="ph-note">{label}</span>
    </div>
  );
}

// Inline placeholder for a bit of text (e.g. a phone number or email).
export function PlaceholderInline({ children }) {
  return (
    <span
      style={{
        background: "rgba(216,27,140,0.12)",
        border: "1px dashed #d81b8c",
        color: "#a01268",
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 2,
        fontSize: "0.9em",
      }}
    >
      {children}
    </span>
  );
}
