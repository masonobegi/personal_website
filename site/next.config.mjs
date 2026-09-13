/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Segment pages are now served directly at /<slug> (e.g. /nike). Old
  // /professionals/<slug> links are redirected by the route itself.

  // Put every page's <title>, canonical, and share tags in the <head> for every
  // visitor. By default Next streams them into the body for anything it doesn't
  // recognise as a bot, which SEO audit tools, LinkedIn's link preview, and the
  // newer AI crawlers can all miss. Every page here waits on the database
  // anyway, so streaming bought nothing.
  htmlLimitedBots: /.*/,

  // mammoth and unpdf (Word/PDF import) are server-only and large; keep them
  // out of the bundler and load them from node_modules at runtime.
  serverExternalPackages: ["mammoth", "unpdf", "word-list"],

  // Files under /public are served with no caching at all by default, so the
  // hero photo — the biggest thing on every page — was re-validated on every
  // navigation. The sized variants have the dimensions in their names, so a
  // different photo means a different file and they can be cached forever.
  // hero.jpg keeps the name it has always had and can be replaced in place,
  // so it gets a day, and may be served stale while it re-checks.
  // The share card used to be a PNG. LinkedIn, Facebook and anything else that
  // cached the old address should still find the picture.
  async redirects() {
    return [
      { source: "/og-image.png", destination: "/og-image.jpg", permanent: true },
      // Specialty pages moved to /<slug> some time ago. These were answered by
      // a page that booted a full server render just to emit a temporary
      // redirect, which tells a search engine the old address is still the
      // real one and to keep checking it. Permanent, and settled at the
      // routing layer before anything renders.
      { source: "/professionals/:slug", destination: "/:slug", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        // The site sent no security headers at all. None of these change how
        // the site behaves; they tell the browser not to guess content types,
        // not to leak the full URL to other sites, to stay on HTTPS, and not
        // to let another site frame our pages.
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
      {
        source: "/:file(hero-1920.webp|hero-1920.jpg|hero-1080.webp|hero-1080.jpg|logo-512.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Both are rebuilt from a full scan of every article on each request.
        // Nothing in them changes more than a few times a day, so a CDN can
        // hold them — see the note in llms.txt about the zone setting.
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/og-image.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/hero.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
