import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  getAllPages,
  savePage,
  deletePage,
  sanitizePageInput,
  validateSlug,
} from "@/lib/pagesStore";
import { pingIndexNow } from "@/lib/indexNow";

async function requireAuth() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// List all custom pages.
export async function GET() {
  if (!(await requireAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const pages = await getAllPages();
  return Response.json({ pages });
}

// Create or update a custom page.
export async function POST(request) {
  if (!(await requireAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const page = sanitizePageInput(body);

  const slugError = validateSlug(page.slug);
  if (slugError) return Response.json({ error: slugError }, { status: 400 });

  if (!page.audience) {
    return Response.json(
      { error: "Audience (e.g. \"HP Professionals\") is required." },
      { status: 400 }
    );
  }
  if (!page.heroTitle) {
    return Response.json(
      { error: "A hero title is required." },
      { status: 400 }
    );
  }

  const saved = await savePage({
    ...page,
    updatedAt: new Date().toISOString(),
  });

  if (saved.published) pingIndexNow([`/${saved.slug}`, "/sitemap.xml"]);

  return Response.json({ ok: true, page: saved });
}

// Delete a custom page: /api/admin/pages?slug=hp
export async function DELETE(request) {
  if (!(await requireAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return Response.json({ error: "Missing slug." }, { status: 400 });
  }
  const removed = await deletePage(slug);
  return Response.json({ ok: true, removed });
}
