"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function when(iso) {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return ""; }
}

export default function ArticleComments({ slug }) {
  const [comments, setComments] = useState([]);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [error, setError] = useState("");
  const website = useRef(null); // honeypot
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (res.ok) {
        setComments(json.comments || []);
        setViewerIsAdmin(!!json.viewerIsAdmin);
        setAdminName(json.adminName || "");
      }
    } catch { /* ignore */ }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, body, website: website.current?.value || "", elapsedMs: Date.now() - startedAt.current }),
      });
      const json = await res.json();
      if (res.ok && json.comment) {
        setComments((c) => [...c, json.comment]);
        setBody("");
        if (!viewerIsAdmin) setName("");
        setStatus("idle");
      } else if (res.ok) {
        setStatus("idle"); // honeypot skip
      } else {
        setError(json.error || "Couldn't post that.");
        setStatus("error");
      }
    } catch {
      setError("Couldn't reach the server.");
      setStatus("error");
    }
  }

  async function remove(id) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setComments((c) => c.filter((x) => x.id !== id));
  }

  return (
    <section className="comments" id="comments">
      <h2 className="comments-title">Comments{comments.length ? ` (${comments.length})` : ""}</h2>

      <ul className="comment-list">
        {comments.length === 0 && <li className="comment-empty">No comments yet — be the first.</li>}
        {comments.map((c) => (
          <li key={c.id} className="comment">
            <div className="comment-head">
              <span className="comment-name">{c.name || "Anonymous"}</span>
              {c.isAdmin && <span className="comment-verified" title="Verified">✓ verified</span>}
              <span className="comment-date">{when(c.createdAt)}</span>
              {viewerIsAdmin && <button type="button" className="comment-del" onClick={() => remove(c.id)}>delete</button>}
            </div>
            <p className="comment-body">{c.body}</p>
          </li>
        ))}
      </ul>

      <form className="comment-form" onSubmit={submit}>
        {viewerIsAdmin ? (
          <p className="comment-asyou">Posting as <strong>{adminName}</strong> <span className="comment-verified">✓ verified</span></p>
        ) : (
          <input
            className="comment-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            maxLength={40}
            aria-label="Name (optional)"
          />
        )}
        {/* honeypot */}
        <input ref={website} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        <textarea
          className="comment-input comment-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          maxLength={2000}
          required
          aria-label="Comment"
        />
        {error && <p className="comment-error">{error}</p>}
        <button type="submit" className="btn btn-ember" disabled={status === "sending"}>
          {status === "sending" ? "Posting…" : "Post comment"}
        </button>
      </form>
    </section>
  );
}
