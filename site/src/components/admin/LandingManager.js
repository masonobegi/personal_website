"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { uploadFile, uploadImage, IMAGE_ACCEPT, formatBytes } from "@/lib/clientImage";
import { normalizeSlug } from "@/lib/slugs";
import { adminFetch } from "@/lib/adminFetch";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsavedChanges";

// Builder for ad landing pages (/go/<slug>). Each page: an intro, an optional
// scored questionnaire, the contact form, what happens after (download,
// schedule, or thanks), where to send people next, and who gets emailed.

const rid = () => Math.random().toString(36).slice(2, 10);

const newQuestion = () => ({
  id: rid(),
  text: "",
  help: "",
  type: "single",
  required: true,
  options: [
    { id: rid(), label: "", points: 1 },
    { id: rid(), label: "", points: 3 },
    { id: rid(), label: "", points: 5 },
  ],
});

const EMPTY = {
  slug: "",
  originalSlug: "",
  name: "",
  published: false,
  eyebrow: "",
  headline: "",
  subhead: "",
  bullets: [""],
  image: "",
  quiz: { enabled: false, title: "", intro: "", startLabel: "", showPoints: false, showScore: true, questions: [], results: [] },
  form: {
    heading: "",
    sub: "",
    phone: "optional",
    message: "hidden",
    messageLabel: "",
    submitLabel: "",
    consent: "",
  },
  offer: { type: "download", pdf: "", pdfName: "", downloadLabel: "Download the guide", scheduleUrl: "", scheduleLabel: "Schedule a consultation" },
  thanks: {
    heading: "",
    message: "",
    redirectTo: "",
    redirectLabel: "",
    autoRedirect: true,
    redirectDelay: 20,
  },
  notify: { notifyAll: true, memberIds: [], firmInbox: true },
};

// Same rules as the server (lib/landingStore → maxScore).
function scoreRange(quiz) {
  let max = 0;
  let min = 0;
  for (const q of quiz.questions) {
    const pts = q.options.map((o) => Number(o.points) || 0);
    if (q.type === "single" && pts.length) {
      max += Math.max(0, ...pts);
      if (q.required) min += Math.min(...pts);
    } else if (q.type === "multi") {
      max += pts.reduce((s, p) => s + Math.max(0, p), 0);
      min += pts.reduce((s, p) => s + Math.min(0, p), 0);
    }
  }
  return { min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100 };
}

// Scores that no result range covers (only checked on whole numbers, which is
// what these questionnaires produce).
function uncoveredScores(quiz) {
  if (!quiz.results.length) return [];
  const { min, max } = scoreRange(quiz);
  const gaps = [];
  for (let s = Math.floor(min); s <= Math.ceil(max) && gaps.length < 6; s++) {
    if (!quiz.results.some((r) => s >= Number(r.min) && s <= Number(r.max))) gaps.push(s);
  }
  return gaps;
}

export default function LandingManager() {
  const [pages, setPages] = useState([]);
  const [team, setTeam] = useState([]);
  const [firmInbox, setFirmInbox] = useState([]);
  const [emailOn, setEmailOn] = useState(true);
  const [sitePages, setSitePages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  useUnsavedChanges(editing);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, pagesRes] = await Promise.all([
      adminFetch("/api/admin/landing"),
      adminFetch("/api/admin/pages"),
    ]);
    if (!res.ok) {
      setMsg({ type: "error", text: res.error });
      setLoading(false);
      return;
    }
    const json = res.json;
    setPages(json.pages || []);
    setTeam(json.team || []);
    setFirmInbox(json.firmInbox || []);
    setEmailOn(Boolean(json.emailConfigured));
    if (pagesRes.ok) {
      setSitePages((pagesRes.json.pages || []).filter((p) => p.published !== false));
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const redirectOptions = useMemo(
    () => [
      { value: "", label: "Nowhere — stay on the thank-you screen" },
      ...sitePages.map((p) => ({ value: `/${p.slug}`, label: `${p.audience || p.slug} page (/${p.slug})` })),
      { value: "/", label: "Home page" },
      { value: "/library", label: "Library" },
      { value: "/services", label: "Services" },
      { value: "/about", label: "About" },
      { value: "/intake", label: "Connect / scheduling page" },
    ],
    [sitePages]
  );

  // ---- editing helpers ----
  const set = (path, value) =>
    setEditing((e) => {
      const next = structuredClone(e);
      let o = next;
      for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
      o[path[path.length - 1]] = value;
      return next;
    });
  const update = (fn) => setEditing((e) => {
    const next = structuredClone(e);
    fn(next);
    return next;
  });

  function startNew() {
    setEditing({ ...structuredClone(EMPTY), notify: { notifyAll: true, memberIds: [], firmInbox: true } });
    setMsg(null);
  }
  function startEdit(p) {
    setEditing({
      ...structuredClone(EMPTY),
      ...structuredClone(p),
      originalSlug: p.slug,
      bullets: p.bullets?.length ? [...p.bullets] : [""],
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function duplicate(p) {
    const copy = structuredClone(p);
    setEditing({
      ...structuredClone(EMPTY),
      ...copy,
      slug: `${p.slug}-copy`,
      originalSlug: "",
      name: `${p.name || p.headline} (copy)`,
      published: false,
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e) {
    e.preventDefault();
    const d = editing;
    if (!normalizeSlug(d.slug)) return setMsg({ type: "error", text: "Please set a web address." });
    if (!d.headline.trim()) return setMsg({ type: "error", text: "Please add a headline." });
    if (d.quiz.enabled) {
      const bad = d.quiz.questions.find((q) => !q.text.trim() || (q.type !== "text" && q.options.filter((o) => o.label.trim()).length < 2));
      if (bad) return setMsg({ type: "error", text: "Every question needs its text and at least two answers (or make it a short-answer question)." });
    }
    setSaving(true);
    // Through adminFetch like every other write in the dashboard: a dropped
    // connection used to throw here, leaving the button on "Saving…" for ever
    // with the only copy of the page in the form.
    const { ok, json, error } = await adminFetch("/api/admin/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, slug: normalizeSlug(d.slug), bullets: d.bullets.filter((b) => b.trim()) }),
    });
    setSaving(false);
    if (!ok) return setMsg({ type: "error", text: error });
    setMsg({
      type: "ok",
      text:
        `Saved ✓ — ${json.page.published ? "live" : "draft"} at /go/${json.page.slug}. ` +
        (json.recipients?.length ? `New submissions email: ${json.recipients.join(", ")}.` : "No one has a real email address yet — submissions will only appear in the Inbox."),
    });
    setEditing(null);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(p) {
    if (!confirm(`Delete the landing page /go/${p.slug}? Its past submissions stay in the Inbox.`)) return;
    const { ok, error } = await adminFetch(
      `/api/admin/landing?slug=${encodeURIComponent(p.slug)}`,
      { method: "DELETE" }
    );
    if (!ok) {
      setMsg({ type: "error", text: error });
      return;
    }
    setMsg({ type: "ok", text: `Deleted /go/${p.slug}.` });
    load();
  }

  async function onImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg({ type: "ok", text: "Uploading image…" });
    try {
      const up = await uploadImage(file, 1400);
      set(["image"], up.url);
      setMsg(null);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  async function onPdf(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg({ type: "ok", text: "Uploading PDF…" });
    try {
      // Stored privately: only people who submit the form get a link to it.
      const up = await uploadFile(file, { isPrivate: true });
      update((d) => {
        d.offer.pdf = up.url;
        d.offer.pdfName = up.name || file.name;
        d.offer.pdfSize = up.size;
      });
      setMsg(null);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  const Banner = () =>
    msg ? (
      <p role="status" style={bannerStyle(msg.type)}>
        {msg.text}
      </p>
    ) : null;

  // =========================================================================
  if (!editing) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <p className="muted" style={{ fontSize: 16, margin: 0, maxWidth: "64ch" }}>
            Landing pages are where ads send people: a page at <code>/go/…</code> with <strong>no site
            navigation</strong> — just your offer, an optional questionnaire, and a form. Every submission lands
            in the <strong>Inbox</strong> with its answers and score{emailOn ? ", and is emailed to the advisors you choose" : ""}.{" "}
            Landing pages are kept out of Google.
          </p>
          <button className="btn btn-ember" onClick={startNew}>
            + New Landing Page
          </button>
        </div>
        <Banner />
        {loading ? (
          <p className="muted">Loading…</p>
        ) : pages.length === 0 ? (
          <div className="card" style={{ background: "#fff", textAlign: "center" }}>
            <p className="muted">No landing pages yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pages.map((p) => (
              <div key={p.slug} className="card" style={{ background: "#fff", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ ...tiny, color: p.published ? "#33502f" : "var(--ink-faint)" }}>
                    {p.published ? "● Live" : "○ Draft"}
                    {p.quiz?.enabled ? ` · ${p.quiz.questions.length} questions (max ${p.maxScore} pts)` : " · No questions"}
                    {" · "}
                    {p.offer?.type === "download" ? "PDF download" : p.offer?.type === "schedule" ? "Schedule" : "Thank you"}
                    {p.thanks?.redirectTo ? ` → ${p.thanks.redirectTo}` : ""}
                  </div>
                  <h3 style={{ fontSize: "1.3rem", marginTop: 2 }}>{p.name || p.headline}</h3>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, marginTop: 3 }}>
                    <a href={`/go/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ember)" }}>
                      /go/{p.slug} ↗
                    </a>
                    <span style={{ color: "var(--ink-faint)", marginLeft: 10 }}>
                      · {p.submissions} submission{p.submissions === 1 ? "" : "s"}
                    </span>
                    {p.offer?.type === "download" && !p.offer?.pdf && (
                      <span style={{ color: "#a01268", marginLeft: 10 }}>· using the placeholder thank-you PDF</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-outline" style={rowBtn} onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="btn btn-outline" style={rowBtn} onClick={() => duplicate(p)}>
                    Duplicate
                  </button>
                  <button className="btn btn-outline" style={rowBtn} onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- editor ----
  const d = editing;
  const range = scoreRange(d.quiz);
  const gaps = d.quiz.enabled ? uncoveredScores(d.quiz) : [];
  // Whoever is ticked, and nothing inferred. An empty list used to mean
  // "everyone", so unticking the last advisor quietly emailed all of them.
  const notifyAll = d.notify.notifyAll !== false;
  const selectedIds = notifyAll ? team.map((m) => m.id) : d.notify.memberIds;
  const customRedirect = d.thanks.redirectTo && !redirectOptions.some((o) => o.value === d.thanks.redirectTo);
  const bookingChoices = team.filter((m) => m.bookingUrl);
  const customSchedule = d.offer.scheduleUrl && !bookingChoices.some((m) => m.bookingUrl === d.offer.scheduleUrl);

  return (
    <form onSubmit={save} className="card" style={{ background: "#fff" }}>
      <h2 style={{ fontSize: "1.7rem", marginBottom: 4 }}>{d.originalSlug ? `Editing /go/${d.originalSlug}` : "New landing page"}</h2>
      <button type="button" style={linkBtn} onClick={() => confirmDiscard() && setEditing(null)}>
        ‹ Back to all landing pages
      </button>

      {/* 1. Basics */}
      <Group title="1 · Basics">
        <div className="grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="lp-name-in">Internal name (only you see this)</label>
            <input id="lp-name-in" value={d.name} onChange={(e) => set(["name"], e.target.value)} placeholder="Nike guide — LinkedIn, fall campaign" maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="lp-slug-in">Web address</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <code>/go/</code>
              <input id="lp-slug-in" value={d.slug} onChange={(e) => set(["slug"], normalizeSlug(e.target.value))} placeholder="nike-guide" maxLength={60} />
            </div>
          </div>
        </div>
        <label style={checkRow}>
          <input type="checkbox" checked={d.published} onChange={(e) => set(["published"], e.target.checked)} style={{ width: "auto" }} />
          Published (the link works for anyone). Drafts are visible only to you while signed in.
        </label>
      </Group>

      {/* 2. Page content */}
      <Group title="2 · The offer (left side of the page)">
        <div className="field">
          <label>Small label above the headline</label>
          <input value={d.eyebrow} onChange={(e) => set(["eyebrow"], e.target.value)} placeholder="For Nike Employees" maxLength={120} />
        </div>
        <div className="field">
          <label>Headline *</label>
          <input value={d.headline} onChange={(e) => set(["headline"], e.target.value)} placeholder="The Nike Equity & Retirement Planning Guide" maxLength={200} />
        </div>
        <div className="field">
          <label>Supporting paragraph</label>
          <textarea rows={3} value={d.subhead} onChange={(e) => set(["subhead"], e.target.value)} maxLength={600} />
        </div>
        <div className="field">
          <label>Bullet points (what they&apos;ll get)</label>
          {d.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={b} onChange={(e) => update((x) => (x.bullets[i] = e.target.value))} maxLength={240} />
              <button type="button" style={mini} aria-label="Remove bullet" onClick={() => update((x) => x.bullets.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-outline" style={smallBtn} onClick={() => update((x) => x.bullets.push(""))}>
            + Add bullet
          </button>
        </div>
        <div className="field">
          <label>Image (optional — e.g. the guide&apos;s cover)</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {d.image && <div style={{ width: 120, height: 80, background: `url("${d.image}") center/cover`, border: "1px solid var(--line)" }} />}
            <label className="btn btn-outline" style={smallBtn}>
              {d.image ? "Replace" : "Upload image"}
              <input type="file" accept={IMAGE_ACCEPT} onChange={onImage} style={{ display: "none" }} />
            </label>
            {d.image && (
              <button type="button" className="btn btn-outline" style={smallBtn} onClick={() => set(["image"], "")}>
                Remove
              </button>
            )}
          </div>
        </div>
      </Group>

      {/* 3. Questionnaire */}
      <Group title="3 · Questionnaire (optional)">
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={d.quiz.enabled}
            onChange={(e) =>
              update((x) => {
                x.quiz.enabled = e.target.checked;
                if (e.target.checked && !x.quiz.questions.length) x.quiz.questions.push(newQuestion());
              })
            }
            style={{ width: "auto" }}
          />
          Ask questions before the form (a quiz-style check-in, one question per screen)
        </label>

        {d.quiz.enabled && (
          <>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="field">
                <label>Questionnaire title</label>
                <input value={d.quiz.title} onChange={(e) => set(["quiz", "title"], e.target.value)} placeholder="Retirement Readiness Check" maxLength={160} />
              </div>
              <div className="field">
                <label>Start button text</label>
                <input value={d.quiz.startLabel} onChange={(e) => set(["quiz", "startLabel"], e.target.value)} placeholder="Start" maxLength={60} />
              </div>
            </div>
            <div className="field">
              <label>Intro (shown before the first question)</label>
              <textarea rows={2} value={d.quiz.intro} onChange={(e) => set(["quiz", "intro"], e.target.value)} maxLength={600} />
            </div>
            <label style={checkRow}>
              <input type="checkbox" checked={d.quiz.showPoints} onChange={(e) => set(["quiz", "showPoints"], e.target.checked)} style={{ width: "auto" }} />
              Show each answer&apos;s points to the visitor
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={d.quiz.showScore} onChange={(e) => set(["quiz", "showScore"], e.target.checked)} style={{ width: "auto" }} />
              Show the visitor their total score at the end (e.g. “14 / 24”)
            </label>

            {d.quiz.questions.map((q, qi) => (
              <div key={q.id} style={questionBox}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ ...tiny, color: "var(--brass)" }}>Question {qi + 1}</strong>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button type="button" style={mini} aria-label="Move up" onClick={() => update((x) => qi > 0 && x.quiz.questions.splice(qi - 1, 0, x.quiz.questions.splice(qi, 1)[0]))}>
                      ↑
                    </button>
                    <button
                      type="button"
                      style={mini}
                      aria-label="Move down"
                      onClick={() => update((x) => qi < x.quiz.questions.length - 1 && x.quiz.questions.splice(qi + 1, 0, x.quiz.questions.splice(qi, 1)[0]))}
                    >
                      ↓
                    </button>
                    <button type="button" style={mini} aria-label="Remove question" onClick={() => update((x) => x.quiz.questions.splice(qi, 1))}>
                      ✕
                    </button>
                  </span>
                </div>
                <input
                  value={q.text}
                  onChange={(e) => update((x) => (x.quiz.questions[qi].text = e.target.value))}
                  placeholder="The question"
                  aria-label={`Question ${qi + 1} text`}
                  style={{ ...input, fontSize: 17, marginBottom: 8 }}
                  maxLength={300}
                />
                <input
                  value={q.help}
                  onChange={(e) => update((x) => (x.quiz.questions[qi].help = e.target.value))}
                  placeholder="Optional hint under the question"
                  style={{ ...input, marginBottom: 8 }}
                  maxLength={300}
                />
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontFamily: "var(--font-sans)", fontSize: 14 }}>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      update((x) => {
                        const qq = x.quiz.questions[qi];
                        qq.type = e.target.value;
                        if (qq.type !== "text" && qq.options.length < 2) qq.options = newQuestion().options;
                      })
                    }
                    style={{ ...input, width: "auto" }}
                    aria-label="Question type"
                  >
                    <option value="single">One answer</option>
                    <option value="multi">Select all that apply</option>
                    <option value="text">Short written answer (no points)</option>
                  </select>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={q.required} onChange={(e) => update((x) => (x.quiz.questions[qi].required = e.target.checked))} style={{ width: "auto" }} />
                    Required
                  </label>
                </div>
                {q.type !== "text" && (
                  <>
                    <div style={{ ...tiny, marginBottom: 6 }}>Answers and their points</div>
                    {q.options.map((o, oi) => (
                      <div key={o.id} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <input
                          value={o.label}
                          onChange={(e) => update((x) => (x.quiz.questions[qi].options[oi].label = e.target.value))}
                          placeholder={`Answer ${oi + 1}`}
                          style={input}
                          maxLength={200}
                          aria-label={`Answer ${oi + 1}`}
                        />
                        <input
                          type="number"
                          step="any"
                          value={o.points}
                          onChange={(e) => update((x) => (x.quiz.questions[qi].options[oi].points = e.target.value === "" ? 0 : Number(e.target.value)))}
                          style={{ ...input, width: 76 }}
                          aria-label={`Points for answer ${oi + 1}`}
                          title="Points"
                        />
                        <span style={{ ...tiny, width: 22 }}>pts</span>
                        <button type="button" style={mini} aria-label="Remove answer" onClick={() => update((x) => x.quiz.questions[qi].options.splice(oi, 1))}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={smallBtn}
                      onClick={() => update((x) => x.quiz.questions[qi].options.push({ id: rid(), label: "", points: 0 }))}
                    >
                      + Add answer
                    </button>
                  </>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-outline" style={smallBtn} onClick={() => update((x) => x.quiz.questions.push(newQuestion()))}>
              + Add question
            </button>

            {/* Score ranges */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, marginBottom: 8 }}>
                <strong>Results by score.</strong> Possible scores run from <strong>{range.min}</strong> to{" "}
                <strong>{range.max}</strong>. Each range shows its own message, and can offer a “schedule a conversation”
                button.
              </div>
              {gaps.length > 0 && (
                <div style={notice}>No range covers a score of {gaps.join(", ")}{gaps.length === 6 ? "…" : ""}. Those visitors will see only their score.</div>
              )}
              {d.quiz.results.map((r, ri) => (
                <div key={ri} style={questionBox}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontFamily: "var(--font-sans)", fontSize: 14 }}>
                    Score from
                    <input type="number" step="any" value={r.min} onChange={(e) => update((x) => (x.quiz.results[ri].min = Number(e.target.value)))} style={{ ...input, width: 80 }} aria-label="Minimum score" />
                    to
                    <input type="number" step="any" value={r.max} onChange={(e) => update((x) => (x.quiz.results[ri].max = Number(e.target.value)))} style={{ ...input, width: 80 }} aria-label="Maximum score" />
                    <button type="button" style={{ ...mini, marginLeft: "auto" }} aria-label="Remove range" onClick={() => update((x) => x.quiz.results.splice(ri, 1))}>
                      ✕
                    </button>
                  </div>
                  <input value={r.title} onChange={(e) => update((x) => (x.quiz.results[ri].title = e.target.value))} placeholder="Result title — e.g. Solid foundation" style={{ ...input, marginBottom: 8 }} maxLength={160} />
                  <textarea rows={3} value={r.message} onChange={(e) => update((x) => (x.quiz.results[ri].message = e.target.value))} placeholder="What this score means, and what to do next." style={input} maxLength={2000} />
                  <label style={{ ...checkRow, margin: "8px 0 0" }}>
                    <input type="checkbox" checked={r.showSchedule} onChange={(e) => update((x) => (x.quiz.results[ri].showSchedule = e.target.checked))} style={{ width: "auto" }} />
                    Show a “schedule a conversation” button with this result
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline"
                style={smallBtn}
                onClick={() =>
                  update((x) => {
                    const last = x.quiz.results[x.quiz.results.length - 1];
                    const start = last ? Number(last.max) + 1 : Math.floor(range.min);
                    x.quiz.results.push({ min: start, max: Math.max(start, Math.ceil(range.max)), title: "", message: "", showSchedule: true });
                  })
                }
              >
                + Add score range
              </button>
            </div>
          </>
        )}
      </Group>

      {/* 4. Form */}
      <Group title="4 · Contact form">
        <div className="grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label>Form heading</label>
            <input value={d.form.heading} onChange={(e) => set(["form", "heading"], e.target.value)} placeholder={d.quiz.enabled ? "Where should we send your results?" : "Get the free guide"} maxLength={160} />
          </div>
          <div className="field">
            <label>Button text</label>
            <input value={d.form.submitLabel} onChange={(e) => set(["form", "submitLabel"], e.target.value)} placeholder={d.quiz.enabled ? "See my results" : "Download the guide"} maxLength={60} />
          </div>
        </div>
        <div className="field">
          <label>Text under the heading</label>
          <input value={d.form.sub} onChange={(e) => set(["form", "sub"], e.target.value)} maxLength={400} />
        </div>
        <p style={{ ...tiny, margin: "0 0 10px" }}>Name and email are always asked.</p>
        <div className="grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label>Phone number</label>
            <select value={d.form.phone} onChange={(e) => set(["form", "phone"], e.target.value)}>
              <option value="hidden">Don&apos;t ask</option>
              <option value="optional">Optional</option>
              <option value="required">Required</option>
            </select>
          </div>
          <div className="field">
            <label>Message box</label>
            <select value={d.form.message} onChange={(e) => set(["form", "message"], e.target.value)}>
              <option value="hidden">Don&apos;t show</option>
              <option value="optional">Optional</option>
              <option value="required">Required</option>
            </select>
          </div>
        </div>
        {d.form.message !== "hidden" && (
          <div className="field">
            <label>Message box label</label>
            <input value={d.form.messageLabel} onChange={(e) => set(["form", "messageLabel"], e.target.value)} placeholder="Anything you'd like us to know?" maxLength={120} />
          </div>
        )}
        <div className="field">
          <label>Consent line under the button</label>
          <textarea
            rows={2}
            value={d.form.consent}
            onChange={(e) => set(["form", "consent"], e.target.value)}
            placeholder="By submitting, you agree that Oswego Legacy Partners may contact you about your request. We never sell your information. See our [Privacy Notice](/privacy)."
            maxLength={600}
          />
          <span style={hint}>Leave blank for the standard wording shown. Have compliance approve any change.</span>
        </div>
      </Group>

      {/* 5. Next step */}
      <Group title="5 · After they submit">
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {[
            ["download", "Give them a PDF download", "The file downloads right away; the link can't be used without filling in the form."],
            ["schedule", "Offer to schedule a consultation", "A button to your booking calendar."],
            ["none", "Just say thank you", "No download or booking button (a questionnaire result can still offer one)."],
          ].map(([value, label, desc]) => (
            <label key={value} style={{ ...checkRow, alignItems: "flex-start", margin: 0 }}>
              <input type="radio" name="offer" checked={d.offer.type === value} onChange={() => set(["offer", "type"], value)} style={{ width: "auto", marginTop: 4 }} />
              <span>
                <strong>{label}</strong> — <span className="muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>

        {d.offer.type === "download" && (
          <div style={panel}>
            <label style={{ ...tiny, display: "block", marginBottom: 8 }}>The PDF</label>
            {d.offer.pdf ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14.5 }}>
                  📄 {d.offer.pdfName || "guide.pdf"} {d.offer.pdfSize ? `· ${formatBytes(d.offer.pdfSize)}` : ""}
                </span>
                <label className="btn btn-outline" style={smallBtn}>
                  Replace
                  <input type="file" accept="application/pdf,.pdf" onChange={onPdf} style={{ display: "none" }} />
                </label>
                <button type="button" className="btn btn-outline" style={smallBtn} onClick={() => update((x) => { x.offer.pdf = ""; x.offer.pdfName = ""; })}>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="ph" style={{ padding: "10px 14px", marginBottom: 10 }}>
                  <span className="ph-badge">Placeholder PDF</span>{" "}
                  <span className="ph-note">
                    No PDF uploaded — visitors get a one-page branded “thank you for downloading” PDF. Upload the real guide
                    when it&apos;s approved.
                  </span>
                </div>
                <label className="btn btn-ember" style={smallBtn}>
                  Upload the guide (PDF)
                  <input type="file" accept="application/pdf,.pdf" onChange={onPdf} style={{ display: "none" }} />
                </label>
              </>
            )}
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>Download button text</label>
              <input value={d.offer.downloadLabel} onChange={(e) => set(["offer", "downloadLabel"], e.target.value)} maxLength={60} />
            </div>
          </div>
        )}

        {(d.offer.type === "schedule" || d.quiz.results.some((r) => r.showSchedule)) && (
          <div style={{ ...panel, marginTop: 12 }}>
            <div className="field">
              <label>Scheduling link</label>
              <select
                value={customSchedule ? "__custom" : d.offer.scheduleUrl}
                onChange={(e) => set(["offer", "scheduleUrl"], e.target.value === "__custom" ? "https://" : e.target.value)}
              >
                <option value="">The firm&apos;s Bookings calendar (or the Connect page)</option>
                {bookingChoices.map((m) => (
                  <option key={m.id} value={m.bookingUrl}>
                    {m.name}&apos;s calendar
                  </option>
                ))}
                <option value="__custom">Another link…</option>
              </select>
              {customSchedule && (
                <input value={d.offer.scheduleUrl} onChange={(e) => set(["offer", "scheduleUrl"], e.target.value)} placeholder="https://…" style={{ marginTop: 8 }} />
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Schedule button text</label>
              <input value={d.offer.scheduleLabel} onChange={(e) => set(["offer", "scheduleLabel"], e.target.value)} maxLength={60} />
            </div>
          </div>
        )}
      </Group>

      {/* 6. Thank you + next page */}
      <Group title="6 · Thank-you screen and where they go next">
        <div className="field">
          <label>Thank-you heading</label>
          <input
            value={d.thanks.heading}
            onChange={(e) => set(["thanks", "heading"], e.target.value)}
            placeholder={d.offer.type === "download" ? "Thank you! Your guide is downloading." : "Thank you!"}
            maxLength={160}
          />
        </div>
        <div className="field">
          <label>Thank-you message</label>
          <textarea rows={2} value={d.thanks.message} onChange={(e) => set(["thanks", "message"], e.target.value)} maxLength={1000} />
        </div>
        <div className="field">
          <label>Then send them to</label>
          <select value={customRedirect ? "__custom" : d.thanks.redirectTo} onChange={(e) => set(["thanks", "redirectTo"], e.target.value === "__custom" ? "/" : e.target.value)}>
            {redirectOptions.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="__custom">Another page or link…</option>
          </select>
          {customRedirect && (
            <input value={d.thanks.redirectTo} onChange={(e) => set(["thanks", "redirectTo"], e.target.value)} placeholder="/library/nike-espp  or  https://…" style={{ marginTop: 8 }} />
          )}
        </div>
        {d.thanks.redirectTo && (
          <>
            <div className="field">
              <label>Button text</label>
              <input value={d.thanks.redirectLabel} onChange={(e) => set(["thanks", "redirectLabel"], e.target.value)} placeholder="Continue to our Nike planning page" maxLength={80} />
            </div>
            <label style={checkRow}>
              <input type="checkbox" checked={d.thanks.autoRedirect} onChange={(e) => set(["thanks", "autoRedirect"], e.target.checked)} style={{ width: "auto" }} />
              Go there automatically after
              <input
                type="number"
                min={20}
                max={120}
                value={d.thanks.redirectDelay}
                onChange={(e) => set(["thanks", "redirectDelay"], Number(e.target.value))}
                style={{ ...input, width: 70 }}
                aria-label="Seconds before redirect"
              />
              seconds (visitors can stop it)
            </label>
          </>
        )}
      </Group>

      {/* 7. Notifications */}
      <Group title="7 · Who gets emailed">
        {!emailOn && (
          <div style={notice}>
            Email isn&apos;t switched on for the site yet (no live RESEND_API_KEY on the server), so nobody is emailed —
            but every submission still appears in the Inbox.
          </div>
        )}
        <label style={{ ...checkRow, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={notifyAll}
            onChange={(e) => {
              set(["notify", "notifyAll"], e.target.checked);
              if (e.target.checked) set(["notify", "memberIds"], []);
            }}
            style={{ width: "auto", marginTop: 4 }}
          />
          <span>
            <strong>Everyone on the team</strong>
            <span className="muted"> — including anyone added later.</span>
          </span>
        </label>
        {team.map((m) => (
          <label key={m.id} style={{ ...checkRow, alignItems: "flex-start", opacity: notifyAll ? 0.55 : 1 }}>
            <input
              type="checkbox"
              disabled={notifyAll}
              checked={selectedIds.includes(m.id)}
              onChange={(e) => {
                const ids = new Set(d.notify.memberIds);
                if (e.target.checked) ids.add(m.id);
                else ids.delete(m.id);
                set(["notify", "notifyAll"], false);
                set(["notify", "memberIds"], [...ids]);
              }}
              style={{ width: "auto", marginTop: 4 }}
            />
            <span>
              {m.name}{" "}
              {m.emailOk ? (
                <span className="muted">
                  — {m.email}
                  {m.private ? " (private lead address)" : " (the email shown on the site)"}
                </span>
              ) : (
                <span style={{ color: "#9c3f20" }}>— no email in the Team tab</span>
              )}
            </span>
          </label>
        ))}
        {(() => {
          // Say so when the picked advisors all resolve to one shared inbox —
          // otherwise ticking Jackson vs. Alex looks like it routes somewhere.
          const addrs = team.filter((m) => selectedIds.includes(m.id) && m.emailOk).map((m) => m.email.toLowerCase());
          const shared = addrs.length > 1 && new Set(addrs).size === 1;
          return shared ? (
            <div style={notice}>
              These advisors all use <strong>{addrs[0]}</strong>, so each lead arrives there once. To send an
              advisor their own copy, add a <strong>Lead notification email</strong> for them in the Team tab —
              it&apos;s private and never shown on the site.
            </div>
          ) : null;
        })()}
        {!notifyAll && !d.notify.memberIds.length && (
          <div style={notice}>
            No advisor is ticked, so only the firm inbox will be emailed.
          </div>
        )}
        <label style={{ ...checkRow, alignItems: "flex-start" }}>
          <input type="checkbox" checked={d.notify.firmInbox} onChange={(e) => set(["notify", "firmInbox"], e.target.checked)} style={{ width: "auto", marginTop: 4 }} />
          <span>
            The firm inbox{" "}
            {firmInbox.length ? <span className="muted">— {firmInbox.join(", ")}</span> : <span style={{ color: "#9c3f20" }}>— not set (CONTACT_TO_EMAIL)</span>}
          </span>
        </label>
        <p style={hint}>Each email includes the visitor&apos;s contact details, every answer, their raw score, and the ad campaign they came from.</p>
      </Group>

      {d.slug && <AdLinks slug={normalizeSlug(d.slug)} />}

      <Banner />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="submit" className="btn btn-ember" disabled={saving}>
          {saving ? "Saving…" : "Save landing page"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => confirmDiscard() && setEditing(null)}>
          Cancel
        </button>
        {d.originalSlug && (
          <a href={`/go/${d.originalSlug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ember)", fontSize: 14 }}>
            Preview ↗
          </a>
        )}
      </div>
    </form>
  );
}

// Builds the tracked link to paste into an ad, so every lead in the Inbox
// shows which platform and campaign it came from.
function AdLinks({ slug }) {
  const [source, setSource] = useState("linkedin");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  const medium = { linkedin: "paid_social", facebook: "paid_social", instagram: "paid_social", google: "cpc", email: "email", other: "referral" }[source];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ utm_source: source, utm_medium: medium, ...(campaign ? { utm_campaign: normalizeSlug(campaign) } : {}) });
  const url = `${origin}/go/${slug}?${params}`;
  return (
    <Group title="Link for your ads">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontFamily: "var(--font-sans)", fontSize: 14 }}>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{ ...input, width: "auto" }} aria-label="Ad platform">
          <option value="linkedin">LinkedIn</option>
          <option value="google">Google</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="email">Email</option>
          <option value="other">Other</option>
        </select>
        <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Campaign name (e.g. nike-fall-2026)" style={{ ...input, flex: 1, minWidth: 200 }} aria-label="Campaign name" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <code style={{ flex: 1, fontSize: 13, background: "var(--cream)", padding: "8px 10px", overflowWrap: "anywhere" }}>{url}</code>
        <button
          type="button"
          className="btn btn-outline"
          style={smallBtn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p style={hint}>Use a different campaign name per ad or audience and the Inbox will show which one each lead came from.</p>
    </Group>
  );
}

function Group({ title, children }) {
  return (
    <fieldset style={{ border: "1px solid var(--line)", padding: "18px 18px 8px", margin: "18px 0", background: "#fff" }}>
      <legend style={{ fontFamily: "var(--font-sans)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brass)", fontWeight: 650, padding: "0 8px" }}>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function bannerStyle(type) {
  const p = type === "error" ? ["#e0a58f", "#fbeee8", "#9c3f20"] : ["#a9c3a0", "#eef4ea", "#33502f"];
  return { padding: "10px 14px", margin: "12px 0 18px", border: "1px solid", borderColor: p[0], background: p[1], color: p[2], fontSize: 15 };
}
const tiny = { fontFamily: "var(--font-sans)", fontSize: 12, letterSpacing: "0.06em", color: "var(--ink-faint)" };
const hint = { fontSize: 13, color: "var(--ink-faint)", display: "block", marginTop: 6 };
const smallBtn = { cursor: "pointer", fontSize: 12, padding: "9px 16px" };
const rowBtn = { padding: "8px 16px" };
const input = { width: "100%", fontFamily: "var(--font-body)", fontSize: 16, color: "var(--ink)", background: "#fff", border: "1px solid var(--line)", padding: "9px 11px" };
const mini = { width: 30, height: 30, border: "1px solid var(--line)", background: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 14, lineHeight: 1, color: "var(--ink-soft)", flexShrink: 0 };
const checkRow = { display: "flex", gap: 10, alignItems: "center", margin: "6px 0 12px", fontFamily: "var(--font-sans)", fontSize: 14.5, flexWrap: "wrap" };
const questionBox = { border: "1px solid var(--line)", background: "var(--cream)", padding: 14, margin: "12px 0" };
const panel = { border: "1px solid var(--line)", background: "var(--cream)", padding: 14 };
const linkBtn = { background: "none", border: "none", color: "var(--ember)", cursor: "pointer", fontSize: 13.5, padding: 0, marginBottom: 6, textDecoration: "underline" };
const notice = { padding: "10px 14px", border: "1px solid #dcc58f", background: "#fbf5e6", color: "#5a4719", fontSize: 14, marginBottom: 12 };
