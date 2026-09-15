"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function when(iso) {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return ""; }
}

// One comment box — reused for the top-level form and for each inline reply.
// Collects an optional email so the author can be notified when someone
// replies. The email is sent to the server only; it is never shown to anyone.
function CommentForm({ slug, parentId, viewerIsAdmin, adminName, onPosted, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [error, setError] = useState("");
  const website = useRef(null); // honeypot
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, name, email, body, parentId: parentId || "",
          website: website.current?.value || "",
          elapsedMs: Date.now() - startedAt.current,
        }),
      });
      const json = await res.json();
      if (res.ok && json.comment) {
        onPosted(json.comment);
        setBody(""); setEmail(""); if (!viewerIsAdmin) setName("");
        setStatus("idle");
      } else if (res.ok) {
        setStatus("idle"); // honeypot skip — pretend it worked
      } else {
        setError(json.error || "Couldn't post that.");
        setStatus("error");
      }
    } catch {
      setError("Couldn't reach the server.");
      setStatus("error");
    }
  }

  const isReply = !!parentId;
  return (
    <form className={`comment-form${isReply ? " comment-subform" : ""}`} onSubmit={submit}>
      {viewerIsAdmin ? (
        <p className="comment-asyou">Posting as <strong>{adminName}</strong> <span className="comment-verified">✓ verified</span></p>
      ) : (
        <div className="comment-fields">
          <input
            className="comment-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            maxLength={40}
            aria-label="Name (optional)"
          />
          <input
            className="comment-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional — get notified of replies)"
            maxLength={254}
            aria-label="Email (optional, for reply notifications)"
          />
        </div>
      )}
      {/* honeypot */}
      <input ref={website} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      <textarea
        className="comment-input comment-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isReply ? "Write a reply…" : "Add a comment…"}
        rows={isReply ? 2 : 3}
        maxLength={2000}
        required
        aria-label={isReply ? "Reply" : "Comment"}
      />
      {!viewerIsAdmin && <p className="comment-privacy">Your email stays private — used only to tell you if someone replies.</p>}
      {error && <p className="comment-error">{error}</p>}
      <div className="comment-actions">
        <button type="submit" className="btn btn-ember" disabled={status === "sending"}>
          {status === "sending" ? "Posting…" : isReply ? "Post reply" : "Post comment"}
        </button>
        {onCancel && <button type="button" className="comment-cancel" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function ArticleComments({ slug }) {
  const [comments, setComments] = useState([]);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // comment id being replied to

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

  function onPosted(comment) {
    setComments((c) => [...c, comment]);
    setReplyingTo(null);
  }

  async function remove(id) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setComments((c) => c.filter((x) => x.id !== id));
  }

  // Threads are one level deep: top-level comments, each with its replies.
  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce((m, c) => {
    if (c.parentId) (m[c.parentId] ||= []).push(c);
    return m;
  }, {});

  function CommentItem({ c, isReply }) {
    const open = replyingTo === c.id;
    return (
      <div className={`comment${isReply ? " comment-nested" : ""}`}>
        <div className="comment-head">
          <span className="comment-name">{c.name || "Anonymous"}</span>
          {c.isAdmin && <span className="comment-verified" title="Verified">✓ verified</span>}
          <span className="comment-date">{when(c.createdAt)}</span>
          {viewerIsAdmin && <button type="button" className="comment-del" onClick={() => remove(c.id)}>delete</button>}
        </div>
        <p className="comment-body">{c.body}</p>
        <div className="comment-foot">
          <button type="button" className="comment-reply-btn" onClick={() => setReplyingTo(open ? null : c.id)}>
            {open ? "Cancel reply" : "Reply"}
          </button>
        </div>
        {open && (
          // A reply to a reply attaches to the same top-level comment, keeping
          // threads exactly one level deep.
          <CommentForm
            slug={slug}
            parentId={c.parentId || c.id}
            viewerIsAdmin={viewerIsAdmin}
            adminName={adminName}
            onPosted={onPosted}
            onCancel={() => setReplyingTo(null)}
          />
        )}
      </div>
    );
  }

  return (
    <section className="comments" id="comments">
      <h2 className="comments-title">Comments{comments.length ? ` (${comments.length})` : ""}</h2>

      <ul className="comment-list">
        {roots.length === 0 && <li className="comment-empty">No comments yet — be the first.</li>}
        {roots.map((c) => (
          <li key={c.id} className="comment-thread">
            <CommentItem c={c} />
            {(repliesByParent[c.id] || []).length > 0 && (
              <ul className="comment-replies">
                {repliesByParent[c.id].map((r) => (
                  <li key={r.id}><CommentItem c={r} isReply /></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <CommentForm
        slug={slug}
        viewerIsAdmin={viewerIsAdmin}
        adminName={adminName}
        onPosted={onPosted}
      />
    </section>
  );
}
