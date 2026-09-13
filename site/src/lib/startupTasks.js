import { getMeta, setMeta } from "@/lib/db";
import { externalizeDataUrls } from "@/lib/mediaMigrate";
import { getAllArticles, saveArticleIfUnchanged } from "@/lib/articlesStore";
import { getRawContent, saveContentIfUnchanged } from "@/lib/contentStore";

// One-time data upgrades, run in the background when the server starts (see
// src/instrumentation.js). Each is guarded by a flag so it runs once, and each
// is safe to re-run if the server stops halfway through.

export async function runStartupTasks() {
  await migrateEmbeddedMedia();
}

// Moves every base64 image and PDF out of articles, site content, and team
// records into the media store, replacing each with its /media/... URL.
// Until this finishes the site still renders the old data URLs, so nothing
// breaks in the meantime.
async function migrateEmbeddedMedia() {
  if (await getMeta("media_migrated_v1")) return;
  let updated = 0;

  // Each record is written back only if it still looks exactly as it did when
  // it was read. This runs while the site is already serving, so somebody can
  // be saving in the dashboard at the same moment — and this used to overwrite
  // them with the copy it read seconds earlier. Losing the race is fine: their
  // save already has no data URLs in it, because the dashboard does not
  // produce them any more.
  let skipped = 0;

  for (const article of await getAllArticles({ includeDrafts: true })) {
    const { value, changed } = await externalizeDataUrls(article);
    if (!changed) continue;
    if (await saveArticleIfUnchanged(value, article)) updated++;
    else skipped++;
  }

  const before = await getRawContent();
  const content = await externalizeDataUrls(before);
  if (content.changed) {
    if (await saveContentIfUnchanged(content.value, before)) updated++;
    else skipped++;
  }

  if (skipped) {
    console.log(`[startup] ${skipped} record(s) were being edited at the time and were left alone.`);
  }

  await setMeta("media_migrated_v1", new Date().toISOString());
  console.log(`[startup] Moved embedded images and PDFs into the media store (${updated} records updated).`);
}
