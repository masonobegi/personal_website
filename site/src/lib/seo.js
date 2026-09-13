export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://masonobegi.com"
).replace(/\/$/, "");

// Stable identifiers for the firm and the site in structured data, so every
// page's schema can point at the same entity instead of redefining it.
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

// The default social-share image, used when a page has no image of its own.
// The card shown when a page is shared. Was a 1.8 MB PNG with no transparency
// in it; the same picture as a JPEG is 133 KB.
export const DEFAULT_SHARE_IMAGE = { url: "/og-image.png", width: 1200, height: 630 };

// Brand mark for structured data (Organization.logo / Article.publisher).
// Google will not use a logo in a search result below 112px, and it does not
// read SVG for this. icon.svg is still the favicon; this is the raster copy
// that goes into the structured data.
export const LOGO_URL = `${SITE_URL}/logo.png`;

export function absoluteUrl(pathOrUrl) {
  const v = String(pathOrUrl || "");
  if (/^https?:\/\//i.test(v)) return v;
  if (!v || v === "/") return SITE_URL;
  return `${SITE_URL}${v.startsWith("/") ? v : `/${v}`}`;
}

// Removes the **bold** / *italic* markers the admin types, and [label](url)
// links, leaving plain text suitable for a <title> or description.
export function plainText(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const TRAILING_FILLER = /[\s,;:–—-]+(?:and|or|the|a|an|to|of|for|with|in|on|at|by)?$/i;

// Shortens text to `max` characters on a word boundary. Search engines cut a
// long description off wherever it hits their limit — often mid-word — so it
// reads far better to end it ourselves.
export function clampText(text, max, { ellipsis = true } = {}) {
  const s = plainText(text);
  if (s.length <= max) return s;
  let cut = s.slice(0, max - (ellipsis ? 1 : 0));
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  // Don't end on a dangling "and", "the", or a comma.
  for (let i = 0; i < 3; i++) cut = cut.replace(TRAILING_FILLER, "");
  return ellipsis ? `${cut}…` : cut;
}

// Search results show roughly 60 characters of a title. Adds the firm name
// when it fits; a long article title stands better on its own (Google shows
// the site name separately above the result anyway).
export function composeTitle(title, firm, max = 65) {
  const t = plainText(title).replace(/\s+-\s+/g, ": ");
  if (!firm) return clampText(t, max, { ellipsis: false });
  if (`${t} | ${firm}`.length <= max) return `${t} | ${firm}`;
  if (t.length <= max) return t;
  // Too long even on its own. End with an ellipsis rather than stopping at a
  // word boundary, which reads as a complete — but different — title.
  return clampText(t, max, { ellipsis: true });
}

// Complete metadata for one page. Metadata in Next.js merges shallowly, so a
// page that sets only a title inherits the root layout's canonical and share
// tags wholesale — which is how every page on the site came to tell Google it
// was a copy of the homepage. Pages build their metadata here instead, so the
// canonical, Open Graph, and Twitter tags always describe the page itself.
//
//   path         site-relative path, e.g. "/about" (also the canonical)
//   title        page title; composed with the firm name unless `exactTitle`
//   description  meta description (clamped to ~158 characters)
//   image        share image: { url, width?, height?, alt? } or a URL string
//   type         "website" | "article" | "profile"
//   noindex      keep the page out of search results (still follows links)
export function buildMetadata({
  path = "/",
  title,
  exactTitle = false,
  description,
  image,
  type = "website",
  noindex = false,
  firm = "Oswego Legacy Partners",
  article,
} = {}) {
  const fullTitle = exactTitle ? plainText(title) : composeTitle(title, firm);
  const desc = description ? clampText(description, 158) : undefined;
  const url = absoluteUrl(path);

  const img = typeof image === "string" ? { url: image } : image || null;
  // Only real, fetchable URLs are usable as a share image. A legacy base64
  // data URL would make LinkedIn and iMessage show nothing at all.
  const shareImage =
    img && /^(https?:|\/)/.test(img.url) && !img.url.startsWith("//")
      ? img
      : DEFAULT_SHARE_IMAGE;
  const ogImage = {
    url: absoluteUrl(shareImage.url),
    ...(shareImage.width ? { width: shareImage.width, height: shareImage.height } : {}),
    alt: shareImage.alt || plainText(title) || firm,
  };

  return {
    title: { absolute: fullTitle },
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: firm,
      locale: "en_US",
      title: fullTitle,
      description: desc,
      images: [ogImage],
      ...(type === "article" && article
        ? {
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            authors: article.authors,
            tags: article.tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: [ogImage.url],
    },
    ...(noindex
      ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
      : {}),
  };
}

// BreadcrumbList structured data. Google uses it to show a page's position in
// the site hierarchy instead of a bare URL in search results.
// items: [{ name, path }] — path is site-relative, e.g. "/library".
export function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: plainText(item.name),
      item: absoluteUrl(item.path),
    })),
  };
}

// "Jonathan Leslie, CFP®" → { name: "Jonathan Leslie", suffix: "CFP®" }.
// Structured data wants the person's name alone, with designations separate.
export function splitCredentials(fullName) {
  const [name, ...rest] = String(fullName || "").split(",");
  return { name: name.trim(), suffix: rest.join(",").trim() };
}

// Anchor id for an advisor on the About page, e.g. "jonathan-leslie".
export function personAnchor(name) {
  return splitCredentials(name)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parses an admin-typed display date ("July 23, 2026") into an ISO string for
// structured data. Returns undefined rather than inventing a date.
export function isoDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Human date for display. Free text the admin typed ("July 23, 2026") is shown
// exactly as typed; only machine dates are formatted. A date-only value is read
// as UTC so it can't slip to the previous day on a server in another zone.
export function displayDate(value) {
  if (!value) return "";
  const s = String(value);
  const opts = { year: "numeric", month: "long", day: "numeric" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { ...opts, timeZone: "America/Los_Angeles" });
    }
  }
  return s;
}

// One description of an advisor, used by both the About page and the Legacy
// Trilogy page. They used to build their own, and published the same @id with
// a different job title, a different credential string, a relative image and a
// different employer shape — which tells a search engine that two different
// people share one identity.
export function personLd(member, { description } = {}) {
  const { name, suffix } = splitCredentials(member.name || "");
  const creds = [suffix, member.credentials].filter(Boolean).join(", ");
  const id = `${SITE_URL}/about#${personAnchor(member.name || name)}`;
  return {
    "@type": "Person",
    "@id": id,
    name,
    ...(creds ? { honorificSuffix: creds } : {}),
    jobTitle: member.title || undefined,
    ...(member.headshot ? { image: absoluteUrl(member.headshot) } : {}),
    ...(description ? { description } : {}),
    url: id,
    worksFor: { "@id": ORG_ID },
    ...(/CFP/i.test(creds)
      ? {
          hasCredential: {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "professional certification",
            name: "CERTIFIED FINANCIAL PLANNER (CFP®)",
          },
        }
      : {}),
  };
}

// A bio for structured data: whole sentences up to a generous budget. Cutting
// at a fixed character count ended an advisor's entry midway through the
// sentence listing his FINRA registrations, so the disclosure vanished while
// the sentence that carried it appeared to be complete.
export function descriptionFor(bio, max = 900) {
  const text = plainText(bio || "");
  if (!text || text.length <= max) return text;
  let out = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if ((out + " " + sentence).trim().length > max) break;
    out = (out + " " + sentence).trim();
  }
  return out || clampText(text, max);
}

// The dashboard stores one address line holding the whole thing, city and
// postcode included, because that is how it is printed. Structured data wants
// the street on its own with the rest in their own fields — repeating them
// inside streetAddress is how a listing ends up saying "Lake Oswego, OR 97035"
// twice. This takes a recognised tail off and leaves anything else alone.
export function streetOnly(c) {
  const full = String(c?.address || "").trim();
  const city = String(c?.city || "").trim();
  if (!full || !city) return full;
  const state = String(c?.state || "").trim();
  const zip = String(c?.postalCode || "").trim();
  const tails = [
    `, ${city}, ${state} ${zip}`,
    `, ${city} ${state} ${zip}`,
    `, ${city}, ${state}`,
    `, ${city}`,
  ].map((t) => t.replace(/\s+/g, " ").trimEnd());
  const lower = full.toLowerCase();
  for (const tail of tails) {
    if (lower.endsWith(tail.toLowerCase())) {
      return full.slice(0, full.length - tail.length).trim() || full;
    }
  }
  return full;
}

// Structured data wants a dialable number: country code and all. The site
// stores it the way it is printed, "(503) 746-2184".
export function e164Phone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}
