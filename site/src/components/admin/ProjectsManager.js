"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { uploadImage, IMAGE_ACCEPT } from "@/lib/clientImage";
import { useUnsavedChanges } from "@/lib/unsavedChanges";

const input = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--line, #d9d1c2)",
  borderRadius: 8,
  font: "inherit",
  background: "var(--paper, #fff)",
  color: "inherit",
};
const label = { display: "block", fontSize: 13, fontWeight: 600, margin: "14px 0 5px" };
const hint = { display: "block", fontSize: 12, color: "var(--ink-faint, #8a8a7e)", marginTop: 4 };
const btn = {
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--line, #d9d1c2)",
  background: "var(--paper, #fff)",
  color: "inherit",
  borderRadius: 8,
  padding: "8px 14px",
};
const btnPrimary = { ...btn, background: "#172132", color: "#fff", borderColor: "#172132" };

function blank() {
  return {
    slug: "",
    title: "",
    category: "Client Work",
    subsection: "",
    description: "",
    long: [],
    tags: [],
    tools: [],
    image: "",
    gallery: [],
    liveUrl: "",
    liveLabel: "",
    codeUrl: "",
    status: "",
    featured: false,
    order: 0,
    published: true,
  };
}

const slugify = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [originalSlug, setOriginalSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  useUnsavedChanges(editing);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/projects");
    if (res.ok) setProjects(res.json.projects || []);
    else setMsg({ type: "error", text: res.error });
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  const startNew = () => {
    const maxOrder = projects.reduce((m, p) => Math.max(m, p.order ?? 0), 0);
    setEditing({ ...blank(), order: maxOrder + 1 });
    setOriginalSlug("");
    setSlugTouched(false);
    setMsg(null);
  };
  const startEdit = (p) => {
    setEditing({ ...blank(), ...p });
    setOriginalSlug(p.slug);
    setSlugTouched(true);
    setMsg(null);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    const payload = { ...editing, originalSlug };
    const res = await adminFetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      setMsg({ type: "ok", text: "Saved." });
      load();
    } else {
      setMsg({ type: "error", text: res.error });
    }
  };

  const remove = async (slug) => {
    if (!confirm(`Delete project "${slug}"? This can't be undone.`)) return;
    const res = await adminFetch(`/api/admin/projects?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (res.ok) load();
    else setMsg({ type: "error", text: res.error });
  };

  // Uploads
  const onImage = async (file) => {
    if (!file) return;
    setBusy("cover");
    try {
      const { url } = await uploadImage(file, 1600);
      set("image", url);
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy("");
    }
  };
  const onGallery = async (files) => {
    if (!files?.length) return;
    setBusy("gallery");
    try {
      const added = [];
      for (const f of files) {
        const { url } = await uploadImage(f, 1800);
        added.push({ src: url, caption: "" });
      }
      set("gallery", [...(editing.gallery || []), ...added]);
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy("");
    }
  };
  const moveGallery = (i, dir) => {
    const g = [...editing.gallery];
    const j = i + dir;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    set("gallery", g);
  };

  if (loading) return <p>Loading projects…</p>;

  // ---- Editor ----
  if (editing) {
    return (
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{originalSlug ? "Edit project" : "New project"}</h3>
          <button style={btn} onClick={() => setEditing(null)}>← Back</button>
        </div>
        {msg && <p style={{ color: msg.type === "error" ? "#b3402f" : "#2f7d4f" }}>{msg.text}</p>}

        <label style={label}>Title</label>
        <input
          style={input}
          value={editing.title}
          onChange={(e) => {
            set("title", e.target.value);
            if (!slugTouched) set("slug", slugify(e.target.value));
          }}
        />

        <label style={label}>URL slug</label>
        <input
          style={input}
          value={editing.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", slugify(e.target.value));
          }}
        />
        <span style={hint}>/projects/{editing.slug || "…"}</span>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Category</label>
            <input style={input} value={editing.category} onChange={(e) => set("category", e.target.value)} placeholder="Client Work" />
            <span style={hint}>Groups projects. Reuse the same text to group (e.g. Client Work, Apps).</span>
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Subsection (optional)</label>
            <input style={input} value={editing.subsection} onChange={(e) => set("subsection", e.target.value)} placeholder="e.g. Web Apps" />
          </div>
        </div>

        <label style={label}>Short description (card)</label>
        <textarea style={{ ...input, minHeight: 70 }} value={editing.description} onChange={(e) => set("description", e.target.value)} maxLength={600} />

        <label style={label}>Full write-up</label>
        <textarea
          style={{ ...input, minHeight: 140 }}
          value={(editing.long || []).join("\n\n")}
          onChange={(e) => set("long", e.target.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean))}
          placeholder="One paragraph per block. Separate paragraphs with a blank line."
        />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Tags (card chips)</label>
            <input style={input} value={(editing.tags || []).join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Next.js, Stripe, Postgres" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Tools (detail list)</label>
            <input style={input} value={(editing.tools || []).join(", ")} onChange={(e) => set("tools", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Next.js, React, PostgreSQL…" />
          </div>
        </div>

        <label style={label}>Cover image</label>
        {editing.image ? (
          <div style={{ marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={editing.image} alt="" style={{ maxWidth: 220, borderRadius: 8, display: "block", marginBottom: 6 }} />
            <button style={btn} onClick={() => set("image", "")}>Remove</button>
          </div>
        ) : null}
        <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => onImage(e.target.files?.[0])} />
        {busy === "cover" && <span style={hint}>Uploading…</span>}

        <label style={label}>Gallery photos</label>
        <input type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => onGallery([...(e.target.files || [])])} />
        {busy === "gallery" && <span style={hint}>Uploading…</span>}
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {(editing.gallery || []).map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--line,#e4e1d8)", borderRadius: 8, padding: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.src} alt="" style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <input
                  style={input}
                  value={g.caption}
                  placeholder="Caption"
                  onChange={(e) => {
                    const gg = [...editing.gallery];
                    gg[i] = { ...gg[i], caption: e.target.value };
                    set("gallery", gg);
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button style={btn} onClick={() => moveGallery(i, -1)} disabled={i === 0}>↑</button>
                  <button style={btn} onClick={() => moveGallery(i, 1)} disabled={i === editing.gallery.length - 1}>↓</button>
                  <button style={btn} onClick={() => set("gallery", editing.gallery.filter((_, k) => k !== i))}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={label}>Live URL</label>
            <input style={input} value={editing.liveUrl} onChange={(e) => set("liveUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Live link label</label>
            <input style={input} value={editing.liveLabel} onChange={(e) => set("liveLabel", e.target.value)} placeholder="Visit live site ↗" />
          </div>
        </div>
        <label style={label}>Code / GitHub URL (optional)</label>
        <input style={input} value={editing.codeUrl} onChange={(e) => set("codeUrl", e.target.value)} placeholder="https://github.com/…" />

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Status (optional)</label>
            <input style={input} value={editing.status} onChange={(e) => set("status", e.target.value)} placeholder="In progress" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Order</label>
            <input style={input} type="number" value={editing.order} onChange={(e) => set("order", Number(e.target.value))} />
            <span style={hint}>Lower shows first.</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, margin: "16px 0" }}>
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={editing.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured
          </label>
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={editing.published !== false} onChange={(e) => set("published", e.target.checked)} /> Published
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save project"}</button>
          <button style={btn} onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---- List ----
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Projects ({projects.length})</h3>
        <button style={btnPrimary} onClick={startNew}>+ New project</button>
      </div>
      {msg && <p style={{ color: msg.type === "error" ? "#b3402f" : "#2f7d4f" }}>{msg.text}</p>}
      {projects.length === 0 ? (
        <p style={{ color: "var(--ink-faint,#8a8a7e)" }}>No projects yet. Click “New project” to add your first.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {projects.map((p) => (
            <div key={p.slug} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line,#e4e1d8)", borderRadius: 8, padding: "8px 12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image} alt="" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} /> : <div style={{ width: 56, height: 40, background: "var(--line,#eee)", borderRadius: 4, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.title}</strong>{" "}
                <span style={{ color: "var(--ink-faint,#8a8a7e)", fontSize: 13 }}>
                  · {p.category || "—"}{p.subsection ? ` / ${p.subsection}` : ""}{p.featured ? " · ★ featured" : ""}{p.published === false ? " · draft" : ""}
                </span>
              </div>
              <button style={btn} onClick={() => startEdit(p)}>Edit</button>
              <button style={btn} onClick={() => remove(p.slug)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
