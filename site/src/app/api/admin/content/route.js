import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getContent, saveContent, overridesOnly } from "@/lib/contentStore";
import { defaultContent } from "@/lib/defaultContent";
import { invalidTrackingFields } from "@/lib/tracking";
import { externalizeDataUrls } from "@/lib/mediaMigrate";

async function requireAuth() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

// Return the current merged content (defaults + overrides) to prefill the form.
export async function GET() {
  if (!(await requireAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  // The defaults go with it so the tab can work out what has actually been
  // changed and store only that.
  return Response.json({ content: await getContent(), defaults: defaultContent });
}

// Save the full content document.
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

  if (!body?.content || typeof body.content !== "object") {
    return Response.json({ error: "Invalid content." }, { status: 400 });
  }
  // Images are uploaded separately now; anything still embedded is stored as
  // a file so it never inflates every page's HTML.
  const { value: content } = await externalizeDataUrls(body.content);

  if (JSON.stringify(content).length > 2_000_000) {
    return Response.json({ error: "Content is too large." }, { status: 413 });
  }

  // Refuse a tracking ID that would be thrown away at render time, rather
  // than storing something that looks configured and never loads.
  const badIds = invalidTrackingFields(content.tracking);
  if (badIds.length) {
    return Response.json(
      {
        error: `These tracking IDs aren't in the right format, so they would never load: ${badIds.join(", ")}. Fix or clear them and save again.`,
      },
      { status: 400 }
    );
  }

  // Store the differences, not the whole document — see overridesOnly.
  const overrides = overridesOnly(content, defaultContent) || {};
  let saved;
  try {
    saved = await saveContent(overrides);
  } catch (e) {
    console.error("[content] save failed:", e?.message || e);
    return Response.json(
      { error: "Could not save — the database did not accept it. Nothing was changed." },
      { status: 500 }
    );
  }
  return Response.json({ ok: true, content: saved });
}
