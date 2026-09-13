import { getLandingPage } from "@/lib/landingStore";
import { getMedia, parseMediaUrl } from "@/lib/mediaStore";
import { getContent } from "@/lib/contentStore";
import { verifyDownload } from "@/lib/leads";
import { thankYouPdf } from "@/lib/simplePdf";
import { SITE_URL } from "@/lib/seo";

// GET /go/<slug>/download?s=…&e=…&t=…
//
// The gated download behind a landing page. Only works with the signed link
// handed out after the form is submitted (valid for two hours). Serves the PDF
// uploaded for this page, or — until one is uploaded — a branded one-page
// "thank you for downloading" PDF.

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { slug } = await params;
  const sp = new URL(request.url).searchParams;
  if (!verifyDownload(slug, sp.get("s"), sp.get("e"), sp.get("t"))) {
    // An expired or altered link: send them back to the page to get a new one.
    return new Response(null, { status: 302, headers: { Location: `/go/${encodeURIComponent(slug)}` } });
  }

  const landing = await getLandingPage(slug);
  if (!landing) return new Response("Not found", { status: 404 });

  let bytes = null;
  let name = landing.offer?.pdfName || "";
  const parsed = parseMediaUrl(landing.offer?.pdf);
  if (parsed) {
    const rec = await getMedia(parsed.id);
    if (rec) {
      bytes = Buffer.from(rec.bytes);
      name = name || rec.name;
    }
  }
  if (!bytes) {
    const c = await getContent();
    const realPhone = c.phone && !/555-01/.test(c.phone) ? c.phone : "";
    const realEmail = c.email && !/placeholder|\.example/i.test(c.email) ? c.email : "";
    bytes = thankYouPdf({
      firm: c.siteName,
      title: landing.headline,
      site: SITE_URL,
      phone: realPhone,
      email: realEmail,
      disclosure: "",
    });
  }

  const fileName = (name || `${slug}.pdf`).replace(/["\\\r\n]/g, "").replace(/(\.pdf)?$/i, ".pdf");
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
