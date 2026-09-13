"use client";

import { useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

// Download a snapshot of everything the dashboard can edit, and restore one.
// The download is a single JSON file — keep it anywhere (Drive, Dropbox, a
// folder on your machine) and the site can be rebuilt from it.
export default function BackupManager() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null); // parsed file awaiting confirm
  // Replacing the site text is opt-in every time; a new file starts unticked.
  const [restoreContent, setRestoreContent] = useState(false);
  const [unused, setUnused] = useState(null);

  async function findUnused() {
    setBusy("scan");
    setMsg(null);
    const { ok, json, error } = await adminFetch("/api/admin/media-cleanup");
    setBusy("");
    if (ok) setUnused(json);
    else setMsg({ ok: false, text: error });
  }
  const fileRef = useRef(null);

  function download() {
    setMsg(null);
    // A plain navigation, so the browser's own save dialog handles it and the
    // session cookie rides along.
    window.location.href = "/api/admin/backup?download=1";
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a cancel
    if (!file) return;
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.version) throw new Error("Missing version");
      setPending({ name: file.name, data: parsed });
      setRestoreContent(false);
    } catch {
      setMsg({ ok: false, text: "That file isn't a valid backup." });
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pending.data, restoreContent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Restore failed.");
      const r = json.restored;
      setMsg({
        ok: json.ok,
        text:
          `Restored ${r.team} team members, ${r.articles} articles, ${r.pages} pages, ` +
          `${r.landing || 0} landing pages, ${r.submissions || 0} Inbox submissions, ` +
          `${r.files || 0} uploaded files${r.content ? ", and all site content" : ""}.` +
          (json.errors?.length ? ` Some items failed: ${json.errors.join("; ")}` : ""),
      });
      setPending(null);
      setRestoreContent(false);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  // Each panel says what it does and, just as plainly, what it does not. The
  // three buttons here are the ones where a wrong assumption is expensive: a
  // backup that someone believes covers the code, a sweep someone believes is
  // reversible, a restore someone believes only adds.
  const Does = ({ children }) => (
    <ul style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 14.5, lineHeight: 1.65 }}>{children}</ul>
  );
  const Not = ({ children }) => (
    <>
      <p style={{ margin: "14px 0 0", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>
        What it does not do
      </p>
      <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 14.5, lineHeight: 1.65, color: "var(--ink-soft)" }}>
        {children}
      </ul>
    </>
  );

  const counts = pending?.data?.counts;

  return (
    <div>
      <p className="muted" style={{ fontSize: 16, maxWidth: "70ch" }}>
        A backup is one file containing every word, image, PDF, article, page,
        landing page, and team member on the site, plus the Inbox. Download one
        after any big round of edits and keep it somewhere safe — it includes
        people&apos;s contact details from the Inbox, so treat it as confidential.
        Each panel below says exactly what it does and what it leaves alone.
      </p>

      {/* ---- Download ---- */}
      <div className="card" style={{ background: "#fff", marginTop: 20 }}>
        <h3 style={{ fontSize: "1.4rem" }}>Download a backup</h3>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Saves a dated <code>.json</code> file to your computer. Nothing on the
          site changes.
        </p>
        <Does>
          <li>
            Everything you have written or uploaded: site text, team members,
            every article including drafts, pages, landing pages, web address
            redirects, and the whole Inbox.
          </li>
          <li>
            <strong>The pictures and PDFs themselves</strong>, not just links to
            them — so the file still works even if the originals are gone.
          </li>
        </Does>
        <Not>
          <li>
            It does not contain the website&apos;s code, or its passwords and
            keys. Those are kept separately, and rebuilding from nothing would
            need all three.
          </li>
          <li>
            It does not include files nothing points at any more — see
            &ldquo;Unused files&rdquo; below.
          </li>
          <li>
            It does not protect itself. It is an ordinary file holding real
            people&apos;s names, email addresses and phone numbers, so put it
            somewhere deliberate rather than leaving it in Downloads.
          </li>
        </Not>
        <div style={{ height: 18 }} />
        <button className="btn btn-ember" onClick={download} disabled={busy}>
          Download Backup
        </button>
      </div>

      {/* ---- Unused files ---- */}
      <div className="card" style={{ background: "#fff", marginTop: 18 }}>
        <h3 style={{ fontSize: "1.4rem" }}>Unused files</h3>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Every picture and PDF ever uploaded is kept, including ones from
          imports that were abandoned and thumbnails that have since been
          replaced. Nothing on the site points at these any more, but they are
          still stored — and a document that was taken down is still
          downloadable by anyone who kept its address.
        </p>
        <Does>
          <li>
            Lists the pictures and PDFs nothing on the site refers to, and how
            much room they take.
          </li>
          <li>
            Shows you that list first. Deleting is a second, separate click.
          </li>
          <li>
            Leaves anything uploaded in the last day alone, so an import you are
            part-way through cannot lose its pictures.
          </li>
        </Does>
        <Not>
          <li>
            It does not touch anything still used anywhere on the site, in any
            article, page or landing page.
          </li>
          <li>
            It does not delete articles, pages or Inbox messages. Files only.
          </li>
          <li>
            <strong>It cannot be undone.</strong> A deleted file is gone unless
            it is inside a backup you already downloaded — so take one first.
          </li>
          <li>
            It does not clear the copy Cloudflare is holding. For a genuine
            takedown, the file also has to be purged from the cache and removed
            from Google.
          </li>
        </Not>
        <div style={{ height: 18 }} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={findUnused} disabled={busy}>
            {busy === "scan" ? "Checking…" : "Check for unused files"}
          </button>
          {unused?.count > 0 && (
            <button
              className="btn btn-ember"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    `Permanently delete ${unused.count} unused file(s), freeing ${unused.readable}? This cannot be undone.`
                  )
                ) {
                  return;
                }
                setBusy("delete");
                const { ok, json, error } = await adminFetch("/api/admin/media-cleanup", {
                  method: "DELETE",
                });
                setBusy("");
                setUnused(null);
                setMsg(
                  ok
                    ? { ok: true, text: `Deleted ${json.removed} file(s), freeing ${json.readable}.` }
                    : { ok: false, text: error }
                );
              }}
            >
              Delete them
            </button>
          )}
        </div>
        {unused && (
          <p className="muted" style={{ marginTop: 14, fontSize: 15 }}>
            {unused.count === 0
              ? "Nothing unused — every stored file is still in use."
              : `${unused.count} file(s) nothing points at, taking ${unused.readable}.`}
          </p>
        )}
      </div>

      {/* ---- Restore ---- */}
      <div className="card" style={{ background: "#fff", marginTop: 18 }}>
        <h3 style={{ fontSize: "1.4rem" }}>Restore from a backup</h3>
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Writes the team members, articles, pages, landing pages and Inbox
          messages in the file back onto the site.
        </p>
        <Does>
          <li>
            Puts back the records in the file, and the pictures and PDFs with
            them.
          </li>
          <li>
            Leaves anything created <em>since</em> the backup exactly where it
            is. Restoring an old file does not wipe new work.
          </li>
          <li>
            Only ever <em>adds</em> Inbox messages. An enquiry that arrived after
            the backup was taken cannot be removed by restoring.
          </li>
        </Does>
        <Not>
          <li>
            It does not protect edits. Something <em>changed</em> since the
            backup goes back to the version in the file — so if you are not sure,
            download a fresh backup before restoring an old one.
          </li>
          <li>
            It does not touch your site text unless you tick the box below. That
            is one document covering home, services, FAQ, Privacy and Terms, so
            putting it back replaces every word of it at once. The current
            version is saved aside first either way.
          </li>
          <li>
            It does not restore the website&apos;s code or its settings — a
            backup file holds content, not the site itself.
          </li>
        </Not>
        <div style={{ height: 18 }} />

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          style={{ display: "none" }}
        />
        <button
          className="btn btn-outline"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Choose Backup File
        </button>

        {pending && (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              border: "1px solid var(--line)",
              background: "var(--cream-card)",
            }}
          >
            <strong>{pending.name}</strong>
            <div className="muted" style={{ fontSize: 15, marginTop: 6 }}>
              {pending.data.exportedAt
                ? `Taken ${new Date(pending.data.exportedAt).toLocaleString()}`
                : "Date unknown"}
              {counts &&
                ` — ${counts.team} team members, ${counts.articles} articles, ${counts.pages} pages` +
                  (counts.landing !== undefined ? `, ${counts.landing} landing pages` : "") +
                  (counts.submissions !== undefined ? `, ${counts.submissions} submissions` : "") +
                  (counts.files !== undefined ? `, ${counts.files} files` : "") +
                  (pending.data.content ? ", site text" : "")}
            </div>

            {/* Site text is one document, so putting it back replaces all of
                it at once. Off by default: the usual reason to restore is one
                deleted article, and that should not quietly roll back every
                word of copy — including disclosures — edited since. */}
            {pending.data.content && (
              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginTop: 14,
                  fontSize: 15,
                  lineHeight: 1.5,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={restoreContent}
                  onChange={(e) => setRestoreContent(e.target.checked)}
                  disabled={busy}
                  style={{ marginTop: 4 }}
                />
                <span>
                  Also replace <strong>all site text</strong> — home, services,
                  FAQ, Privacy, Terms and the footer disclosure — with the
                  version in this file. Everything written since this backup
                  was taken is overwritten. A copy of the current text is kept
                  in case this was a mistake.
                </span>
              </label>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                className="btn btn-ember"
                onClick={confirmRestore}
                disabled={busy}
              >
                {busy ? "Restoring…" : "Restore This Backup"}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setPending(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            border: "1px solid",
            borderColor: msg.ok ? "#a9c3a0" : "#e0a58f",
            background: msg.ok ? "#eef4ea" : "#fbeee8",
            color: msg.ok ? "#33502f" : "#9c3f20",
            fontSize: 15,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
