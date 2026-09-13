// Web-address helpers shared by the server and the dashboard (no server-only
// imports here, so the editor can preview addresses as the admin types).

export function normalizeSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

const SLUG_STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "to", "for", "in", "on", "at", "by", "with",
  "your", "you", "how", "what", "why", "when", "is", "are", "do", "does",
]);

const DATE_LIKE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d|\b(19|20)\d{2}\b|\b\d{1,2}\/\d{1,2}\b|\bq[1-4]\b/i;

// A short, readable web address from a title.
//   "Nike Retirement Vesting - How Age 55, Five Years…"  → nike-retirement-vesting
//   "The Lifetime Sequence of Returns: A Retirement…"      → lifetime-sequence-of-returns
//   "Weekly Market Performance - July 24, 2026"            → weekly-market-performance-july-24-2026
// Titles written as "Topic - Explanation" or "Topic: Explanation" keep just the
// topic — unless the part after the dash is a date, which is what tells one
// weekly post from the next. Otherwise filler words are dropped until it's six
// words or fewer.
export function suggestSlug(title) {
  const raw = String(title || "");
  const [head, ...rest] = raw.split(/\s[-–—|]\s|[:?]\s/);
  const tail = rest.join(" ");
  const useHead = head.length >= 8 && !(tail && DATE_LIKE.test(tail) && !DATE_LIKE.test(head));
  let words = normalizeSlug(useHead ? head : raw).split("-").filter(Boolean);
  if (["the", "a", "an"].includes(words[0])) words = words.slice(1);
  if (words.length > 6) {
    words = words.filter((w, i) => i === 0 || !SLUG_STOPWORDS.has(w)).slice(0, 6);
  }
  return words.join("-").slice(0, 80).replace(/-+$/, "");
}

// True when the stored address was produced by the old 60-character cut-off
// and ends mid-title (".../nike-tax-withholding-why-taxes-withheld-from-equity-awards-a").
export function isTruncatedSlug(slug, title) {
  const full = normalizeSlug(title);
  return Boolean(slug) && slug.length >= 50 && full !== slug && full.startsWith(slug);
}
