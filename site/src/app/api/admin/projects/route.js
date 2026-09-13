import { isAdminRequest } from "@/lib/auth";
import {
  getAllProjects,
  getProject,
  saveProject,
  deleteProject,
  sanitizeProjectInput,
  validateProjectSlug,
} from "@/lib/projectsStore";
import { externalizeDataUrls } from "@/lib/mediaMigrate";
import { addRedirect, removeRedirectsTo } from "@/lib/redirectsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401 });

export async function GET() {
  if (!(await isAdminRequest())) return unauthorized();
  const projects = await getAllProjects();
  return Response.json({ projects });
}

// POST → create or update. Send `originalSlug` when editing (to rename cleanly).
export async function POST(request) {
  if (!(await isAdminRequest())) return unauthorized();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const clean = sanitizeProjectInput(body);
  const slugError = validateProjectSlug(clean.slug);
  if (slugError) return Response.json({ error: slugError }, { status: 400 });
  if (!clean.title) return Response.json({ error: "A title is required." }, { status: 400 });

  const originalSlug = body.originalSlug ? String(body.originalSlug) : "";
  const isRename = originalSlug && originalSlug !== clean.slug;

  // Block accidental overwrite of a different project.
  if (!originalSlug || isRename) {
    const existing = await getProject(clean.slug);
    if (existing) return Response.json({ error: `A project with slug "${clean.slug}" already exists.` }, { status: 409 });
  }

  const prior = originalSlug ? await getProject(originalSlug) : null;
  const value = (await externalizeDataUrls(clean)).value;
  const now = new Date().toISOString();
  await saveProject({
    ...value,
    createdAt: prior?.createdAt || now,
    updatedAt: now,
  });

  if (isRename) {
    await deleteProject(originalSlug);
    // Old URL 301s to the new one.
    await addRedirect(`/projects/${originalSlug}`, `/projects/${clean.slug}`);
    await removeRedirectsTo(`/projects/${originalSlug}`);
  }

  return Response.json({ ok: true, slug: clean.slug });
}

export async function DELETE(request) {
  if (!(await isAdminRequest())) return unauthorized();
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  const ok = await deleteProject(slug);
  await removeRedirectsTo(`/projects/${slug}`).catch(() => {});
  return Response.json({ ok });
}
