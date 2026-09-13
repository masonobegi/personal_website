"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

// Every form submission on the site in one place: the contact form,
// consultation requests, and ad landing pages (with answers and scores).
// Saved even when email isn't set up, so nothing is lost.

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

function sourceLabel(s) {
  if (s.kind === "lead") return s.landing?.name || s.landing?.headline || "Landing page";
  const src = String(s.source || "").replace(/^contact:/, "");
  if (src === "intake") return "Connect page";
  if (src === "home") return "Home page";
  if (src.startsWith("segment:")) return `${src.slice(8)} page`;
  return src || "Website";
}

const EMAIL_STATUS = {
  sent: "Emailed",
  "not-configured": "Not emailed — email isn't set up on the server",
  "no-recipients": "Not emailed — no real recipient addresses",
  failed: "Email failed to send",
};

export default function InboxManager({ onCount }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // active | new | leads | contact | archived | all
  const [landing, setLanding] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json, error } = await adminFetch("/api/admin/submissions");
    // Leave what is on screen alone if the request failed. Replacing it with
    // an empty list told the admin there were no submissions.
    if (ok) {
      setSubs(json.submissions || []);
      setErr(null);
    } else {
      setErr(error);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onCount?.(subs.filter((s) => s.status === "new").length);
  }, [subs, onCount]);

  const landings = useMemo(() => {
    const m = new Map();
    for (const s of subs) if (s.landing?.slug) m.set(s.landing.slug, s.landing.name || s.landing.headline || s.landing.slug);
    return [...m.entries()];
  }, [subs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter === "active" && s.status === "archived") return false;
      if (filter === "new" && s.status !== "new") return false;
      if (filter === "archived" && s.status !== "archived") return false;
      if (filter === "leads" && s.kind !== "lead") return false;
      if (filter === "contact" && s.kind !== "contact") return false;
      if (landing && s.landing?.slug !== landing) return false;
      if (q && ![s.name, s.email, s.phone, s.message, sourceLabel(s)].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subs, filter, landing, query]);

  async function setStatus(s, status) {
    const previous = s.status;
    setSubs((list) => list.map((x) => (x.id === s.id ? { ...x, status } : x)));
    const { ok, error } = await adminFetch("/api/admin/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, status }),
    });
    if (!ok) {
      // Put it back: the screen was showing a change the database never made.
      setSubs((list) => list.map((x) => (x.id === s.id ? { ...x, status: previous } : x)));
      setErr(error);
    }
  }

  function toggle(s) {
    const opening = open !== s.id;
    setOpen(opening ? s.id : null);
    if (opening && s.status === "new") setStatus(s, "read");
  }

  async function remove(s) {
    if (!confirm(`Delete the submission from ${s.name}? This can't be undone.`)) return;
    const { ok, error } = await adminFetch(
      `/api/admin/submissions?id=${encodeURIComponent(s.id)}`,
      { method: "DELETE" }
    );
    // Only take it off the screen once it is really gone, or a prospect's
    // record looks deleted while it is still in the database.
    if (ok) setSubs((list) => list.filter((x) => x.id !== s.id));
    else setErr(error);
  }

  const unread = subs.filter((s) => s.status === "new").length;

  return (
    <div>
      {err && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            border: "1px solid var(--ember)",
            background: "#fdf3ee",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
          }}
        >
          {err}
        </div>
      )}
      <p className="muted" style={{ fontSize: 16, marginBottom: 16, maxWidth: "66ch" }}>
        Every form submission — the contact form, consultation requests, and landing pages (with answers
        and scores).{" "}
        {/* Said only when it is true. Each record already shows its own
            delivery status below; claiming here that everything is emailed was
            wrong whenever the mail key was unset. */}
        Anything that was emailed says so against it.{" "}
        {unread ? <strong>{unread} new.</strong> : "All caught up."}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={control} aria-label="Show">
          <option value="active">Inbox (not archived)</option>
          <option value="new">New only</option>
          <option value="leads">Landing-page leads</option>
          <option value="contact">Contact form</option>
          <option value="archived">Archived</option>
          <option value="all">Everything</option>
        </select>
        {landings.length > 0 && (
          <select value={landing} onChange={(e) => setLanding(e.target.value)} style={control} aria-label="Landing page">
            <option value="">All landing pages</option>
            {landings.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, message…"
          style={{ ...control, flex: 1, minWidth: 180 }}
          aria-label="Search submissions"
        />
        <a href="/api/admin/submissions?format=csv" className="btn btn-outline" style={{ padding: "9px 16px", fontSize: 12 }}>
          Export CSV
        </a>
        <button type="button" className="btn btn-outline" style={{ padding: "9px 16px", fontSize: 12 }} onClick={load}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card" style={{ background: "#fff", textAlign: "center" }}>
          <p className="muted">{subs.length ? "Nothing matches these filters." : "No submissions yet. They'll appear here as soon as someone fills in a form."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((s) => {
            const isOpen = open === s.id;
            return (
              <div key={s.id} style={{ border: "1px solid var(--line)", background: "#fff" }}>
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  aria-expanded={isOpen}
                  style={{
                    display: "flex",
                    width: "100%",
                    gap: 14,
                    alignItems: "center",
                    padding: "14px 16px",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    aria-label={s.status === "new" ? "New" : ""}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: s.status === "new" ? "var(--ember)" : "transparent",
                      border: s.status === "new" ? "none" : "1px solid var(--line)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 180 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: s.status === "new" ? 600 : 500 }}>
                      {s.name}
                    </span>
                    <span className="muted" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, marginLeft: 10 }}>
                      {s.email}
                    </span>
                    <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>
                      {sourceLabel(s)}
                      {s.attribution?.utm_source ? ` · via ${s.attribution.utm_source}${s.attribution.utm_campaign ? ` (${s.attribution.utm_campaign})` : ""}` : ""}
                      {s.status === "archived" ? " · archived" : ""}
                    </span>
                  </span>
                  {/* The spam filter files these away rather than deleting
                      them, so a real enquiry it got wrong is still here. */}
                  {s.suspectedSpam && (
                    <span
                      style={{ ...badge, background: "#f3e2d8", color: "var(--ember-deep)" }}
                      title={
                        s.suspectedSpam === "honeypot"
                          ? "Filled in a field only a script can see."
                          : "Submitted faster than someone could type it — an autofilled form can do this too."
                      }
                    >
                      Suspected spam
                    </span>
                  )}
                  {s.quiz?.max > 0 && (
                    <span style={badge} title={s.quiz.band?.title || "Score"}>
                      {s.quiz.score}/{s.quiz.max}
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                    {when(s.createdAt)}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--line-soft)", padding: "16px 18px 18px", fontSize: 16 }}>
                    <dl className="inbox-dl" style={dl}>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${s.email}`} style={{ color: "var(--ember)" }}>
                          {s.email}
                        </a>
                      </dd>
                      {s.phone && (
                        <>
                          <dt>Phone</dt>
                          <dd>
                            <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} style={{ color: "var(--ember)" }}>
                              {s.phone}
                            </a>
                          </dd>
                        </>
                      )}
                      {s.message && (
                        <>
                          <dt>Message</dt>
                          <dd style={{ whiteSpace: "pre-wrap" }}>{s.message}</dd>
                        </>
                      )}
                      {s.quiz && (
                        <>
                          <dt>Score</dt>
                          <dd>
                            <strong>
                              {s.quiz.score} / {s.quiz.max}
                            </strong>
                            {s.quiz.band?.title ? ` — ${s.quiz.band.title}` : ""}
                          </dd>
                        </>
                      )}
                      {s.offer && s.offer !== "none" && (
                        <>
                          <dt>Next step</dt>
                          <dd>{s.offer === "download" ? "Downloaded the PDF" : "Offered the scheduling link"}</dd>
                        </>
                      )}
                      {s.attribution && Object.keys(s.attribution).length > 0 && (
                        <>
                          <dt>Came from</dt>
                          <dd style={{ fontSize: 14.5 }}>
                            {Object.entries(s.attribution)
                              .map(([k, v]) => `${k.replace(/^utm_/, "")}: ${v}`)
                              .join(" · ")}
                          </dd>
                        </>
                      )}
                      <dt>Notification</dt>
                      <dd style={{ fontSize: 14.5 }}>
                        {EMAIL_STATUS[s.emailStatus] || "—"}
                        {s.emailStatus === "sent" && s.notified?.length ? ` to ${s.notified.join(", ")}` : ""}
                      </dd>
                    </dl>

                    {s.quiz?.answers?.length > 0 && (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 15 }}>
                        <caption style={{ textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)", paddingBottom: 6 }}>
                          Answers
                        </caption>
                        <tbody>
                          {s.quiz.answers.map((a, i) => (
                            <tr key={i}>
                              <td style={cellStyle}>{a.question}</td>
                              <td style={{ ...cellStyle, fontWeight: 600 }}>{a.answer || "—"}</td>
                              <td style={{ ...cellStyle, textAlign: "right", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                                {a.points === null ? "" : `${a.points} pts`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                      <a href={`mailto:${s.email}?subject=${encodeURIComponent("Following up — Oswego Legacy Partners")}`} className="btn btn-ember" style={actBtn}>
                        Reply by email
                      </a>
                      {s.status !== "new" && (
                        <button type="button" className="btn btn-outline" style={actBtn} onClick={() => setStatus(s, "new")}>
                          Mark unread
                        </button>
                      )}
                      {s.status !== "archived" ? (
                        <button type="button" className="btn btn-outline" style={actBtn} onClick={() => setStatus(s, "archived")}>
                          Archive
                        </button>
                      ) : (
                        <button type="button" className="btn btn-outline" style={actBtn} onClick={() => setStatus(s, "read")}>
                          Move back to Inbox
                        </button>
                      )}
                      <button type="button" className="btn btn-outline" style={actBtn} onClick={() => remove(s)}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const control = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  padding: "9px 10px",
  border: "1px solid var(--line)",
  background: "#fff",
  color: "var(--ink)",
};
const badge = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  background: "var(--cream-deep)",
  color: "var(--ink)",
};
const dl = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 18px",
  margin: 0,
};
const cellStyle = { borderTop: "1px solid var(--line-soft)", padding: "7px 10px 7px 0", verticalAlign: "top" };
const actBtn = { padding: "8px 16px", fontSize: 12 };
