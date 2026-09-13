"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProjectsManager from "@/components/admin/ProjectsManager";
import ContentManager from "@/components/admin/ContentManager";
import ArticlesManager from "@/components/admin/ArticlesManager";
import BackupManager from "@/components/admin/BackupManager";
import LandingManager from "@/components/admin/LandingManager";
import InboxManager from "@/components/admin/InboxManager";
import { adminFetch, setUnauthorizedHandler } from "@/lib/adminFetch";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsavedChanges";

// Shipped wording for every label on a specialty page. Mirrors
// PAGE_LABEL_DEFAULTS on the server so the form always shows the real text.
const PAGE_LABELS = {
  heroTagline: "Enduring Wealth. Structured Decisions.",
  heroCtaLabel: "Begin a Private Conversation",
  serveEyebrow: "Who We Serve",
  successEyebrow: "The Complexity Beneath Success",
  questionsIntro: "The questions that remain are the ones that matter most:",
  approachEyebrow: "A More Structured Approach",
  relatedEyebrow: "From the Library",
  relatedTitle: "Related insights",
};

const EMPTY_BLOCK = { heading: "", body: "", linkLabel: "", linkHref: "" };

const EMPTY_PAGE = {
  slug: "",
  audience: "",
  heroEyebrow: "",
  heroTitle: "",
  heroSub: "",
  serveLine: "",
  successLine: "",
  questions: ["", "", ""],
  blocks: [{ ...EMPTY_BLOCK }],
  relatedTag: "",
  showApproach: true,
  published: true,
  seoTitle: "",
  seoDescription: "",
  ...PAGE_LABELS,
};

// Mirrors PAGE_LIMITS in lib/pagesStore — the form stops typing at the same
// length the server keeps, so text is never silently cut off.
// These mirror PAGE_LIMITS in lib/pagesStore, which is what the server
// actually enforces. They cannot be imported from there — that module reaches
// the database — so they are written out, and must be kept in step. Anything
// missing here is silently cut on save under a "Saved" message.
const LIMITS = {
  heroTitle: 200,
  heroSub: 2000,
  serveLine: 600,
  successLine: 600,
  questionsIntro: 400,
  seoTitle: 120,
  seoDescription: 320,
};

function Count({ value, max, warn }) {
  const n = String(value || "").length;
  return (
    <span style={{ marginLeft: 8, color: n > (warn || max) ? "#9c3f20" : "var(--ink-faint)", letterSpacing: 0 }}>
      {n}/{warn || max}
    </span>
  );
}

export default function AdminDashboard({ insecure = false }) {
  const router = useRouter();

  // Any tab that gets a 401 re-renders this page, which swaps in the sign-in
  // screen. Without it an expired session just looked like empty tabs.
  useEffect(() => {
    setUnauthorizedHandler(() => router.refresh());
    return () => setUnauthorizedHandler(null);
  }, [router]);
  const [tab, setTab] = useState("pages"); // pages | team
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  useUnsavedChanges(editing);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState(null);
  const [storage, setStorage] = useState(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json, error } = await adminFetch("/api/admin/pages");
    if (ok) setPages(json.pages || []);
    else setMsg({ type: "error", text: error });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/storage")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setStorage(s))
      .catch(() => {});
    // Unread count for the Inbox tab badge.
    fetch("/api/admin/submissions?summary=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setUnread(s.unread || 0))
      .catch(() => {});
  }, [load]);

  function startNew() {
    setEditing({
      ...EMPTY_PAGE,
      questions: ["", "", ""],
      blocks: [{ ...EMPTY_BLOCK }],
    });
    setIsNew(true);
    setMsg(null);
  }

  function startEdit(p) {
    setEditing({
      ...EMPTY_PAGE,
      ...p,
      // Pages saved before these fields existed show the shipped wording, so
      // editing one never silently blanks a label that's live on the site.
      heroEyebrow: p.heroEyebrow ?? (p.audience ? `For ${p.audience}` : ""),
      questions: p.questions?.length ? p.questions : ["", "", ""],
      blocks: p.blocks?.length
        ? p.blocks.map((b) => ({ ...EMPTY_BLOCK, ...b }))
        : [{ ...EMPTY_BLOCK }],
    });
    setIsNew(false);
    setMsg(null);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  async function handleSave(e) {
    e.preventDefault();
    setMsg(null);
    const payload = {
      ...editing,
      questions: editing.questions.map((q) => q.trim()).filter(Boolean),
      blocks: editing.blocks.filter((b) => b.heading.trim() || b.body.trim()),
    };
    const { ok, json, error } = await adminFetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (ok) {
      setMsg({ type: "ok", text: `Saved. Live at /${json.page.slug}` });
      setEditing(null);
      load();
    } else {
      setMsg({ type: "error", text: error });
    }
  }

  async function handleDelete(slug) {
    if (!confirm(`Delete the page "/${slug}"? This cannot be undone.`)) return;
    const { ok, error } = await adminFetch(`/api/admin/pages?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    if (ok) {
      setMsg({ type: "ok", text: `Deleted /${slug}.` });
      load();
    } else {
      setMsg({ type: "error", text: error });
    }
  }

  // ---- page field helpers ----
  const set = (k, v) => setEditing((p) => ({ ...p, [k]: v }));
  const setQuestion = (i, v) =>
    setEditing((p) => {
      const q = [...p.questions];
      q[i] = v;
      return { ...p, questions: q };
    });
  const addQuestion = () =>
    setEditing((p) => ({ ...p, questions: [...p.questions, ""] }));
  const removeQuestion = (i) =>
    setEditing((p) => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }));
  const setBlock = (i, k, v) =>
    setEditing((p) => {
      const b = [...p.blocks];
      b[i] = { ...b[i], [k]: v };
      return { ...p, blocks: b };
    });
  const addBlock = () =>
    setEditing((p) => ({ ...p, blocks: [...p.blocks, { ...EMPTY_BLOCK }] }));
  const removeBlock = (i) =>
    setEditing((p) => ({ ...p, blocks: p.blocks.filter((_, idx) => idx !== i) }));
  const moveBlock = (i, dir) =>
    setEditing((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.blocks.length) return p;
      const b = [...p.blocks];
      [b[i], b[j]] = [b[j], b[i]];
      return { ...p, blocks: b };
    });
  const moveQuestion = (i, dir) =>
    setEditing((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.questions.length) return p;
      const q = [...p.questions];
      [q[i], q[j]] = [q[j], q[i]];
      return { ...p, questions: q };
    });

  const tabBtn = (key, label, badge = 0) => (
    <button
      onClick={() => {
        // Each tab unmounts the one before it, taking any half-written article
        // or landing page with it.
        if (confirmDiscard()) setTab(key);
      }}
      aria-pressed={tab === key}
      style={{
        padding: "10px 22px",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        background: tab === key ? "var(--forest-2)" : "transparent",
        color: tab === key ? "#f4efe2" : "var(--ink-soft)",
        border: "1px solid var(--line)",
        borderColor: tab === key ? "var(--forest-2)" : "var(--line)",
      }}
    >
      {label}
      {badge > 0 && (
        <span
          aria-label={`${badge} new`}
          style={{
            marginLeft: 8,
            background: "var(--ember)",
            color: "#fff",
            borderRadius: 999,
            padding: "1px 7px",
            fontSize: 11,
            letterSpacing: 0,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ maxWidth: 900, marginInline: "auto" }}>
      {/* Still on the built-in password. Shown here rather than on the sign-in
          page, so the site never advertises it to a stranger. */}
      {insecure && (
        <div
          className="ph"
          style={{ padding: "12px 14px", borderRadius: 2, marginBottom: 18 }}
        >
          <span className="ph-badge">⚠ Default password in use</span>{" "}
          <span className="ph-note">
            This dashboard is still using the built-in password. Set{" "}
            <code>ADMIN_PASSWORD</code> (and <code>ADMIN_SESSION_SECRET</code>)
            in the hosting environment, then redeploy.
          </span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div className="eyebrow">Admin Dashboard</div>
          <h1 style={{ fontSize: "2.4rem", marginTop: 8 }}>
            {tab === "pages"
              ? "Professional Pages"
              : tab === "team"
              ? "Team Members"
              : tab === "library"
              ? "Library"
              : tab === "landing"
              ? "Landing Pages"
              : tab === "inbox"
              ? "Inbox"
              : tab === "backup"
              ? "Backup & Restore"
              : "Site Content"}
          </h1>
        </div>
        <button className="btn btn-outline" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      {/* Storage status (applies to everything) */}
      {storage &&
        (() => {
          const ok = storage.persistent && storage.connected;
          return (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: 20,
                border: "1px solid",
                borderColor: ok ? "#a9c3a0" : "#e0a58f",
                background: ok ? "#eef4ea" : "#fbeee8",
                color: ok ? "#33502f" : "#9c3f20",
                fontSize: 14.5,
                lineHeight: 1.55,
              }}
            >
              {storage.mode === "postgres" ? (
                storage.connected ? (
                  <>
                    ✅ <strong>Storage is persistent (Postgres).</strong> Pages
                    and team edits are saved to your Railway database and survive
                    every redeploy.
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Database not reachable.</strong>{" "}
                    {storage.error ? storage.error : "Check DATABASE_URL."} Edits
                    can&apos;t be saved until this is fixed.
                  </>
                )
              ) : storage.persistent ? (
                <>
                  ✅ <strong>Storage is persistent.</strong> Saved to{" "}
                  <code>{storage.dataDir}</code>.
                </>
              ) : (
                <>
                  ⚠️ <strong>Storage is NOT persistent.</strong> Add a{" "}
                  <strong>Postgres database</strong> in Railway (it sets{" "}
                  <code>DATABASE_URL</code> automatically) so pages and team
                  edits persist across redeploys.
                </>
              )}
            </div>
          );
        })()}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap" }}>
        {tabBtn("inbox", "Inbox", unread)}
        {tabBtn("content", "Content")}
        {tabBtn("projects", "Projects")}
        {tabBtn("pages", "Pages")}
        {tabBtn("library", "Library")}
        {tabBtn("landing", "Landing Pages")}
        {tabBtn("backup", "Backup")}
      </div>

      {/* ---------------- INBOX TAB ---------------- */}
      {tab === "inbox" && <InboxManager onCount={setUnread} />}

      {/* ---------------- LANDING PAGES TAB ---------------- */}
      {tab === "landing" && <LandingManager />}

      {/* ---------------- CONTENT TAB ---------------- */}
      {tab === "content" && <ContentManager />}

      {/* ---------------- PROJECTS TAB ---------------- */}
      {tab === "projects" && <ProjectsManager />}

      {/* ---------------- LIBRARY TAB ---------------- */}
      {tab === "library" && <ArticlesManager />}

      {/* ---------------- BACKUP TAB ---------------- */}
      {tab === "backup" && <BackupManager />}

      {/* ---------------- PAGES TAB ---------------- */}
      {tab === "pages" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <p className="muted" style={{ fontSize: 16, margin: 0, maxWidth: "58ch" }}>
              Every professional page — including Nike, Intel, and Healthcare —
              lives here. Click <strong>Edit</strong> to change any of them, or{" "}
              <strong>+ New Page</strong> to add one (it goes live at{" "}
              <code>/your-slug</code> using the same template).
            </p>
            <button className="btn btn-ember" onClick={startNew}>
              + New Page
            </button>
          </div>

          {msg && (
            <p
              style={{
                padding: "10px 14px",
                marginBottom: 18,
                border: "1px solid",
                borderColor: msg.type === "error" ? "#e0a58f" : "#a9c3a0",
                background: msg.type === "error" ? "#fbeee8" : "#eef4ea",
                color: msg.type === "error" ? "#9c3f20" : "#33502f",
                fontSize: 15,
              }}
            >
              {msg.text}
            </p>
          )}

          {/* Editor */}
          {editing && (
            <form
              onSubmit={handleSave}
              className="card"
              style={{ background: "#fff", marginBottom: 30 }}
            >
              <h2 style={{ fontSize: "1.7rem", marginBottom: 6 }}>
                {isNew ? "New Page" : `Editing /${editing.slug}`}
              </h2>

              <div className="grid-2" style={{ gap: 20 }}>
                <div className="field">
                  <label>URL Slug *</label>
                  <input
                    value={editing.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="hp"
                    disabled={!isNew}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>
                    Lives at <code>/{editing.slug || "your-slug"}</code>
                    {!isNew && " · slug can't be changed after creation"}
                  </span>
                </div>
                <div className="field">
                  <label>Audience *</label>
                  <input
                    value={editing.audience}
                    onChange={(e) => set("audience", e.target.value)}
                    placeholder="HP Professionals"
                  />
                </div>
              </div>

              <p className="muted" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
                Every piece of text on this page is editable below. Formatting:{" "}
                <code>**bold**</code>, <code>*italic*</code>. Leave a label blank
                to hide it.
              </p>

              {/* ---- Hero ---- */}
              <FieldGroup title="Top of the page (hero)">
                <div className="field">
                  <label>Small label above the title</label>
                  <input
                    value={editing.heroEyebrow}
                    onChange={(e) => set("heroEyebrow", e.target.value)}
                    placeholder="For HP Professionals"
                  />
                </div>
                <div className="field">
                  <label>Hero Title *</label>
                  <input
                    value={editing.heroTitle}
                    onChange={(e) => set("heroTitle", e.target.value)}
                    placeholder="Retirement Planning for HP Professionals"
                    maxLength={LIMITS.heroTitle}
                  />
                </div>
                <div className="field">
                  <label>Tagline (italic line under the title)</label>
                  <input
                    value={editing.heroTagline}
                    onChange={(e) => set("heroTagline", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>
                    Hero paragraph <Count value={editing.heroSub} max={LIMITS.heroSub} />
                  </label>
                  <textarea
                    rows={4}
                    value={editing.heroSub}
                    onChange={(e) => set("heroSub", e.target.value)}
                    placeholder="Helping HP professionals coordinate equity, income, and retirement."
                    maxLength={LIMITS.heroSub}
                  />
                </div>
                <div className="field">
                  <label>Button text</label>
                  <input
                    value={editing.heroCtaLabel}
                    onChange={(e) => set("heroCtaLabel", e.target.value)}
                  />
                </div>
              </FieldGroup>

              {/* ---- Who We Serve ---- */}
              <FieldGroup title="“Who We Serve” section">
                <div className="field">
                  <label>Small label</label>
                  <input
                    value={editing.serveEyebrow}
                    onChange={(e) => set("serveEyebrow", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Heading</label>
                  <textarea
                    rows={2}
                    value={editing.serveLine}
                    onChange={(e) => set("serveLine", e.target.value)}
                    placeholder="Senior professionals at HP navigating the transition to retirement."
                    maxLength={LIMITS.serveLine}
                  />
                </div>
              </FieldGroup>

              {/* ---- Complexity + questions ---- */}
              <FieldGroup title="“Complexity Beneath Success” section">
                <div className="field">
                  <label>Small label</label>
                  <input
                    value={editing.successEyebrow}
                    onChange={(e) => set("successEyebrow", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Heading</label>
                  <textarea
                    rows={2}
                    value={editing.successLine}
                    onChange={(e) => set("successLine", e.target.value)}
                    placeholder="Most HP professionals have done everything right."
                    maxLength={LIMITS.successLine}
                  />
                </div>
                <div className="field">
                  <label>Intro line above the questions</label>
                  <input
                    value={editing.questionsIntro}
                    maxLength={LIMITS.questionsIntro}
                    onChange={(e) => set("questionsIntro", e.target.value)}
                  />
                  <Count value={editing.questionsIntro} max={LIMITS.questionsIntro} />
                </div>
                <div className="field">
                  <label>Questions</label>
                  {editing.questions.map((q, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        value={q}
                        onChange={(e) => setQuestion(i, e.target.value)}
                        placeholder="How should equity be managed?"
                      />
                      <MoveButtons
                        onUp={() => moveQuestion(i, -1)}
                        onDown={() => moveQuestion(i, 1)}
                        onRemove={() => removeQuestion(i)}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="btn btn-outline"
                    style={{ padding: "8px 16px", fontSize: 12 }}
                  >
                    + Add question
                  </button>
                </div>
              </FieldGroup>

              {/* ---- Freeform sections ---- */}
              <FieldGroup title="Extra sections (optional)">
                <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
                  Add as many as you like, reorder them with the arrows, and give
                  any one an optional link — for example a “Read more” that points
                  to another page on the site.
                </p>
                {editing.blocks.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid var(--line)",
                      background: "var(--cream)",
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 11.5,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--brass)",
                        }}
                      >
                        Section {i + 1}
                      </span>
                      <MoveButtons
                        onUp={() => moveBlock(i, -1)}
                        onDown={() => moveBlock(i, 1)}
                        onRemove={() => removeBlock(i)}
                      />
                    </div>
                    <input
                      value={b.heading}
                      onChange={(e) => setBlock(i, "heading", e.target.value)}
                      placeholder="Section heading"
                      style={{ marginBottom: 8 }}
                    />
                    <textarea
                      value={b.body}
                      onChange={(e) => setBlock(i, "body", e.target.value)}
                      placeholder="Section text… Press Enter for line breaks."
                      rows={4}
                    />
                    <div className="grid-2" style={{ gap: 12, marginTop: 10 }}>
                      <input
                        value={b.linkLabel}
                        onChange={(e) => setBlock(i, "linkLabel", e.target.value)}
                        placeholder="Link text (optional) — e.g. Read more"
                      />
                      <input
                        value={b.linkHref}
                        onChange={(e) => setBlock(i, "linkHref", e.target.value)}
                        placeholder="/services  or  https://…"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBlock}
                  className="btn btn-outline"
                  style={{ padding: "8px 16px", fontSize: 12 }}
                >
                  + Add section
                </button>
              </FieldGroup>

              {/* ---- Approach band ---- */}
              <FieldGroup title="“A More Structured Approach” band">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editing.showApproach !== false}
                    onChange={(e) => set("showApproach", e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  Show this band on the page
                </label>
                <div className="field">
                  <label>Small label</label>
                  <input
                    value={editing.approachEyebrow}
                    onChange={(e) => set("approachEyebrow", e.target.value)}
                  />
                </div>
                <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
                  The heading and steps in this band come from{" "}
                  <strong>Content → Home</strong> and{" "}
                  <strong>Content → Approach Steps</strong>, so they stay
                  consistent across the whole site.
                </p>
              </FieldGroup>

              {/* ---- Related articles ---- */}
              <FieldGroup title="Related Library articles">
                <div className="field">
                  <label>Show articles with this tag</label>
                  <input
                    value={editing.relatedTag}
                    onChange={(e) => set("relatedTag", e.target.value)}
                    placeholder="nike"
                  />
                  <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>
                    Every published Library article tagged with this word is
                    linked from this page (the newest three as cards, then the
                    full list), and each of those articles links back here. Leave
                    blank to hide the section.
                  </span>
                </div>
                <div className="grid-2" style={{ gap: 16 }}>
                  <div className="field">
                    <label>Small label</label>
                    <input
                      value={editing.relatedEyebrow}
                      onChange={(e) => set("relatedEyebrow", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Heading</label>
                    <input
                      value={editing.relatedTitle}
                      onChange={(e) => set("relatedTitle", e.target.value)}
                    />
                  </div>
                </div>
              </FieldGroup>

              {/* ---- Search listing ---- */}
              <FieldGroup title="Search listing (Google)">
                <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
                  What Google shows for this page. Leave blank to use a default
                  written for it (Nike, Intel, and Healthcare have ones naming
                  Beaverton, Hillsboro, and Portland). Name the audience and the
                  place — that&apos;s what people search for.
                </p>
                <div className="field">
                  <label>
                    Search headline <Count value={editing.seoTitle} max={LIMITS.seoTitle} warn={60} />
                  </label>
                  <input
                    value={editing.seoTitle || ""}
                    onChange={(e) => set("seoTitle", e.target.value)}
                    placeholder="Financial Planning for HP Employees in Portland"
                    maxLength={LIMITS.seoTitle}
                  />
                </div>
                <div className="field">
                  <label>
                    Search description <Count value={editing.seoDescription} max={LIMITS.seoDescription} warn={158} />
                  </label>
                  <textarea
                    rows={3}
                    value={editing.seoDescription || ""}
                    onChange={(e) => set("seoDescription", e.target.value)}
                    placeholder="About 155 characters: who it's for, where, and the benefits you help with."
                    maxLength={LIMITS.seoDescription}
                  />
                </div>
              </FieldGroup>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "6px 0 18px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                }}
              >
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => set("published", e.target.checked)}
                  style={{ width: "auto" }}
                />
                Published (visible to the public)
              </label>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn-ember">
                  Save Page
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => confirmDiscard() && setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Page list */}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : pages.length === 0 ? (
            <div className="card" style={{ background: "#fff", textAlign: "center" }}>
              <p className="muted">
                No pages yet. Click <strong>+ New Page</strong> to create one.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {pages.map((p) => (
                <div
                  key={p.slug}
                  className="card"
                  style={{
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "1.4rem" }}>
                      {p.audience || p.heroTitle || p.slug}
                    </h3>
                    <div
                      style={{ fontFamily: "var(--font-sans)", fontSize: 14, marginTop: 4 }}
                    >
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--ember)" }}
                      >
                        /{p.slug} ↗
                      </a>
                      {!p.published && (
                        <span style={{ color: "var(--ink-faint)", marginLeft: 10 }}>
                          · Draft (hidden)
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "8px 18px" }}
                      onClick={() => startEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "8px 18px" }}
                      onClick={() => handleDelete(p.slug)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A titled group of related fields, so the long page editor stays scannable.
function FieldGroup({ title, children }) {
  return (
    <fieldset
      style={{
        border: "1px solid var(--line)",
        padding: "18px 18px 6px",
        marginBottom: 22,
        background: "#fff",
      }}
    >
      <legend
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--brass)",
          fontWeight: 650,
          padding: "0 8px",
        }}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

// Reorder / remove controls shared by the question and section lists.
function MoveButtons({ onUp, onDown, onRemove }) {
  const btn = {
    width: 30,
    height: 30,
    border: "1px solid var(--line)",
    background: "#fff",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    color: "var(--ink-soft)",
    flexShrink: 0,
  };
  return (
    <span style={{ display: "flex", gap: 6 }}>
      <button type="button" style={btn} onClick={onUp} title="Move up" aria-label="Move up">
        ↑
      </button>
      <button type="button" style={btn} onClick={onDown} title="Move down" aria-label="Move down">
        ↓
      </button>
      <button type="button" style={btn} onClick={onRemove} title="Remove" aria-label="Remove">
        ✕
      </button>
    </span>
  );
}
