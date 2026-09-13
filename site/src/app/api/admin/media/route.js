import { isAdminRequest } from "@/lib/auth";
import { saveMedia, sniffMime } from "@/lib/mediaStore";

// POST /api/admin/media  (multipart: file, private?)
//
// Every upload in the dashboard lands here first and gets back a short
// /media/... URL, which is what the article, page, or team record then stores.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function POST(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return Response.json({ error: "No file received." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) {
    return Response.json(
      { error: "That file type isn't supported. Use a JPG, PNG, WebP, or PDF." },
      { status: 400 }
    );
  }
  const limit = mime === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (bytes.length > limit) {
    return Response.json(
      { error: `That file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB; the limit is ${limit / 1024 / 1024} MB.` },
      { status: 413 }
    );
  }

  try {
    const saved = await saveMedia(bytes, mime, {
      name: file.name || "",
      isPrivate: form.get("private") === "1",
    });
    return Response.json({ ok: true, ...saved, name: file.name || "" });
  } catch (e) {
    console.error("[media] upload failed:", e);
    return Response.json({ error: "Couldn't save that file. Please try again." }, { status: 500 });
  }
}
