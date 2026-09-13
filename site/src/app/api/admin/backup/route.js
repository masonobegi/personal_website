import { isAdminRequest } from "@/lib/auth";
import { getRawContent, saveContent, snapshotContent } from "@/lib/contentStore";
import { getAllProjects, saveProject, sanitizeProjectInput } from "@/lib/projectsStore";
import { getAllArticles, saveArticle, sanitizeArticleInput } from "@/lib/articlesStore";
import { getAllPages, savePage, sanitizePageInput } from "@/lib/pagesStore";
import { getAllLandingPages, saveLandingPage, sanitizeLandingInput } from "@/lib/landingStore";
import { getAllRedirects, restoreRedirect } from "@/lib/redirectsStore";
import { listSubmissions, restoreSubmission } from "@/lib/submissionsStore";
import { collectMediaIds, exportMedia, importMedia } from "@/lib/mediaStore";
import { externalizeDataUrls } from "@/lib/mediaMigrate";

// -----------------------------------------------------------------------------
//  Backup + restore for everything the admin dashboard can change.
//
//  GET  → one JSON file: site content overrides, team members, articles
//         (drafts included), specialty pages, landing pages, URL redirects,
//         Inbox submissions, and every uploaded file those reference.
//  POST → restores from that file (version 1 or 2).
//
//  Content is stored as the admin's OVERRIDES, not the merged result, so a
//  restore layers back over whatever the code's defaults are at that moment.
//  That keeps an old backup compatible with a newer version of the site.
//
//  Restoring writes each team member, article, page and landing page by id,
//  overwriting any record of the same id that is already there with the file's
//  version. Anything created since the backup under a NEW id survives; an
//  edit made since the backup to a record that is IN the file does not.
//  Submissions are the exception and are only ever added, never overwritten.
//
//  Site content is the exception, and it is the one that can destroy work.
//  It is a single document rather than a set of records, so putting it back
//  replaces every word of site copy — home, services, FAQ, Privacy, Terms and
//  the footer disclosure — with the version in the file. Merging instead would
//  be worse, not better: a merge replaces arrays wholesale, so it would still
//  drop every FAQ question and service area added since while looking safe.
//  So it is opt-in (`restoreContent` in the request), off by default, and the
//  previous document is snapshotted first.
//
//  The file contains form submissions (names, emails, phone numbers), so treat
//  it as confidential.
// -----------------------------------------------------------------------------

export const BACKUP_VERSION = 2;

const validDate = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : undefined);

export async function GET(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [content, projects, articles, pages, landing, redirects, submissions] = await Promise.all([
    getRawContent(),
    getAllProjects(),
    getAllArticles({ includeDrafts: true }),
    getAllPages(),
    getAllLandingPages(),
    getAllRedirects(),
    listSubmissions({ limit: 100000 }),
  ]);

  // Every uploaded file still referenced by something on the site.
  const ids = collectMediaIds([content, projects, articles, pages, landing]);
  const media = await exportMedia([...ids]);

  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    site: process.env.NEXT_PUBLIC_SITE_URL || null,
    counts: {
      projects: projects.length,
      articles: articles.length,
      pages: pages.length,
      landing: landing.length,
      redirects: redirects.length,
      submissions: submissions.length,
      files: media.length,
    },
    content,
    projects,
    articles,
    pages,
    landing,
    redirects,
    submissions,
    media,
  };

  const body = JSON.stringify(payload);

  // ?download=1 → save-as dialog with a dated filename. Without it, plain JSON
  // so `curl` and scheduled jobs can pipe it straight to a file.
  const wantsDownload = new URL(request.url).searchParams.get("download");
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-");

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(wantsDownload
        ? { "Content-Disposition": `attachment; filename="masonobegi-backup-${stamp}.json"` }
        : {}),
    },
  });
}

export async function POST(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That file isn't valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("version" in body)) {
    return Response.json({ error: "That doesn't look like a backup file." }, { status: 400 });
  }
  if (![1, 2].includes(body.version)) {
    return Response.json({ error: `Unsupported backup version: ${body.version}.` }, { status: 400 });
  }

  const restored = { content: false, projects: 0, articles: 0, pages: 0, landing: 0, redirects: 0, submissions: 0, files: 0 };
  const errors = [];
  const attempt = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      errors.push(`${label}: ${e?.message || "failed"}`);
    }
  };

  // Files first, so everything that references them resolves.
  await attempt("Files", async () => {
    restored.files = await importMedia(body.media);
  });

  // Version-1 backups carry images and PDFs embedded in the records; they're
  // stored as files on the way in.
  // Only when the admin has explicitly ticked the box — see the header note.
  if (body.restoreContent && body.content && typeof body.content === "object") {
    await attempt("Content", async () => {
      await snapshotContent();
      await saveContent((await externalizeDataUrls(body.content)).value);
      restored.content = true;
    });
  }

  // Each record is pushed back through the same sanitizer the admin forms use,
  // so a hand-edited or truncated backup can't write junk into the database.
  for (const p of Array.isArray(body.projects) ? body.projects : []) {
    if (!p?.slug) continue;
    await attempt(`Project ${p.slug}`, async () => {
      const { value } = await externalizeDataUrls(p);
      await saveProject({
        ...sanitizeProjectInput(value),
        createdAt: validDate(p.createdAt) || new Date().toISOString(),
        updatedAt: validDate(p.updatedAt) || new Date().toISOString(),
      });
      restored.projects++;
    });
  }

  for (const a of Array.isArray(body.articles) ? body.articles : []) {
    if (!a?.slug) continue;
    await attempt(`Article ${a.slug}`, async () => {
      const { value } = await externalizeDataUrls(a);
      await saveArticle({
        ...sanitizeArticleInput(value),
        // Keep the original dates — they order the Library and feed the
        // sitemap and structured data.
        createdAt: validDate(a.createdAt) || new Date().toISOString(),
        updatedAt: validDate(a.updatedAt) || validDate(a.createdAt) || new Date().toISOString(),
      });
      restored.articles++;
    });
  }

  for (const p of Array.isArray(body.pages) ? body.pages : []) {
    if (!p?.slug) continue;
    await attempt(`Page ${p.slug}`, async () => {
      await savePage({ ...sanitizePageInput(p), updatedAt: validDate(p.updatedAt) || new Date().toISOString() });
      restored.pages++;
    });
  }

  for (const l of Array.isArray(body.landing) ? body.landing : []) {
    if (!l?.slug) continue;
    await attempt(`Landing page ${l.slug}`, async () => {
      await saveLandingPage({
        ...sanitizeLandingInput(l),
        createdAt: validDate(l.createdAt) || new Date().toISOString(),
        updatedAt: validDate(l.updatedAt) || new Date().toISOString(),
      });
      restored.landing++;
    });
  }

  for (const r of Array.isArray(body.redirects) ? body.redirects : []) {
    const ok = (p) => typeof p === "string" && /^\/[\w\-/]+$/.test(p);
    if (!ok(r?.from) || !ok(r?.to)) continue;
    await attempt(`Redirect ${r.from}`, async () => {
      // restoreRedirect declines when the address already redirects somewhere,
      // so counting every attempt reported rows it had deliberately left alone.
      if (await restoreRedirect(r.from, r.to, r.createdAt)) restored.redirects++;
    });
  }

  for (const s of Array.isArray(body.submissions) ? body.submissions : []) {
    await attempt(`Submission ${s?.id}`, async () => {
      if (await restoreSubmission(s)) restored.submissions++;
    });
  }

  return Response.json({ ok: errors.length === 0, restored, errors });
}
