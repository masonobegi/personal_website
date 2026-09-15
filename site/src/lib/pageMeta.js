import { getContent } from "@/lib/contentStore";
import { buildMetadata } from "@/lib/seo";

// Metadata for a main page, from its entry in Content → Search Listing
// (content.seo.pages[key]), falling back to the given title/description.
export async function standardMetadata(key, path, { title, description, noindex } = {}) {
  const c = await getContent();
  const p = c.seo?.pages?.[key] || {};
  return buildMetadata({
    path,
    title: p.title || title,
    description: p.description || description,
    firm: c.siteName,
    noindex,
  });
}
