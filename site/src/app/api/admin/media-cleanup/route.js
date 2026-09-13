import { isAdminRequest } from "@/lib/auth";
import { getContent } from "@/lib/contentStore";
import { getAllArticles } from "@/lib/articlesStore";
import { getAllPages } from "@/lib/pagesStore";
import { getAllLandingPages } from "@/lib/landingStore";
import { getAllProjects } from "@/lib/projectsStore";
import { collectMediaIds, findOrphanMedia, deleteMedia } from "@/lib/mediaStore";
import { formatBytes } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nothing has ever removed a stored file, so every abandoned import and every
// replaced thumbnail is still there — and a withdrawn document stays
// downloadable at its /media address long after the article pointing at it has
// gone. This finds the files nothing refers to any more, and removes them when
// asked.
//
// GET lists what would go; DELETE removes it. Two steps on purpose: the list
// is worth reading before anything is deleted.

async function orphans() {
  const [content, articles, pages, landing, projects] = await Promise.all([
    getContent(),
    getAllArticles({ includeDrafts: true }),
    getAllPages(),
    getAllLandingPages(),
    getAllProjects().catch(() => []),
  ]);
  const keep = collectMediaIds([content, articles, pages, landing, projects]);
  return findOrphanMedia(keep);
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const files = await orphans();
  const bytes = files.reduce((n, f) => n + (Number(f.size) || 0), 0);
  return Response.json({
    ok: true,
    count: files.length,
    bytes,
    readable: formatBytes(bytes),
    files: files.slice(0, 200).map((f) => ({
      id: f.id,
      name: f.name || "",
      mime: f.mime,
      size: Number(f.size) || 0,
    })),
  });
}

export async function DELETE() {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const files = await orphans();
  const bytes = files.reduce((n, f) => n + (Number(f.size) || 0), 0);
  const removed = await deleteMedia(files.map((f) => f.id));
  return Response.json({ ok: true, removed, bytes, readable: formatBytes(bytes) });
}
