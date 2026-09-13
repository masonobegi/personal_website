import React from "react";
import Link from "next/link";

// Inline text formatting the admin can type into any content field:
//   **bold**      -> bold
//   *italic*      -> italic
//   ***both***    -> bold + italic
//   [label](url)  -> a link (only where `links` is enabled — body text, not
//                    titles, since titles often sit inside a link already)
// Returns an array of React nodes (safe — never raw HTML). Newlines are handled
// separately by CSS (white-space) / the RichText paragraph splitter.

const TOKEN = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
const TOKEN_WITH_LINKS =
  /(\[[^\]\n]+\]\([^)\s]+\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;

// Only ordinary destinations: site paths, anchors, web, email, phone. Anything
// else (javascript:, data:) renders as plain text.
const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;

function linkNode(label, href, key) {
  if (!SAFE_HREF.test(href)) return React.createElement(React.Fragment, { key }, label);
  if (/^https?:\/\//i.test(href)) {
    return React.createElement(
      "a",
      { key, href, target: "_blank", rel: "noopener noreferrer", className: "rt-link" },
      label
    );
  }
  if (/^(#|mailto:|tel:)/i.test(href)) {
    return React.createElement("a", { key, href, className: "rt-link" }, label);
  }
  return React.createElement(Link, { key, href, className: "rt-link" }, label);
}

export function formatText(text, { links = false } = {}) {
  const str = String(text ?? "");
  if (!str.includes("*") && !(links && str.includes("]("))) return str; // fast path
  return str.split(links ? TOKEN_WITH_LINKS : TOKEN).map((part, i) => {
    if (!part) return null;
    let m;
    if (links && (m = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(part))) {
      return linkNode(m[1], m[2], i);
    }
    if ((m = /^\*\*\*([^*]+)\*\*\*$/.exec(part))) {
      return React.createElement(
        "strong",
        { key: i },
        React.createElement("em", null, m[1])
      );
    }
    if ((m = /^\*\*([^*]+)\*\*$/.exec(part))) {
      return React.createElement("strong", { key: i }, m[1]);
    }
    if ((m = /^\*([^*]+)\*$/.exec(part))) {
      return React.createElement("em", { key: i }, m[1]);
    }
    return React.createElement(React.Fragment, { key: i }, part);
  });
}
