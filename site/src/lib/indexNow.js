import crypto from "node:crypto";
import { SITE_URL } from "@/lib/seo";

// -----------------------------------------------------------------------------
//  IndexNow: tells Bing (and through it DuckDuckGo, Yahoo, and ChatGPT search),
//  Yandex, Seznam, and Naver that a page was published or changed, so it's
//  recrawled in minutes instead of whenever the crawler next comes around.
//  Google doesn't take part; for Google the sitemap does this job.
//
//  The protocol proves the site owns the key by serving it at /<key>.txt —
//  handled in src/proxy.js. The key comes from INDEXNOW_KEY if set, otherwise
//  it's derived from the session secret so it stays the same across restarts.
// -----------------------------------------------------------------------------

export function indexNowKey() {
  const explicit = String(process.env.INDEXNOW_KEY || "").trim();
  if (/^[a-zA-Z0-9-]{8,128}$/.test(explicit)) return explicit;
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!secret) return null; // no stable secret → no stable key; stay off
  return crypto.createHash("sha256").update(`indexnow:${secret}`).digest("hex").slice(0, 32);
}

function isLiveSite() {
  return (
    process.env.NODE_ENV === "production" &&
    /^https:\/\//.test(SITE_URL) &&
    !/localhost|127\.0\.0\.1|\.up\.railway\.app/.test(SITE_URL)
  );
}

// Fire-and-forget. `paths` are site-relative ("/library/nike-espp").
export function pingIndexNow(paths) {
  const key = indexNowKey();
  if (!key || !isLiveSite()) return;
  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(paths)].map((p) => `${SITE_URL}${p}`);
  if (!urlList.length) return;
  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList }),
    signal: AbortSignal.timeout(8000),
  })
    .then((res) => {
      if (!res.ok && res.status !== 202) console.warn(`[indexnow] ping returned ${res.status}`);
    })
    .catch((e) => console.warn("[indexnow] ping failed:", e?.message));
}
