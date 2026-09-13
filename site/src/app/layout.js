import "./globals.css";
import Tracking from "@/components/Tracking";
import { jsonLdString } from "@/components/JsonLd";
import { site } from "@/lib/site";
import { getContent } from "@/lib/contentStore";
import {
  SITE_URL,
  ORG_ID,
  WEBSITE_ID,
  LOGO_URL,
  DEFAULT_SHARE_IMAGE,
  absoluteUrl,
  e164Phone,
  plainText,
  streetOnly,
} from "@/lib/seo";
import { scriptNonce } from "@/lib/nonce";
import HeroPreload from "@/components/HeroPreload";

// Render at request time (never at build) so content is read live from the DB
// and the build never depends on the database being reachable.
export const dynamic = "force-dynamic";

// Site-wide defaults only. Deliberately NO canonical, og:url, description, or
// share image here: metadata merges shallowly, so anything set at the root is
// inherited by every page that doesn't override it — which is how every page
// once told Google it was a duplicate of the homepage. Each page builds its own
// complete metadata with buildMetadata() in lib/seo.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: site.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({ children }) {
  const content = await getContent();
  const areas = (content.seo?.areas || []).map((a) => String(a).trim()).filter(Boolean);

  // Site-wide structured data. Gives Google and AI answer engines a clean,
  // machine-readable description of the firm, what it offers, and who it
  // serves. Every other page's schema points back to these two @ids.
  const sameAs = [content.githubUrl, content.linkedinUrl].filter((u) => u && u.startsWith("http"));
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": ORG_ID,
    name: content.siteName,
    description: plainText(content.seo?.description) || undefined,
    url: SITE_URL,
    image: absoluteUrl(DEFAULT_SHARE_IMAGE.url),
    jobTitle: content.role || undefined,
    email: content.email || undefined,
    telephone: e164Phone(content.phone) || undefined,
    address: content.location
      ? { "@type": "PostalAddress", addressLocality: content.location, addressCountry: "US" }
      : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    knowsAbout: [
      "Software engineering",
      "Full-stack web development",
      "TypeScript",
      "React and Next.js",
      "Node.js",
      "PostgreSQL",
      "Real-time multiplayer games",
      "Data analytics",
      "Machine learning",
    ],
  };

  // Tells Google the site's name (shown above results) and who publishes it.
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: content.siteName,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };

  // The committed hero ships in four versions: WebP and JPEG, at 1920 and
  // 1080 wide. The original was a 4032px camera export weighing 1.06 MB, and
  // because it is a CSS background it never went through the image optimizer
  // the rest of the site's images use — so a phone downloaded all of it.
  // image-set lets the browser take the smallest one it can read.
  const nonce = await scriptNonce();
  const hasHero = Boolean(content.heroImage);
  const isDefaultHero = false;
  const heroCss = hasHero ? `url("${content.heroImage}")` : "none";
  const heroCssSm = heroCss;
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: jsonLdString(orgLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: jsonLdString(websiteLd) }}
        />
        {/* Fonts loaded via link (with strong serif fallback) so the build
            never depends on a font fetch. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ "--hero-image": heroCss, "--hero-image-sm": heroCssSm }}>
        {/* Both the ordinary pages and the ad landing pages paint this
            photograph — the landing pages through .lp-main rather than .hero,
            which is easy to miss. It is announced here so both get it. */}
        <HeroPreload isDefaultHero={isDefaultHero} custom={content.heroImage} />
        {children}
        <Tracking tracking={content.tracking} />
      </body>
    </html>
  );
}
