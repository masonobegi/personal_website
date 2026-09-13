"use client";

// Shared client-side image handling for every upload on the site (hero, team
// headshots, article thumbnails + inline images).
//
// - Accepts HEIC/HEIF (iPhone photos): browsers other than Safari can't decode
//   HEIC, so we convert it to JPEG first via heic2any (loaded on demand).
// - Downscales to a max dimension and compresses to JPEG, then uploads it to
//   /api/admin/media. Records store the short /media/... URL that comes back,
//   never the image itself, so pages stay light.

function isHeic(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return (
    t === "image/heic" ||
    t === "image/heif" ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  );
}

// How long to wait for an iPhone photo to be converted before giving up.
// Generous: a large HEIC on a slow laptop genuinely takes a few seconds.
const HEIC_TIMEOUT_MS = 45_000;

async function toDecodableBlob(file) {
  if (!isHeic(file)) return file;
  // Dynamic import so the (large) HEIC decoder only loads when actually needed.
  //
  // The decoder builds part of itself from strings at startup, which the site's
  // content-security policy refuses. When that happens the conversion never
  // settles at all — no error, no rejection — so the upload button sat on
  // "Uploading…" indefinitely with nothing to tell anyone why. Whatever the
  // reason, a conversion that does not finish now fails with something the
  // admin can act on.
  try {
    const heic2any = (await import("heic2any")).default;
    const out = await Promise.race([
      heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out")), HEIC_TIMEOUT_MS)
      ),
    ]);
    return Array.isArray(out) ? out[0] : out;
  } catch {
    throw new Error(
      "This iPhone photo (.heic) couldn't be converted in this browser. Open it in Photos and export or share it as a JPEG, then upload that."
    );
  }
}

// Decodes, downscales to `max` px on the long side, and re-encodes as JPEG.
async function resizeToJpegBlob(file, max, quality) {
  const blob = await toDecodableBlob(file);
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        // JPEG has no transparency; paint white first so transparent PNGs
        // (logos, charts) don't turn black.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (out) => (out ? resolve(out) : reject(new Error("Could not encode image."))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Could not read image."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function postToMedia(blob, name, { isPrivate = false } = {}) {
  const form = new FormData();
  form.append("file", blob, name || "upload");
  if (isPrivate) form.append("private", "1");
  const res = await fetch("/api/admin/media", { method: "POST", body: form });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(json.error || `Upload failed (error ${res.status}).`);
  return json; // { url, width, height, size, name, mime }
}

// Resize + upload an image. Resolves to { url, width, height }.
export async function uploadImage(file, max = 1400, quality = 0.82) {
  const blob = await resizeToJpegBlob(file, max, quality);
  const base = String(file.name || "image").replace(/\.[^.]+$/, "");
  return postToMedia(blob, `${base}.jpg`);
}

// Upload a file exactly as-is (PDFs — the file is the artifact, so it must not
// be re-encoded). Resolves to { url, size, name }.
export function uploadFile(file, opts) {
  return postToMedia(file, file.name, opts);
}

// Standard accept string for image uploads (includes HEIC/HEIF).
export const IMAGE_ACCEPT = "image/*,.heic,.heif";

// Largest PDF we'll take. Files are stored once and served from their own URL
// now, so this only needs to stay under what a reader will sit through.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export { formatBytes } from "@/lib/format";
