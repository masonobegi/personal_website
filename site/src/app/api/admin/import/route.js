import { isAdminRequest } from "@/lib/auth";
import { getMedia, parseMediaUrl, saveMedia, sniffMime } from "@/lib/mediaStore";
import { importPdf } from "@/lib/importers/pdf";
import { importDocx } from "@/lib/importers/docx";

// POST /api/admin/import
//
// Turns a Word document or PDF into article content the admin can review and
// edit before publishing — real headings, paragraphs, lists, and links that
// search engines can read, instead of text locked inside a file.
//
//   multipart  file=<.docx or .pdf>        a new upload
//   JSON       { source: "/media/….pdf" }  an article's already-stored PDF
//
// A PDF upload is also kept as the article's downloadable copy.

export const maxDuration = 60;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 20 * 1024 * 1024;

function isDocx(bytes, name) {
  // .docx files are zip archives ("PK"); the name disambiguates from other zips.
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx$/i.test(name || "");
}

// The signature every OLE2 compound file starts with: the old .doc format, and
// the wrapper Word puts around an encrypted .docx.
const OLE2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function isOle2(bytes) {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(OLE2_SIGNATURE);
}

export async function POST(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let bytes;
  let name = "";
  let storedPdf = null;

  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return Response.json({ error: "No file received." }, { status: 400 });
      }
      name = file.name || "";
      bytes = Buffer.from(await file.arrayBuffer());
    } else {
      const { source } = await request.json();
      if (typeof source === "string" && /^data:application\/pdf;base64,/i.test(source)) {
        // An article whose PDF hasn't been moved to the media store yet.
        bytes = Buffer.from(source.split(",")[1] || "", "base64");
        name = "document.pdf";
      } else {
        const parsed = parseMediaUrl(source);
        const rec = parsed ? await getMedia(parsed.id) : null;
        if (!rec) return Response.json({ error: "That PDF couldn't be found." }, { status: 404 });
        bytes = Buffer.from(rec.bytes);
        name = rec.name || "document.pdf";
        storedPdf = { url: source, size: rec.size, name };
      }
    }
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (bytes.length > MAX_BYTES) {
    return Response.json({ error: "That file is larger than 20 MB." }, { status: 413 });
  }

  try {
    if (sniffMime(bytes) === "application/pdf") {
      const result = await importPdf(bytes);
      const pdf =
        storedPdf ||
        (await saveMedia(bytes, "application/pdf", { name }).then((s) => ({
          url: s.url,
          size: s.size,
          name,
        })));
      return Response.json({ ok: true, source: "pdf", ...result, pdf });
    }

    if (isDocx(bytes, name) || type.includes(DOCX_MIME)) {
      const result = await importDocx(bytes, {
        saveImage: (buf, mime) => saveMedia(buf, mime, { name: "" }),
      });
      return Response.json({ ok: true, source: "docx", ...result, pdf: null });
    }
  } catch (e) {
    console.error("[import] failed:", e);
    return Response.json(
      {
        error:
          "That document couldn't be read. If it's a PDF, try exporting it again from the original file; if it's an older .doc file, save it as .docx first.",
      },
      { status: 422 }
    );
  }

  // An old .doc, and a password-protected .docx, are both OLE2 containers.
  // They used to fall through to "choose a Word document or a PDF", which is
  // no help at all when the file on screen is called .docx.
  if (isOle2(bytes)) {
    return Response.json(
      {
        error:
          "That looks like an older Word file, or one that is password protected. Open it in Word and use File › Save As to save a copy as .docx, with no password, then import that.",
      },
      { status: 422 }
    );
  }

  return Response.json(
    { error: "Please choose a Word document (.docx) or a PDF." },
    { status: 400 }
  );
}
