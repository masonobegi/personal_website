import { getArticle, bodyText } from "@/lib/articlesStore";
import { getMedia, parseMediaUrl } from "@/lib/mediaStore";
import { getRedirect } from "@/lib/redirectsStore";
import { SITE_URL } from "@/lib/seo";

// GET /library/<slug>/file.pdf
//
// Serves an article's PDF under a clean, shareable URL ending in .pdf (which
// also lets Cloudflare cache it).
//
// Once the paper's full text is on the article page, the PDF tells search
// engines — via a Link: rel="canonical" header — that the web page is the
// version to rank. The PDF's links and authority then count toward the page
// people can actually read, link to, and act on. A PDF without an HTML version
// is left to be indexed on its own.

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    const moved = await getRedirect(`/library/${slug}`);
    if (moved) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${moved}/file.pdf`, "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  // Unpublished articles stay invisible, including their attachments.
  if (!article || !article.published || !article.pdf) {
    return new Response("Not found", { status: 404 });
  }

  let bytes = null;
  const parsed = parseMediaUrl(article.pdf);
  if (parsed) {
    const rec = await getMedia(parsed.id);
    if (rec) bytes = Buffer.from(rec.bytes);
  } else if (/^data:application\/pdf;base64,/i.test(article.pdf)) {
    // Not yet moved to the media store (the startup migration handles it).
    bytes = Buffer.from(article.pdf.split(",")[1] || "", "base64");
  }
  if (!bytes || !bytes.length) {
    return new Response("Not found", { status: 404 });
  }

  // Quote-strip the filename so it can't break out of the header.
  const name = (article.pdfName || `${slug}.pdf`).replace(/["\\\r\n]/g, "");
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.length),
    // "inline" so browsers preview it rather than forcing a download; the
    // reader can still save it from the viewer.
    "Content-Disposition": `inline; filename="${name}"`,
    "Cache-Control": "public, max-age=3600",
  };
  if (bodyText(article).trim().length > 200) {
    headers.Link = `<${SITE_URL}/library/${slug}>; rel="canonical"`;
  }

  return new Response(bytes, { headers });
}
