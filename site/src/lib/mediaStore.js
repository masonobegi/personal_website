import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { USE_PG, getPool, DATA_DIR, once } from "@/lib/db";

// -----------------------------------------------------------------------------
//  Store for uploaded files: images (thumbnails, headshots, the hero photo,
//  article figures) and PDFs.
//
//  Files used to live inside the records that referenced them, as base64 data
//  URLs. That kept storage simple but put every image into the HTML of every
//  page that showed it — the Library page alone weighed 3.6 MB — and it meant a
//  link preview could never show an article's image, because og:image can't be
//  a data URL.
//
//  Now each file is stored once, keyed by a hash of its bytes, and served from
//  /media/<id>.<ext> with a year-long immutable cache header. Records hold only
//  that short URL. The same bytes always get the same id, so saving a file twice
//  is harmless and the data-URL migration can be re-run safely.
//
//  PRODUCTION: a Postgres table (survives redeploys, included in backups).
//  LOCAL DEV:  files under $DATA_DIR/media.
// -----------------------------------------------------------------------------


const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
};
const MIME_BY_EXT = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])
);

export const MEDIA_PATH_RE = /^\/media\/([a-f0-9]{32}p?)\.([a-z0-9]{2,5})$/;

export function isAllowedMime(mime) {
  return Boolean(EXT_BY_MIME[String(mime || "").toLowerCase()]);
}

export function mediaUrl(id, mime) {
  return `/media/${id}.${EXT_BY_MIME[mime] || "bin"}`;
}

// "/media/abc….jpg" → { id, ext, mime }, or null for anything else.
export function parseMediaUrl(url) {
  const m = MEDIA_PATH_RE.exec(String(url || ""));
  if (!m) return null;
  return { id: m[1], ext: m[2], mime: MIME_BY_EXT[m[2]] || null };
}

// Width/height from the file header, so pages can reserve space for an image
// before it loads. Covers the formats the admin uploads produce; returns null
// for anything it can't read rather than guessing.
export function imageSize(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; // PNG
    }
    if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8X") {
        return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      }
      if (kind === "VP8 ") {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (kind === "VP8L") {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG: walk the segments to the start-of-frame marker.
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

// Recognise the file type from its first bytes instead of trusting whatever
// type the browser claimed — the claim decides the Content-Type we serve.
export function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 12) === "ftypavif") return "image/avif";
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

// ---- backends ---------------------------------------------------------------

function ensurePgSchema() {
  return once("__olsMediaReady", () => getPool().query(`
      CREATE TABLE IF NOT EXISTS media (
        id          TEXT PRIMARY KEY,
        mime        TEXT NOT NULL,
        bytes       BYTEA NOT NULL,
        size        INTEGER NOT NULL,
        name        TEXT,
        private     BOOLEAN NOT NULL DEFAULT false,
        width       INTEGER,
        height      INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `));
}

const MEDIA_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "media");

async function fileWrite(rec, bytes) {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const bin = path.join(/*turbopackIgnore: true*/ MEDIA_DIR, rec.id);
  try {
    await fs.access(bin);
    return; // same bytes already stored
  } catch {
    /* new file */
  }
  await fs.writeFile(bin, bytes);
  await fs.writeFile(`${bin}.json`, JSON.stringify(rec), "utf8");
}

async function fileRead(id, withBytes) {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, `${id}.json`), "utf8"));
    if (!withBytes) return meta;
    const bytes = await fs.readFile(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, id));
    return { ...meta, bytes };
  } catch {
    return null;
  }
}

// ---- public API -------------------------------------------------------------

// Stores a file and returns { id, url, mime, size, width?, height? }.
// `isPrivate` files (landing-page downloads) are never served from /media —
// only through a signed download link — and get a distinct id, so the same PDF
// can't be fetched publicly just because a public copy also exists.
export async function saveMedia(bytes, mime, { name = "", isPrivate = false } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const type = String(mime || "").toLowerCase();
  if (!isAllowedMime(type)) throw new Error(`Unsupported file type: ${type || "unknown"}`);
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
  const id = isPrivate ? `${hash}p` : hash;
  const dims = type.startsWith("image/") ? imageSize(buf) : null;
  const rec = {
    id,
    mime: type,
    size: buf.length,
    name: String(name || "").slice(0, 200),
    private: Boolean(isPrivate),
    width: dims?.width || null,
    height: dims?.height || null,
  };

  if (USE_PG) {
    await ensurePgSchema();
    await getPool().query(
      `INSERT INTO media (id, mime, bytes, size, name, private, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [rec.id, rec.mime, buf, rec.size, rec.name, rec.private, rec.width, rec.height]
    );
  } else {
    await fileWrite(rec, buf);
  }

  return {
    id,
    url: mediaUrl(id, type),
    mime: type,
    size: rec.size,
    ...(dims ? { width: dims.width, height: dims.height } : {}),
  };
}

// Full record including the bytes, or null.
export async function getMedia(id) {
  if (!/^[a-f0-9]{32}p?$/.test(String(id || ""))) return null;
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT id, mime, bytes, size, name, private, width, height FROM media WHERE id = $1",
      [id]
    );
    return rows[0] || null;
  }
  return fileRead(id, true);
}

// Metadata only (no bytes) — cheap enough to call while rendering a page.
export async function getMediaInfo(id) {
  if (!/^[a-f0-9]{32}p?$/.test(String(id || ""))) return null;
  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT id, mime, size, name, private, width, height FROM media WHERE id = $1",
      [id]
    );
    return rows[0] || null;
  }
  return fileRead(id, false);
}

// Every stored file, base64-encoded, for the backup download. Only files still
// referenced by something are worth keeping, so the caller passes that set.
export async function exportMedia(ids) {
  const out = [];
  for (const id of ids) {
    const rec = await getMedia(id);
    if (!rec) continue;
    out.push({
      id: rec.id,
      mime: rec.mime,
      name: rec.name || "",
      private: Boolean(rec.private),
      data: Buffer.from(rec.bytes).toString("base64"),
    });
  }
  return out;
}

// Restores files from a backup. Re-hashes rather than trusting the stored id,
// so a hand-edited backup can't plant bytes under someone else's id.
export async function importMedia(list) {
  let count = 0;
  for (const m of Array.isArray(list) ? list : []) {
    if (!m?.data || !isAllowedMime(m.mime)) continue;
    const saved = await saveMedia(Buffer.from(m.data, "base64"), m.mime, {
      name: m.name,
      isPrivate: m.private,
    });
    if (saved.id === m.id) count++;
  }
  return count;
}

// Every /media URL mentioned anywhere inside a value (records, content docs).
export function collectMediaIds(value, into = new Set()) {
  if (typeof value === "string") {
    const re = /\/media\/([a-f0-9]{32}p?)\.[a-z0-9]{2,5}/g;
    let m;
    while ((m = re.exec(value))) into.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const v of value) collectMediaIds(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectMediaIds(v, into);
  }
  return into;
}

// Files nothing refers to any more, and how much room they take.
//
// Nothing has ever deleted a stored file. Every abandoned import, every
// thumbnail swapped for a better one, every draft that was never saved leaves
// its bytes behind for good — and for a withdrawn document that is worse than
// untidy, because the file stays downloadable at its /media address long after
// the article pointing at it is gone.
//
// `keep` is every id still referenced anywhere; the caller collects it with
// collectMediaIds over all the stored records. Files uploaded in the last day
// are spared regardless, so an import in progress cannot have its own images
// taken away before the article is saved.
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export async function findOrphanMedia(keep) {
  const kept = keep instanceof Set ? keep : new Set(keep);
  const cutoff = new Date(Date.now() - ORPHAN_GRACE_MS);
  const out = [];

  if (USE_PG) {
    await ensurePgSchema();
    const { rows } = await getPool().query(
      "SELECT id, mime, size, name, created_at FROM media WHERE created_at < $1",
      [cutoff]
    );
    for (const r of rows) if (!kept.has(r.id)) out.push(r);
    return out;
  }

  let names = [];
  try {
    names = await fs.readdir(MEDIA_DIR);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!/^[a-f0-9]{32}p?$/.test(name)) continue;
    if (kept.has(name)) continue;
    try {
      const stat = await fs.stat(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, name));
      if (stat.mtime >= cutoff) continue;
      const meta = await fileRead(name, false);
      out.push({ id: name, mime: meta?.mime || "", size: stat.size, name: meta?.name || "" });
    } catch {
      /* gone already */
    }
  }
  return out;
}

export async function deleteMedia(ids) {
  const list = [...new Set(ids)].filter((id) => /^[a-f0-9]{32}p?$/.test(id));
  if (!list.length) return 0;
  if (USE_PG) {
    await ensurePgSchema();
    const res = await getPool().query("DELETE FROM media WHERE id = ANY($1::text[])", [list]);
    return res.rowCount;
  }
  let removed = 0;
  for (const id of list) {
    try {
      await fs.rm(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, id), { force: true });
      await fs.rm(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, `${id}.json`), { force: true });
      removed++;
    } catch {
      /* already gone */
    }
  }
  return removed;
}
