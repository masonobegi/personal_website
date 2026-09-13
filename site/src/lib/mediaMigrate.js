import { saveMedia } from "@/lib/mediaStore";

// -----------------------------------------------------------------------------
//  Turns base64 data URLs embedded in stored records into /media/... files.
//
//  Used in two places:
//    • on every dashboard save and backup restore, so a data URL can never be
//      written into a record again (old backups are full of them);
//    • once at server start, to convert everything already in the database.
//
//  Files are content-addressed, so running this twice over the same record
//  produces the same URLs and changes nothing the second time.
// -----------------------------------------------------------------------------

const DATA_URL_RE =
  /^data:(image\/(?:jpeg|jpg|png|webp|gif|avif)|application\/pdf);base64,([\s\S]+)$/i;

function isDataUrl(v) {
  return typeof v === "string" && v.startsWith("data:") && DATA_URL_RE.test(v);
}

async function convert(dataUrl, name) {
  const [, rawMime, b64] = DATA_URL_RE.exec(dataUrl);
  const mime = rawMime.toLowerCase() === "image/jpg" ? "image/jpeg" : rawMime.toLowerCase();
  const bytes = Buffer.from(b64.replace(/\s+/g, ""), "base64");
  if (!bytes.length) return null;
  return saveMedia(bytes, mime, { name });
}

// Returns { value, changed }. `value` is a new structure with every data URL
// swapped for its /media URL; the input is not mutated.
export async function externalizeDataUrls(input) {
  let changed = false;

  async function walk(v) {
    if (isDataUrl(v)) {
      const saved = await convert(v);
      if (!saved) return v;
      changed = true;
      return saved.url;
    }
    if (Array.isArray(v)) {
      const out = [];
      for (const item of v) out.push(await walk(item));
      return out;
    }
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, child] of Object.entries(v)) {
        if (isDataUrl(child)) {
          // Carry a little metadata the renderer needs alongside the new URL.
          const saved = await convert(child, k === "pdf" ? v.pdfName : "");
          if (!saved) {
            out[k] = child;
            continue;
          }
          changed = true;
          out[k] = saved.url;
          if (k === "src" && saved.width && !v.width) {
            out.width = saved.width;
            out.height = saved.height;
          }
          if (k === "pdf" && !v.pdfSize) out.pdfSize = saved.size;
        } else if (!(k in out)) {
          out[k] = await walk(child);
        }
      }
      return out;
    }
    return v;
  }

  const value = await walk(input);
  return { value, changed };
}
