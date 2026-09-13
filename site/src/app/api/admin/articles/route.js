import { isAdminRequest } from "@/lib/auth";
import {
  getAllArticles,
  getArticle,
  saveArticle,
  deleteArticle,
  sanitizeArticleInput,
  validateArticleSlug,
  opensExternally,
} from "@/lib/articlesStore";
import { addRedirect, removeRedirect, removeRedirectsTo } from "@/lib/redirectsStore";
import { externalizeDataUrls } from "@/lib/mediaMigrate";
import { pingIndexNow } from "@/lib/indexNow";

// List all articles (including drafts) for the admin.
export async function GET() {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json({ articles: await getAllArticles({ includeDrafts: true }) });
}

// Create or update an article.
//
// Send `originalSlug` when editing, and an empty `originalSlug` when creating.
// If `slug` differs from it, the article is moved to the new address and the
// old one permanently redirects to it, so shared links and search rankings
// carry over.
//
// Omitting the key entirely is read as an edit of `slug`, which is what an
// older dashboard page does; see the note where it is parsed.
export async function POST(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Anything still carrying an embedded image or PDF (an older browser tab, a
  // pasted record) is converted to a stored file before it's saved.
  const { value: input } = await externalizeDataUrls(body);
  const article = sanitizeArticleInput(input);
  if (!article.title) {
    return Response.json({ error: "A title is required." }, { status: 400 });
  }

  // Whether this is a new article or an edit is decided by whether the request
  // says so, not by whether the value is empty. A dashboard tab left open
  // across a deploy runs the older page code, which does not send the key at
  // all — and reading a missing key as "new" turned every save from that tab
  // into a second published copy at <slug>-2, leaving the original, uncorrected
  // article live at the address Google already knew.
  const declaresIntent = Object.prototype.hasOwnProperty.call(body, "originalSlug");
  const originalSlug =
    typeof body.originalSlug === "string" && body.originalSlug
      ? body.originalSlug
      : declaresIntent
        ? ""
        : article.slug;
  const renaming = Boolean(originalSlug) && originalSlug !== article.slug;

  // Addresses saved before the current rules only need to pass them when they
  // change.
  if (!originalSlug || renaming) {
    const slugError = validateArticleSlug(article.slug);
    if (slugError) {
      return Response.json(
        {
          error:
            article.slug === ""
              ? "Please add a title made of letters or numbers (used for the web address)."
              : slugError,
        },
        { status: 400 }
      );
    }
  }

  // A brand-new article whose title matches an existing one gets the next free
  // address (…-2, …-3) rather than overwriting it.
  if (!originalSlug && (await getArticle(article.slug))) {
    const base = article.slug.slice(0, 76);
    let n = 2;
    while (await getArticle(`${base}-${n}`)) n++;
    article.slug = `${base}-${n}`;
  }

  const previous = originalSlug ? await getArticle(originalSlug) : null;

  // A rename must not land on top of a different article.
  if (renaming && (await getArticle(article.slug))) {
    return Response.json(
      {
        error: `Another article already uses /library/${article.slug}. Choose a different web address.`,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const saved = await saveArticle({
    ...article,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  });

  if (renaming && previous) {
    await deleteArticle(originalSlug);
    await addRedirect(`/library/${originalSlug}`, `/library/${saved.slug}`);
  }
  // This address is a live article now; it must not redirect anywhere.
  await removeRedirect(`/library/${saved.slug}`);

  // Renaming changes two addresses, not one: the old one now redirects and
  // needs re-crawling as much as the new one does. It is announced even when
  // the article is saved as a draft, because the old address changed either
  // way. Only when the rename really happened, so a stale request cannot push
  // a URL that leads nowhere.
  const changedPaths = [
    ...(saved.published && !opensExternally(saved) ? [`/library/${saved.slug}`] : []),
    ...(renaming && previous ? [`/library/${originalSlug}`] : []),
  ];
  if (changedPaths.length) {
    pingIndexNow([...changedPaths, "/library", "/sitemap.xml"]);
  }

  return Response.json({ ok: true, article: saved, renamedFrom: renaming ? originalSlug : null });
}

// Delete an article: /api/admin/articles?slug=...
export async function DELETE(request) {
  if (!(await isAdminRequest())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  const removed = await deleteArticle(slug);
  // Old addresses were still redirecting to this one. Left alone they bounce
  // a visitor, and a search engine, into a page that is no longer there.
  if (removed) await removeRedirectsTo(`/library/${slug}`);
  return Response.json({ ok: true, removed });
}
