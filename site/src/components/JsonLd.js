import { scriptNonce } from "@/lib/nonce";

// Emits a block of JSON-LD structured data. Server-rendered, so search engines
// and AI crawlers see it in the initial HTML.
//
// "<" is escaped so text containing "</script>" (a title, an FAQ answer) can
// never end the script tag early.
export function jsonLdString(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function JsonLd({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      nonce={await scriptNonce()}
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
