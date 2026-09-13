import { SITE_URL as BASE } from "@/lib/seo";

// Crawlers used by AI answer engines (ChatGPT, Claude, Perplexity, Gemini,
// Copilot). Listing them explicitly makes it unambiguous that the site's
// public content may be read and cited.
//
// GPTBot, Google-Extended, Applebot-Extended, and CCBot gather material for
// training AI models rather than for search. Allowing them is a business
// decision, not an SEO one: disallowing them does NOT remove the site from
// ChatGPT search (OAI-SearchBot) or Google search (Googlebot).
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Bingbot",
  "CCBot",
];

export default function robots() {
  return {
    rules: [
      // /admin is NOT listed here on purpose. It used to be, which named the
      // path in a file anyone can read while also stopping Google from ever
      // fetching the page and seeing the "noindex" it already serves — so the
      // address was advertised and the instruction never arrived.
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/"],
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
