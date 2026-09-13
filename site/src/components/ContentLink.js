import Link from "next/link";

// An optional admin-authored "read more" link. Handles internal routes,
// in-page anchors, and external URLs, picking the right element for each.

// Whether a "read more" destination is a real address. Three links went live
// on /nike and /intel pointing at the literal word "Placeholder", so every
// "Read the article" button on those pages 404'd. A bare word is a field
// somebody meant to come back to — better to show the text without a link
// than to send a reader to a missing page.
function isRealDestination(href) {
  const h = String(href || "").trim();
  if (!h) return false;
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(h)) return true;
  return h.includes("/"); // a relative path like "library/nike-espp"
}

export default function ContentLink({ href, label, style }) {
  if (!href || !label) return null;
  if (!isRealDestination(href)) return null;

  const base = {
    display: "inline-block",
    marginTop: 14,
    color: "var(--ember)",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.03em",
    ...style,
  };

  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={base}>
        {label} ↗
      </a>
    );
  }
  // In-page anchors and mailto/tel don't need client routing.
  if (/^[#]|^(mailto:|tel:)/i.test(href)) {
    return (
      <a href={href} style={base}>
        {label} →
      </a>
    );
  }
  return (
    <Link href={href} style={base}>
      {label} →
    </Link>
  );
}
