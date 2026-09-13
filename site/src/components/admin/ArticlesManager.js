"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { uploadImage, uploadFile, IMAGE_ACCEPT, MAX_PDF_BYTES, formatBytes } from "@/lib/clientImage";
import { suggestSlug, isTruncatedSlug, normalizeSlug } from "@/lib/slugs";
import { adminFetch } from "@/lib/adminFetch";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsavedChanges";
import { clampText, plainText } from "@/lib/seo";

const EMPTY = {
  kind: null,
  slug: "",
  originalSlug: "",
  title: "",
  author: "",
  date: "",
  reviewedDate: "",
  excerpt: "",
  tags: "",
  thumbnail: null,
  externalUrl: "",
  externalMode: "embed",
  videoUrl: "",
  pdf: null,
  pdfName: "",
  pdfSize: null,
  blocks: [],
  sources: "",
  disclosures: "",
  seoTitle: "",
  seoDescription: "",
  published: true,
};

const KIND_LABELS = {
  written: "Article",
  pdf: "White paper",
  linked: "Linked article",
  video: "Video",
};

function kindOf(a) {
  if (["written", "pdf", "linked", "video"].includes(a?.kind)) return a.kind;
  if (a?.pdf) return "pdf";
  if (a?.externalUrl) return "linked";
  return "written";
}

function bodyLength(a) {
  return (a?.blocks || [])
    .filter((b) => b.type === "text" || b.type === "heading")
    .reduce((n, b) => n + String(b.text || "").length, 0);
}


const today = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default function ArticlesManager() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  useUnsavedChanges(editing);
  const [isNew, setIsNew] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(""); // what's uploading/importing, for the status line
  const [shortenPlan, setShortenPlan] = useState(null); // [{ article, slug }]
  const [pendingImport, setPendingImport] = useState(null); // { source } to run once the editor opens
  const importInput = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await adminFetch("/api/admin/articles");
    // An expired session used to leave this showing an empty Library rather
    // than saying anything, which reads as "every article is gone".
    if (list.ok) setArticles(list.json.articles || []);
    else setMsg({ type: "error", text: list.error });
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setEditing((a) => ({ ...a, [k]: v }));

  function startNew() {
    setEditing({ ...EMPTY, blocks: [] });
    setIsNew(true);
    setSlugTouched(false);
    setMsg(null);
  }

  // Pick the type for a brand-new article.
  function chooseKind(kind) {
    setEditing((a) => ({
      ...a,
      kind,
      date: a.date || today(),
      blocks: kind === "written" ? [{ type: "text", text: "" }] : [],
    }));
  }

  function startEdit(a, { autoImport = false } = {}) {
    setEditing({
      ...EMPTY,
      ...a,
      kind: kindOf(a),
      originalSlug: a.slug,
      // tags are stored as an array; edit them as a comma-separated string
      tags: Array.isArray(a.tags) ? a.tags.join(", ") : a.tags || "",
      blocks: a.blocks?.length ? a.blocks : kindOf(a) === "written" ? [{ type: "text", text: "" }] : [],
    });
    setIsNew(false);
    setSlugTouched(true);
    setMsg(null);
    if (autoImport && a.pdf) setPendingImport({ source: a.pdf });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onTitle(v) {
    setEditing((a) => ({
      ...a,
      title: v,
      slug: isNew && !slugTouched ? suggestSlug(v) : a.slug,
    }));
  }

  // ---- block operations ----
  const setBlock = (i, patch) =>
    setEditing((a) => ({ ...a, blocks: a.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) }));
  const insertBlock = (index, block) =>
    setEditing((a) => {
      const blocks = [...a.blocks];
      blocks.splice(index, 0, block);
      return { ...a, blocks };
    });
  const removeBlock = (i) => setEditing((a) => ({ ...a, blocks: a.blocks.filter((_, idx) => idx !== i) }));
  const moveBlock = (i, dir) =>
    setEditing((a) => {
      const j = i + dir;
      if (j < 0 || j >= a.blocks.length) return a;
      const blocks = [...a.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...a, blocks };
    });

  // ---- uploads ----
  async function withBusy(label, fn) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Something went wrong. Please try again." });
    } finally {
      setBusy("");
    }
  }

  const handleThumbnail = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    withBusy("Uploading image…", async () => {
      // 1600px wide covers LinkedIn's and Google's largest share-image sizes.
      const up = await uploadImage(file, 1600);
      set("thumbnail", up.url);
    });
  };

  const handleBlockImage = (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    withBusy("Uploading image…", async () => {
      const up = await uploadImage(file, 1600);
      setBlock(i, { src: up.url, width: up.width, height: up.height });
    });
  };

  const handleVideoThumb = (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    withBusy("Uploading image…", async () => {
      const up = await uploadImage(file, 1280);
      setBlock(i, { thumbnail: up.url });
    });
  };

  // Brings a Word document or PDF into the article: its text becomes the body
  // (headings, paragraphs, lists), and a PDF is also kept as the download.
  const runImport = useCallback(
    async ({ file, source }) => {
      setBusy(file ? `Reading ${file.name}…` : "Reading the PDF…");
      setMsg(null);
      try {
        let res;
        if (file) {
          if (file.size > MAX_PDF_BYTES) throw new Error(`That file is ${formatBytes(file.size)}; the limit is 20 MB.`);
          const form = new FormData();
          form.append("file", file);
          res = await fetch("/api/admin/import", { method: "POST", body: form });
        } else {
          res = await fetch("/api/admin/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source }),
          });
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Import failed (error ${res.status}).`);

        setEditing((a) => {
          const next = { ...a };
          if (json.blocks?.length) next.blocks = json.blocks;
          if (!a.title.trim() && json.title) {
            next.title = json.title;
            if (isNew && !slugTouched) next.slug = suggestSlug(json.title);
          }
          if (!a.excerpt.trim() && json.subtitle) next.excerpt = json.subtitle;
          if (!a.sources.trim() && json.sources) next.sources = json.sources;
          if (!a.disclosures.trim() && json.disclosures) next.disclosures = json.disclosures;
          if (!a.reviewedDate.trim() && json.reviewedDate) next.reviewedDate = json.reviewedDate;
          if (json.pdf) {
            next.pdf = json.pdf.url;
            // Converting the article's own PDF keeps its original file name.
            next.pdfName = file ? json.pdf.name : a.pdfName || json.pdf.name;
            next.pdfSize = json.pdf.size;
            // Only become a white paper if it was not already something the
            // admin chose. Importing a PDF into an article they had written
            // used to reclassify it without saying so, which changed how it
            // appears in the Library and how it is filtered.
            if (a.kind !== "written") next.kind = "pdf";
          }
          return next;
        });
        const headings = (json.blocks || []).filter((b) => b.type === "heading").length;
        // Nothing came back. Saying "imported the full text" over an empty
        // article is how an admin saves a blank page believing it worked.
        const imported = (json.blocks || []).length;
        if (!imported) {
          setMsg({
            type: "error",
            text:
              json.warnings?.length
                ? json.warnings.join(" ")
                : "No text could be read from that document, so nothing was imported.",
          });
          return;
        }
        setMsg({
          type: json.warnings?.length ? "warn" : "ok",
          text:
            (json.warnings?.length ? `${json.warnings.join(" ")} ` : "") +
            `Imported ${headings} section heading${headings === 1 ? "" : "s"} and the text. ` +
            "Words that PDFs split apart (“thor oughly”) and stray capitals (“eXtraction”) are fixed " +
            "automatically. Tables come through as one line of text per row and charts are dropped, " +
            "so check any of those against the original before saving.",
        });
      } catch (err) {
        setMsg({ type: "error", text: err?.message || "Couldn't read that document." });
      } finally {
        setBusy("");
      }
    },
    [isNew, slugTouched]
  );

  useEffect(() => {
    if (pendingImport && editing) {
      const job = pendingImport;
      setPendingImport(null);
      runImport(job);
    }
  }, [pendingImport, editing, runImport]);

  function confirmReplaceBody() {
    const hasText = bodyLength(editing) > 0 || editing.blocks.some((b) => b.type === "image");
    return !hasText || confirm("Replace the current article text with the text from this document?");
  }

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !confirmReplaceBody()) return;
    runImport({ file });
  };

  const handlePdf = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setMsg({ type: "error", text: "That isn't a PDF. Choose a .pdf file." });
      return;
    }
    // A paper with no text yet gets its text pulled out of the PDF; otherwise
    // only the downloadable file is replaced.
    // "Nothing there yet" has to account for pictures. An article whose body
    // is a set of figures measures as empty by word count, and its images were
    // being replaced by the PDF's text without anyone being asked.
    const hasFigures = (editing.blocks || []).some((b) => b.type === "image");
    if (bodyLength(editing) < 200 && !hasFigures) {
      runImport({ file });
      return;
    }
    withBusy("Uploading PDF…", async () => {
      const up = await uploadFile(file);
      setEditing((a) => ({ ...a, pdf: up.url, pdfName: up.name || file.name, pdfSize: up.size }));
    });
  };

  // ---- save / delete ----
  async function handleSave(e) {
    e.preventDefault();
    const a = editing;
    if (!a.title.trim()) return setMsg({ type: "error", text: "Please add a title." });
    if (a.kind === "linked" && !/^https?:\/\//i.test(a.externalUrl.trim()))
      return setMsg({ type: "error", text: "Please paste the article URL (starting with https://)." });
    if (a.kind === "video" && !/^https?:\/\//i.test(a.videoUrl.trim()))
      return setMsg({ type: "error", text: "Please paste the LinkedIn post URL (starting with https://)." });
    if (a.kind === "pdf" && !a.pdf) return setMsg({ type: "error", text: "Please choose a PDF to upload." });
    const slug = normalizeSlug(a.slug) || suggestSlug(a.title);
    if (!isNew && slug !== a.originalSlug) {
      const ok = confirm(
        `Move this article from /library/${a.originalSlug} to /library/${slug}?\n\n` +
          "The old address will permanently redirect to the new one, so existing links keep working."
      );
      if (!ok) return;
    }

    setSaving(true);
    setMsg(null);
    const { ok, json, error } = await adminFetch("/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, slug, originalSlug: isNew ? "" : a.originalSlug }),
    });
    setSaving(false);
    if (!ok) {
      setMsg({ type: "error", text: error });
      return;
    }
    if (ok) {
      setMsg({
        type: "ok",
        text:
          `Saved ✓ — “${json.article.title}” is ${json.article.published ? "live" : "saved as a draft"} at /library/${json.article.slug}` +
          (json.renamedFrom ? ` (the old address /library/${json.renamedFrom} now redirects here)` : ""),
      });
      setEditing(null);
      setIsNew(false);
      load();
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setMsg({ type: "error", text: json.error || `Could not save (error ${res.status}).` });
    }
  }

  async function handleDelete(a) {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    const { ok, error } = await adminFetch(
      `/api/admin/articles?slug=${encodeURIComponent(a.slug)}`,
      { method: "DELETE" }
    );
    if (ok) {
      setMsg({ type: "ok", text: `Deleted "${a.title}".` });
      load();
    } else {
      setMsg({ type: "error", text: error });
    }
  }

  // ---- bulk: shorten cut-off addresses ----
  const truncated = articles.filter((a) => isTruncatedSlug(a.slug, a.title));
  const textless = articles.filter((a) => kindOf(a) === "pdf" && bodyLength(a) < 200);

  function planShorten() {
    const taken = new Set(articles.map((a) => a.slug));
    setShortenPlan(
      truncated.map((a) => {
        let s = suggestSlug(a.title);
        if (taken.has(s) && s !== a.slug) s = `${s}-2`;
        taken.add(s);
        return { article: a, slug: s };
      })
    );
  }

  async function applyShorten() {
    let done = 0;
    const errors = [];
    const skipped = [];

    // Re-read everything first. The plan holds whole copies of each article as
    // they were when the list loaded, and posting those back would undo any
    // edit made since — or recreate one that had been deleted. Only the address
    // is supposed to change here.
    setBusy("Checking for changes…");
    const fresh = await adminFetch("/api/admin/articles");
    if (!fresh.ok) {
      setBusy("");
      setMsg({ type: "error", text: fresh.error });
      return;
    }
    const current = new Map((fresh.json.articles || []).map((a) => [a.slug, a]));

    for (const row of shortenPlan) {
      const slug = normalizeSlug(row.slug);
      if (!slug || slug === row.article.slug) {
        skipped.push(row.article.title);
        continue;
      }
      const latest = current.get(row.article.slug);
      if (!latest) {
        // Renamed or deleted since the list was drawn. Posting the old copy
        // back would bring it out of the dead.
        skipped.push(row.article.title);
        continue;
      }
      setBusy(`Moving ${done + 1} of ${shortenPlan.length}…`);
      const { ok, error } = await adminFetch("/api/admin/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...latest, slug, originalSlug: latest.slug }),
      });
      if (ok) done++;
      else errors.push(`${latest.title}: ${error}`);
    }
    setBusy("");
    setShortenPlan(null);
    setMsg({
      type: errors.length ? "error" : "ok",
      text:
        `Shortened ${done} web address${done === 1 ? "" : "es"}. Every old address permanently redirects to its new one.` +
        (skipped.length ? ` Skipped ${skipped.length} that changed since the list loaded: ${skipped.join("; ")}.` : "") +
        (errors.length ? ` Not moved: ${errors.join("; ")}` : ""),
    });
    load();
  }

  // ---- render helpers ----
  const InsertBar = ({ index }) => (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "4px 0", flexWrap: "wrap" }}>
      <button type="button" onClick={() => insertBlock(index, { type: "text", text: "" })} style={insertBtn}>
        + Text
      </button>
      <button type="button" onClick={() => insertBlock(index, { type: "heading", level: 2, text: "" })} style={insertBtn}>
        + Heading
      </button>
      <button type="button" onClick={() => insertBlock(index, { type: "image", src: "", caption: "" })} style={insertBtn}>
        + Image
      </button>
      <button type="button" onClick={() => insertBlock(index, { type: "video", url: "", title: "", thumbnail: "" })} style={insertBtn}>
        + Video link
      </button>
    </div>
  );

  const Banner = () =>
    msg || busy ? (
      <p role="status" aria-live="polite" style={bannerStyle(busy ? "ok" : msg.type)}>
        {busy || msg.text}
      </p>
    ) : null;

  // =========================================================================
  return (
    <div>
      <input ref={importInput} type="file" accept=".docx,.pdf,application/pdf" onChange={onImportFile} style={{ display: "none" }} />

      {!editing && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <p className="muted" style={{ fontSize: 16, margin: 0, maxWidth: "62ch" }}>
            Manage the <strong>Library</strong>: articles you write (or import
            from Word or PDF), white papers, links to outside articles, and
            LinkedIn videos. Everything published here is added to the sitemap
            and search listings automatically.
          </p>
          <button className="btn btn-ember" onClick={startNew}>
            + New
          </button>
        </div>
      )}

      <Banner />

      {/* ---- Health checks (list view) ---- */}
      {!editing && !loading && (truncated.length > 0 || textless.length > 0) && (
        <div style={{ display: "grid", gap: 12, marginBottom: 22 }}>
          {truncated.length > 0 && !shortenPlan && (
            <div style={noticeStyle}>
              <strong>
                {truncated.length} web address{truncated.length === 1 ? " is" : "es are"} cut off mid-word
              </strong>{" "}
              (for example <code>/library/{truncated[0].slug}</code>). Short, complete addresses look more
              trustworthy in search results. Shortening them keeps every old link working.
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-outline" style={smallBtn} onClick={planShorten}>
                  Review &amp; shorten
                </button>
              </div>
            </div>
          )}
          {shortenPlan && (
            <div className="card" style={{ background: "#fff" }}>
              <h3 style={{ fontSize: "1.3rem", marginBottom: 6 }}>Shorten web addresses</h3>
              <p className="muted" style={{ fontSize: 14.5, marginBottom: 14 }}>
                Edit any new address before applying. Each old address will permanently redirect to its new one.
              </p>
              {shortenPlan.map((row, i) => (
                <div key={row.article.slug} style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-faint)", overflowWrap: "anywhere" }}>
                    {row.article.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <code style={{ fontSize: 13 }}>/library/</code>
                    <input
                      value={row.slug}
                      onChange={(e) =>
                        setShortenPlan((p) => p.map((r, j) => (j === i ? { ...r, slug: normalizeSlug(e.target.value) } : r)))
                      }
                      style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                      aria-label={`New web address for ${row.article.title}`}
                    />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button className="btn btn-ember" onClick={applyShorten} disabled={Boolean(busy)}>
                  Apply {shortenPlan.length}
                </button>
                <button className="btn btn-outline" onClick={() => setShortenPlan(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {textless.length > 0 && (
            <div style={noticeStyle}>
              <strong>
                {textless.length} white paper{textless.length === 1 ? " shows" : "s show"} search engines only a summary.
              </strong>{" "}
              The full text lives inside the PDF. Convert each one to put the complete paper on its page —
              you&apos;ll review the text before it goes live, and the PDF stays as the download.
              <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                {textless.map((a) => (
                  <li key={a.slug} style={{ marginBottom: 6 }}>
                    {a.title}{" "}
                    <button className="btn btn-outline" style={{ ...smallBtn, marginLeft: 6 }} onClick={() => startEdit(a, { autoImport: true })}>
                      Convert
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---- Step 1 (new): choose the type ---- */}
      {editing && !editing.kind && (
        <div className="card" style={{ background: "#fff", marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.7rem", marginBottom: 6 }}>Add to the Library</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            What are you adding?
          </p>
          <div className="grid-2" style={{ gap: 16 }}>
            <button type="button" onClick={() => chooseKind("written")} style={kindCard}>
              <span style={kindCardTitle}>✍️ Write an article</span>
              <span style={kindCardDesc}>
                Compose it here, or import a Word document or PDF and edit the result. It publishes as a
                normal web article.
              </span>
            </button>
            <button type="button" onClick={() => chooseKind("pdf")} style={kindCard}>
              <span style={kindCardTitle}>📄 Publish a white paper</span>
              <span style={kindCardDesc}>
                Upload the PDF (or Word file). Its full text becomes the article — headings and all — so
                Google can read it, and the PDF is offered as a download.
              </span>
            </button>
            <button type="button" onClick={() => chooseKind("linked")} style={kindCard}>
              <span style={kindCardTitle}>🔗 Link an outside article</span>
              <span style={kindCardDesc}>
                Point to something published elsewhere — previewed on our site, or linked straight out.
              </span>
            </button>
            <button type="button" onClick={() => chooseKind("video")} style={kindCard}>
              <span style={kindCardTitle}>▶ Share a LinkedIn video</span>
              <span style={kindCardDesc}>
                A thumbnail card in the Library that opens the video on LinkedIn. (Videos aren&apos;t
                uploaded to the site.)
              </span>
            </button>
          </div>
          <button type="button" className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => confirmDiscard() && setEditing(null)}>
            Cancel
          </button>
        </div>
      )}

      {/* ---- Step 2: the editor ---- */}
      {editing && editing.kind && (
        <form onSubmit={handleSave} className="card" style={{ background: "#fff", marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.7rem", marginBottom: 4 }}>
            {isNew ? `New ${KIND_LABELS[editing.kind].toLowerCase()}` : `Editing “${plainText(editing.title) || "article"}”`}
          </h2>
          {isNew && (
            <button type="button" onClick={() => set("kind", null)} style={linkBtn}>
              ‹ Choose a different type
            </button>
          )}

          {/* White paper: the PDF first, since uploading it fills in the rest. */}
          {editing.kind === "pdf" && (
            <div className="field" style={panelStyle}>
              <label>PDF file *</label>
              {editing.pdf ? (
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                  <span aria-hidden="true" style={pdfBadge}>
                    PDF
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, overflowWrap: "anywhere" }}>
                      {editing.pdfName || "document.pdf"}
                    </div>
                    {editing.pdfSize ? (
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-faint)" }}>
                        {formatBytes(editing.pdfSize)}
                      </div>
                    ) : null}
                  </div>
                  <label className="btn btn-outline" style={smallBtn}>
                    Replace
                    <input type="file" accept="application/pdf,.pdf" onChange={handlePdf} style={{ display: "none" }} />
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={smallBtn}
                    onClick={() => setEditing((a) => ({ ...a, pdf: null, pdfName: "", pdfSize: null }))}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="btn btn-ember" style={{ ...smallBtn, marginTop: 6 }}>
                  Choose PDF
                  <input type="file" accept="application/pdf,.pdf" onChange={handlePdf} style={{ display: "none" }} />
                </label>
              )}
              <span style={hint}>
                Up to 20 MB. The paper&apos;s text is pulled out into the article below so search engines
                can read every word; readers can still download the formatted PDF.
              </span>
              {editing.pdf && bodyLength(editing) < 200 && (
                <div style={{ ...noticeStyle, marginTop: 12 }}>
                  This paper&apos;s text isn&apos;t on the page yet — Google sees only the summary.{" "}
                  <button
                    type="button"
                    className="btn btn-ember"
                    style={{ ...smallBtn, marginLeft: 6 }}
                    onClick={() => runImport({ source: editing.pdf })}
                    disabled={Boolean(busy)}
                  >
                    Convert the PDF into article text
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="art-title">Title *</label>
            <input id="art-title" value={editing.title} onChange={(e) => onTitle(e.target.value)} maxLength={300} />
          </div>

          {/* Web address */}
          <div className="field">
            <label htmlFor="art-slug">Web address</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <code style={{ fontSize: 14 }}>/library/</code>
              <input
                id="art-slug"
                value={editing.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", normalizeSlug(e.target.value));
                }}
                placeholder={suggestSlug(editing.title) || "article-address"}
                maxLength={80}
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>
            {!isNew && isTruncatedSlug(editing.originalSlug, editing.title) && editing.slug === editing.originalSlug && (
              <span style={{ ...hint, color: "#9c3f20" }}>
                This address is cut off mid-word.{" "}
                <button type="button" style={linkBtn} onClick={() => set("slug", suggestSlug(editing.title))}>
                  Use /library/{suggestSlug(editing.title)}
                </button>
              </span>
            )}
            <span style={hint}>
              Short and descriptive works best (e.g. <code>nike-espp</code>).
              {!isNew && editing.slug !== editing.originalSlug && editing.slug && (
                <> The old address will permanently redirect here, so existing links keep working.</>
              )}
            </span>
          </div>

          <div className="grid-2" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="art-date">Published date</label>
              <input id="art-date" value={editing.date} onChange={(e) => set("date", e.target.value)} placeholder="September 10, 2026" maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="art-reviewed">Last reviewed (optional)</label>
              <input
                id="art-reviewed"
                value={editing.reviewedDate}
                onChange={(e) => set("reviewedDate", e.target.value)}
                placeholder="August 2026"
                maxLength={60}
              />
            </div>
          </div>

          <AuthorField value={editing.author} onChange={(v) => set("author", v)} />

          <div className="field">
            <label htmlFor="art-excerpt">Summary (shown on the Library card and under the title)</label>
            <textarea
              id="art-excerpt"
              rows={3}
              value={editing.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="Two or three sentences that preview the article."
              maxLength={1200}
            />
          </div>

          <div className="field">
            <label htmlFor="art-tags">Tags (separated by commas)</label>
            <input
              id="art-tags"
              value={editing.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="nike, retirement, tax planning"
            />
            <span style={hint}>
              Readers can click a tag to find related articles. A tag that matches a specialty page — like{" "}
              <code>nike</code> or <code>intel</code> — adds the article to that page&apos;s series and links the two.
            </span>
          </div>

          {/* Thumbnail */}
          <div className="field">
            <label>{editing.kind === "video" ? "Video thumbnail *" : "Thumbnail image — optional"}</label>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  width: 200,
                  height: 105,
                  border: "1px solid var(--line)",
                  background: editing.thumbnail ? `var(--cream) url("${editing.thumbnail}") center/cover` : "var(--cream)",
                }}
              />
              <div>
                <label className="btn btn-outline" style={smallBtn}>
                  {editing.thumbnail ? "Replace image" : "Upload image"}
                  <input type="file" accept={IMAGE_ACCEPT} onChange={handleThumbnail} style={{ display: "none" }} />
                </label>
                {editing.thumbnail && (
                  <button type="button" className="btn btn-outline" style={{ ...smallBtn, marginLeft: 8 }} onClick={() => set("thumbnail", null)}>
                    Remove
                  </button>
                )}
                <span style={{ ...hint, maxWidth: "40ch" }}>
                  A wide image (about 1200 × 630) — also the picture shown when the article is shared on
                  LinkedIn.
                </span>
              </div>
            </div>
          </div>

          {/* Linked article */}
          {editing.kind === "linked" && (
            <div className="field" style={panelStyle}>
              <label htmlFor="art-ext">Article URL *</label>
              <input id="art-ext" value={editing.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://example.com/the-original-article" />
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <label style={radioRow}>
                  <input type="radio" name="externalMode" checked={editing.externalMode !== "link"} onChange={() => set("externalMode", "embed")} style={{ width: "auto", marginTop: 3 }} />
                  <span>
                    <strong>Preview it on our site</strong> — a page with your thumbnail, title, and summary, and a
                    button to the source. (Recommended.)
                  </span>
                </label>
                <label style={radioRow}>
                  <input type="radio" name="externalMode" checked={editing.externalMode === "link"} onChange={() => set("externalMode", "link")} style={{ width: "auto", marginTop: 3 }} />
                  <span>
                    <strong>Link straight to the source</strong> — the Library card opens the original site.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Video */}
          {editing.kind === "video" && (
            <div className="field" style={panelStyle}>
              <label htmlFor="art-video">LinkedIn post URL *</label>
              <input
                id="art-video"
                value={editing.videoUrl}
                onChange={(e) => set("videoUrl", e.target.value)}
                placeholder="https://www.linkedin.com/posts/…"
              />
              <span style={hint}>
                Open the video on LinkedIn, click <em>…</em> → <em>Copy link to post</em>, and paste it here. The
                Library shows your thumbnail with a play button; clicking it opens LinkedIn.
              </span>
            </div>
          )}

          {/* Body */}
          {(editing.kind === "written" || editing.kind === "pdf") && (
            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <label style={{ margin: 0 }}>{editing.kind === "pdf" ? "Paper text" : "Article body"}</label>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={smallBtn}
                  onClick={() => importInput.current?.click()}
                  disabled={Boolean(busy)}
                >
                  Import from Word or PDF
                </button>
              </div>
              <span style={{ ...hint, marginBottom: 8 }}>
                In text: a blank line starts a new paragraph; lines starting with <code>- </code> become a
                bulleted list; <code>**bold**</code>, <code>*italic*</code>, and links as{" "}
                <code>[link text](https://…)</code> or <code>[our Nike page](/nike)</code>.
              </span>
              <div style={{ border: "1px solid var(--line)", borderRadius: 3, padding: 12, background: "var(--cream)" }}>
                <InsertBar index={0} />
                {editing.blocks.map((b, i) => (
                  <div key={i}>
                    <div style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 3, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                        <span style={{ ...blockLabel, color: b.type === "text" ? "var(--brass)" : "var(--ember)" }}>
                          {b.type === "heading" ? `Heading (${b.level === 3 ? "sub-section" : "section"})` : b.type === "video" ? "Video link" : b.type}
                        </span>
                        <span style={{ display: "flex", gap: 6 }}>
                          {b.type === "heading" && (
                            <button
                              type="button"
                              style={{ ...miniBtn, width: "auto", padding: "0 8px", fontSize: 12 }}
                              onClick={() => setBlock(i, { level: b.level === 3 ? 2 : 3 })}
                              title="Switch between section and sub-section"
                            >
                              {b.level === 3 ? "H3" : "H2"}
                            </button>
                          )}
                          <button type="button" style={miniBtn} onClick={() => moveBlock(i, -1)} aria-label="Move up">
                            ↑
                          </button>
                          <button type="button" style={miniBtn} onClick={() => moveBlock(i, 1)} aria-label="Move down">
                            ↓
                          </button>
                          <button type="button" style={miniBtn} onClick={() => removeBlock(i)} aria-label="Remove">
                            ✕
                          </button>
                        </span>
                      </div>

                      {b.type === "heading" && (
                        <input
                          value={b.text || ""}
                          onChange={(e) => setBlock(i, { text: e.target.value })}
                          placeholder="Section heading"
                          aria-label="Heading text"
                          style={{ ...inputStyle, fontFamily: "var(--font-display)", fontSize: b.level === 3 ? 19 : 22 }}
                        />
                      )}

                      {b.type === "image" && (
                        <div>
                          {b.src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.src} alt="" style={{ maxWidth: "100%", maxHeight: 220, display: "block", marginBottom: 8 }} />
                          ) : (
                            <div className="ph" style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                              <span className="ph-note">No image chosen yet</span>
                            </div>
                          )}
                          <label className="btn btn-outline" style={smallBtn}>
                            {b.src ? "Replace image" : "Upload image"}
                            <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => handleBlockImage(i, e)} style={{ display: "none" }} />
                          </label>
                          <input
                            value={b.caption || ""}
                            onChange={(e) => setBlock(i, { caption: e.target.value })}
                            placeholder="Caption (optional) — e.g. Figure 1: Portfolio allocation"
                            style={{ ...inputStyle, marginTop: 8 }}
                          />
                          <input
                            value={b.alt || ""}
                            onChange={(e) => setBlock(i, { alt: e.target.value })}
                            placeholder="Describe the image for screen readers (if the caption doesn't)"
                            style={{ ...inputStyle, marginTop: 8 }}
                          />
                        </div>
                      )}

                      {b.type === "video" && (
                        <div style={{ display: "grid", gap: 8 }}>
                          <input
                            value={b.url || ""}
                            onChange={(e) => setBlock(i, { url: e.target.value })}
                            placeholder="LinkedIn post URL — https://www.linkedin.com/posts/…"
                            style={inputStyle}
                            aria-label="Video URL"
                          />
                          <input
                            value={b.title || ""}
                            onChange={(e) => setBlock(i, { title: e.target.value })}
                            placeholder="Title shown on the card (optional)"
                            style={inputStyle}
                            aria-label="Video title"
                          />
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div
                              style={{
                                width: 128,
                                height: 72,
                                border: "1px solid var(--line)",
                                background: b.thumbnail ? `url("${b.thumbnail}") center/cover` : "var(--forest)",
                              }}
                            />
                            <label className="btn btn-outline" style={smallBtn}>
                              {b.thumbnail ? "Replace thumbnail" : "Upload thumbnail"}
                              <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => handleVideoThumb(i, e)} style={{ display: "none" }} />
                            </label>
                          </div>
                          <span style={hint}>Shows a play-button card that opens the video on LinkedIn.</span>
                        </div>
                      )}

                      {b.type === "text" && (
                        <textarea
                          rows={Math.min(18, Math.max(5, Math.ceil(String(b.text || "").length / 90)))}
                          value={b.text || ""}
                          onChange={(e) => setBlock(i, { text: e.target.value })}
                          placeholder="Write here. A blank line starts a new paragraph."
                          aria-label="Text"
                          style={{ ...inputStyle, fontSize: 16, lineHeight: 1.55 }}
                        />
                      )}
                    </div>
                    <InsertBar index={i + 1} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources + disclosures */}
          {editing.kind !== "video" && (
            <details style={detailsStyle} open={Boolean(editing.sources || editing.disclosures)}>
              <summary style={summaryStyle}>Sources &amp; disclosures</summary>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="art-sources">Sources and documents reviewed</label>
                <textarea id="art-sources" rows={3} value={editing.sources} onChange={(e) => set("sources", e.target.value)} maxLength={6000} />
                <span style={hint}>
                  Shown in small print at the end, with “Information reviewed as of” the Last reviewed date.
                </span>
              </div>
              <div className="field">
                <label htmlFor="art-disc">Disclosures for this piece</label>
                <textarea id="art-disc" rows={4} value={editing.disclosures} onChange={(e) => set("disclosures", e.target.value)} maxLength={8000} />
                <span style={hint}>The compliance-approved disclosures that go with this piece, if any.</span>
              </div>
            </details>
          )}

          {/* Search listing */}
          <details style={detailsStyle}>
            <summary style={summaryStyle}>Search listing (optional)</summary>
            <SeoPreview editing={editing} set={set} />
          </details>

          <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", fontFamily: "var(--font-sans)", fontSize: 15 }}>
            <input type="checkbox" checked={editing.published} onChange={(e) => set("published", e.target.checked)} style={{ width: "auto" }} />
            Published (visible in the Library)
          </label>

          <Banner />

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-ember" disabled={saving || Boolean(busy)}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => confirmDiscard() && setEditing(null)}>
              Cancel
            </button>
            {!isNew && editing.published && (
              <a href={`/library/${editing.originalSlug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ember)", fontSize: 14 }}>
                View live ↗
              </a>
            )}
          </div>
        </form>
      )}

      {/* ---- List ---- */}
      {editing ? null : loading ? (
        <p className="muted">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="card" style={{ background: "#fff", textAlign: "center" }}>
          <p className="muted">
            Nothing here yet. Click <strong>+ New</strong> to add an article, white paper, or video.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {articles.map((a) => {
            const kind = kindOf(a);
            const flags = [];
            if (!a.published) flags.push("Draft (hidden)");
            if (isTruncatedSlug(a.slug, a.title)) flags.push("Address cut off");
            if (kind === "pdf" && bodyLength(a) < 200) flags.push("Text not on page yet");
            return (
              <div key={a.slug} className="card" style={{ background: "#fff", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 80,
                    height: 54,
                    flexShrink: 0,
                    background: a.thumbnail ? `var(--cream-deep) url("${a.thumbnail}") center/cover` : "var(--cream-deep)",
                    borderRadius: 2,
                  }}
                />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ ...blockLabel, color: "var(--brass)" }}>{KIND_LABELS[kind]}</div>
                  <h3 style={{ fontSize: "1.25rem" }}>{plainText(a.title)}</h3>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, marginTop: 3, overflowWrap: "anywhere" }}>
                    <a href={`/library/${a.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ember)" }}>
                      /library/{a.slug} ↗
                    </a>
                    {flags.map((f) => (
                      <span key={f} style={{ color: f.startsWith("Draft") ? "var(--ink-faint)" : "#9c3f20", marginLeft: 10 }}>
                        · {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline" style={{ padding: "8px 18px" }} onClick={() => startEdit(a)}>
                    Edit
                  </button>
                  <button className="btn btn-outline" style={{ padding: "8px 18px" }} onClick={() => handleDelete(a)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Byline: a plain author name (defaults to no byline).
function AuthorField({ value, onChange }) {
  return (
    <div className="field">
      <label htmlFor="art-author">Author</label>
      <input
        id="art-author"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Author name (leave blank for no byline)"
        style={{ ...inputStyle, maxWidth: 420 }}
        maxLength={120}
      />
      <span style={hint}>Leave blank for no byline.</span>
    </div>
  );
}

// A Google-style preview of the search listing, with optional overrides.
function SeoPreview({ editing, set }) {
  const titleShown = plainText(editing.seoTitle) || plainText(editing.title) || "Article title";
  const descShown = clampText(editing.seoDescription || editing.excerpt, 158) || "The summary appears here.";
  const count = (n, max) => (
    <span style={{ color: n > max ? "#9c3f20" : "var(--ink-faint)" }}>
      {n}/{max}
    </span>
  );
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ border: "1px solid var(--line)", background: "#fff", padding: "14px 16px", marginBottom: 14, fontFamily: "Arial, sans-serif" }}>
        <div style={{ fontSize: 13, color: "#4d5156", overflowWrap: "anywhere" }}>
          oswegolegacypartners.com › library › {normalizeSlug(editing.slug) || suggestSlug(editing.title)}
        </div>
        <div style={{ fontSize: 19, color: "#1a0dab", margin: "4px 0", lineHeight: 1.3 }}>{clampText(titleShown, 62)}</div>
        <div style={{ fontSize: 14, color: "#4d5156", lineHeight: 1.45 }}>{descShown}</div>
      </div>
      <div className="field">
        <label htmlFor="art-seo-title">
          Search headline {count(plainText(editing.seoTitle || editing.title).length, 60)}
        </label>
        <input id="art-seo-title" value={editing.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={plainText(editing.title)} maxLength={120} />
        <span style={hint}>Leave blank to use the title. Google shows about 60 characters.</span>
      </div>
      <div className="field">
        <label htmlFor="art-seo-desc">
          Search description {count(plainText(editing.seoDescription || editing.excerpt).length, 158)}
        </label>
        <textarea id="art-seo-desc" rows={3} value={editing.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} placeholder={clampText(editing.excerpt, 158)} maxLength={320} />
        <span style={hint}>Leave blank to use the summary, shortened. Aim for about 155 characters.</span>
      </div>
    </div>
  );
}

// ---- styles ----
function bannerStyle(type) {
  const palette =
    type === "error"
      ? ["#e0a58f", "#fbeee8", "#9c3f20"]
      : type === "warn"
      ? ["#dcc58f", "#fbf5e6", "#6b5320"]
      : ["#a9c3a0", "#eef4ea", "#33502f"];
  return {
    padding: "10px 14px",
    marginBottom: 18,
    border: "1px solid",
    borderColor: palette[0],
    background: palette[1],
    color: palette[2],
    fontSize: 15,
  };
}
const noticeStyle = {
  padding: "12px 16px",
  border: "1px solid #dcc58f",
  background: "#fbf5e6",
  color: "#5a4719",
  fontSize: 14.5,
  lineHeight: 1.55,
};
const panelStyle = { border: "1px solid var(--line)", borderRadius: 3, padding: 14, background: "var(--cream)" };
const hint = { fontSize: 13, color: "var(--ink-faint)", display: "block", marginTop: 6 };
const smallBtn = { cursor: "pointer", fontSize: 12, padding: "9px 16px" };
const inputStyle = {
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--ink)",
  background: "#fff",
  border: "1px solid var(--line)",
  padding: "10px 12px",
};
const linkBtn = {
  background: "none",
  border: "none",
  color: "var(--ember)",
  cursor: "pointer",
  fontSize: 13.5,
  padding: 0,
  marginBottom: 12,
  textDecoration: "underline",
};
const radioRow = { display: "flex", gap: 8, alignItems: "flex-start", fontFamily: "var(--font-sans)", fontSize: 14 };
const pdfBadge = {
  width: 38,
  height: 48,
  border: "1px solid var(--line)",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-sans)",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--ember)",
};
const blockLabel = {
  fontFamily: "var(--font-sans)",
  fontSize: 11.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};
const detailsStyle = { border: "1px solid var(--line)", padding: "12px 16px", marginTop: 8, marginBottom: 8, background: "#fff" };
const summaryStyle = {
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--brass)",
  fontWeight: 650,
};
const insertBtn = {
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px dashed var(--brass)",
  background: "transparent",
  color: "var(--brass)",
  cursor: "pointer",
};
const miniBtn = {
  width: 28,
  height: 28,
  border: "1px solid var(--line)",
  background: "#fff",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  color: "var(--ink-soft)",
};
const kindCard = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textAlign: "left",
  padding: "20px 22px",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "var(--cream-card)",
  cursor: "pointer",
};
const kindCardTitle = { fontFamily: "var(--font-display)", fontSize: "1.35rem", color: "var(--ink)" };
const kindCardDesc = { fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)" };
