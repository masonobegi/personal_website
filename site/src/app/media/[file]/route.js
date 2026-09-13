import { getMedia, parseMediaUrl } from "@/lib/mediaStore";

// GET /media/<id>.<ext>
//
// Serves an uploaded image or PDF. The id is a hash of the file's bytes, so a
// URL can never point at different content — which is what makes the
// year-long "immutable" cache safe, and lets Cloudflare hold every image at
// the edge instead of asking the server each time.

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { file } = await params;
  const parsed = parseMediaUrl(`/media/${file}`);
  if (!parsed) return new Response("Not found", { status: 404 });

  const rec = await getMedia(parsed.id);
  // Private files (gated landing-page downloads) are only handed out through a
  // signed download link, never by guessing the URL.
  if (!rec || rec.private) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(rec.bytes);
  const headers = {
    "Content-Type": rec.mime,
    "Content-Length": String(bytes.length),
    "Cache-Control": "public, max-age=31536000, immutable",
    // Every image on every page load currently comes all the way back here and
    // pulls its bytes out of the database, because Cloudflare is not caching
    // this route. This header is part of what it needs, but not all of it:
    // Next appends its own routing values to Vary rather than replacing them,
    // and Cloudflare only honours Vary when it is exactly Accept-Encoding. A
    // Cache Rule on the zone is required as well — see notes/FOR-MASON.md.
    Vary: "Accept-Encoding",
    "X-Content-Type-Options": "nosniff",
  };
  if (rec.mime === "application/pdf") {
    const name = (rec.name || `${parsed.id}.pdf`).replace(/["\\\r\n]/g, "");
    headers["Content-Disposition"] = `inline; filename="${name}"`;
  }
  return new Response(bytes, { headers });
}
