"use client";

import { useEffect, useState, useCallback } from "react";
import { uploadImage, IMAGE_ACCEPT } from "@/lib/clientImage";
import { adminFetch } from "@/lib/adminFetch";
import { TRACKING_FORMATS, TRACKING_HELP } from "@/lib/tracking";
import { useUnsavedChanges } from "@/lib/unsavedChanges";

// immutable set at a nested path (supports array indices)
function setIn(obj, path, value) {
  const [h, ...rest] = path;
  if (rest.length === 0) {
    if (Array.isArray(obj)) {
      const c = [...obj];
      c[h] = value;
      return c;
    }
    return { ...obj, [h]: value };
  }
  const newChild = setIn(obj?.[h] ?? {}, rest, value);
  if (Array.isArray(obj)) {
    const c = [...obj];
    c[h] = newChild;
    return c;
  }
  return { ...obj, [h]: newChild };
}
const getIn = (obj, path) => path.reduce((o, k) => (o == null ? o : o[k]), obj);

const SECTIONS = [
  { key: "identity", label: "Identity & Contact" },
  { key: "cover", label: "Cover Photo" },
  { key: "seo", label: "Search Listing" },
  { key: "tracking", label: "Ads & Tracking" },
  { key: "home", label: "Home" },
  { key: "about", label: "About" },
  { key: "experience", label: "Experience" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "hobbies", label: "Hobbies" },
  { key: "hire", label: "Hire Page" },
  { key: "contact", label: "Contact" },
  { key: "privacy", label: "Privacy" },
  { key: "terms", label: "Terms" },
  { key: "footer", label: "Footer" },
];

const SEO_PAGES = [
  { key: "about", label: "About", path: "/about" },
  { key: "projects", label: "Projects", path: "/projects" },
  { key: "hobbies", label: "Hobbies", path: "/hobbies" },
  { key: "hire", label: "Hire", path: "/hire" },
  { key: "library", label: "Library", path: "/library" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "privacy", label: "Privacy", path: "/privacy" },
  { key: "terms", label: "Terms", path: "/terms" },
];

function CharCount({ value, max }) {
  const n = String(value || "").length;
  return (
    <span style={{ marginLeft: 8, color: n > max ? "#9c3f20" : "var(--ink-faint)", letterSpacing: 0 }}>
      {n}/{max}
    </span>
  );
}

export default function ContentManager() {
  const [content, setContent] = useState(null);
  const [active, setActive] = useState("identity");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  useUnsavedChanges(content, savedAt);

  const load = useCallback(async () => {
    const { ok, json, error } = await adminFetch("/api/admin/content");
    if (ok) setContent(json.content);
    else setMsg({ type: "error", text: error });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (path, value) => setContent((p) => setIn(p, path, value));
  const addItem = (path, item) => setContent((p) => setIn(p, path, [...(getIn(p, path) || []), item]));
  const removeItem = (path, i) => setContent((p) => setIn(p, path, (getIn(p, path) || []).filter((_, idx) => idx !== i)));
  const moveItem = (path, i, dir) =>
    setContent((p) => {
      const list = getIn(p, path) || [];
      const j = i + dir;
      if (j < 0 || j >= list.length) return p;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return setIn(p, path, next);
    });

  async function uploadTo(path, e, max) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg({ type: "ok", text: "Uploading image…" });
    try {
      const up = await uploadImage(file, max);
      set(path, up.url);
      setMsg({ type: "ok", text: "Image uploaded — press “Save all changes” to put it live." });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Couldn't process that image. Try a JPG, PNG, or HEIC." });
    }
  }

  // Multi-upload into a photo-gallery array of { src, caption }.
  async function uploadGallery(path, e, max) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setMsg({ type: "ok", text: `Uploading ${files.length} photo(s)…` });
    try {
      const added = [];
      for (const f of files) {
        const up = await uploadImage(f, max);
        added.push({ src: up.url, caption: "" });
      }
      set(path, [...(getIn(content, path) || []), ...added]);
      setMsg({ type: "ok", text: "Uploaded — press “Save all changes” to put them live." });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Couldn't process one of those images." });
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const { ok, json, error } = await adminFetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (!ok) {
      setMsg({ type: "error", text: error });
      return;
    }
    setMsg({ type: "ok", text: "Saved. Changes are live on the site." });
    setSavedAt((n) => n + 1);
    setContent(json.content);
  }

  if (!content) return <p className="muted">Loading…</p>;

  const Field = (path, label, { textarea, hint, rows = 3 } = {}) => (
    <div className="field" key={label}>
      <label>{label}</label>
      {textarea ? (
        <textarea rows={rows} value={getIn(content, path) ?? ""} onChange={(e) => set(path, e.target.value)} />
      ) : (
        <input value={getIn(content, path) ?? ""} onChange={(e) => set(path, e.target.value)} />
      )}
      {(() => {
        const key = path[0] === "tracking" ? path[1] : null;
        const re = key && TRACKING_FORMATS[key];
        const value = String(getIn(content, path) ?? "").trim();
        if (re && value && !re.test(value)) {
          return <span style={{ fontSize: 13, color: "var(--ember-deep)", fontWeight: 600 }}>This won&apos;t load. {TRACKING_HELP[key]}</span>;
        }
        if (re && value) return <span style={{ fontSize: 13, color: "#3c6b4a", fontWeight: 600 }}>Tag active.</span>;
        return hint ? <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>{hint}</span> : null;
      })()}
    </div>
  );

  // Generic list editor: renders each item via `render(item, i)`, with add /
  // remove / move controls.
  const List = (path, blank, render, addLabel = "+ Add") => {
    const list = getIn(content, path) || [];
    return (
      <div>
        {list.map((item, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => moveItem(path, i, -1)} disabled={i === 0}>↑</button>
              <button className="btn btn-outline btn-sm" onClick={() => moveItem(path, i, 1)} disabled={i === list.length - 1}>↓</button>
              <button className="btn btn-outline btn-sm" onClick={() => removeItem(path, i)}>Remove</button>
            </div>
            {render(item, i)}
          </div>
        ))}
        <button className="btn btn-outline" onClick={() => addItem(path, typeof blank === "function" ? blank() : JSON.parse(JSON.stringify(blank)))}>{addLabel}</button>
      </div>
    );
  };

  // Bullet-list editor (array of strings) at `path`.
  const Bullets = (path) => {
    const list = getIn(content, path) || [];
    return (
      <div>
        {list.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input style={{ flex: 1 }} value={b} onChange={(e) => set([...path, i], e.target.value)} />
            <button className="btn btn-outline btn-sm" onClick={() => removeItem(path, i)}>✕</button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={() => addItem(path, "")}>+ Add line</button>
      </div>
    );
  };

  // Photo-gallery editor (array of { src, caption }) with multi-upload.
  const Gallery = (path, max = 1800) => {
    const list = getIn(content, path) || [];
    return (
      <div>
        <input type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => uploadGallery(path, e, max)} />
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {list.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.src} alt="" style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <input placeholder="Caption (optional)" value={g.caption || ""} onChange={(e) => set([...path, i, "caption"], e.target.value)} />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => moveItem(path, i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-outline btn-sm" onClick={() => moveItem(path, i, 1)} disabled={i === list.length - 1}>↓</button>
                  <button className="btn btn-outline btn-sm" onClick={() => removeItem(path, i)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p className="muted" style={{ fontSize: 16, marginBottom: 18, maxWidth: "62ch" }}>
        Pick a section, edit the info, then hit <strong>Save all changes</strong>. Design, colors, and layout aren&apos;t editable here — just words, links, and photos.
      </p>
      <p className="muted" style={{ fontSize: 14, marginBottom: 20, maxWidth: "62ch", color: "var(--ink-faint)" }}>
        Formatting works in text fields: <code>**bold**</code>, <code>*italic*</code>. Press Enter for line breaks.
      </p>

      {/* Section switcher */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        {SECTIONS.map((s) => {
          const on = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              style={{
                padding: "9px 18px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13,
                border: "1px solid", borderColor: on ? "var(--forest-2)" : "var(--line)",
                background: on ? "var(--forest-2)" : "#fff", color: on ? "#f4efe2" : "var(--ink-soft)",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <p style={{ padding: "10px 14px", marginBottom: 18, border: "1px solid", borderColor: msg.type === "error" ? "#e0a58f" : "#a9c3a0", background: msg.type === "error" ? "#fbeee8" : "#eef4ea", color: msg.type === "error" ? "#9c3f20" : "#33502f", fontSize: 15 }}>
          {msg.text}
        </p>
      )}

      <div className="card" style={{ background: "#fff", marginBottom: 20, minHeight: 120 }}>
        {active === "identity" && (
          <>
            {Field(["siteName"], "Your name")}
            {Field(["role"], "Role / title", { hint: "e.g. Software Engineer" })}
            {Field(["tagline"], "One-line tagline", { textarea: true, rows: 2 })}
            {Field(["email"], "Email")}
            {Field(["phone"], "Phone")}
            {Field(["location"], "Location", { hint: "e.g. Camas, WA" })}
            {Field(["githubUrl"], "GitHub URL")}
            {Field(["linkedinUrl"], "LinkedIn URL")}
            {Field(["resumeUrl"], "Résumé link", { hint: "A link to your résumé PDF (optional)." })}
          </>
        )}

        {active === "cover" && (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>Your main cover / hero photo. Appears behind the hero on the homepage.</p>
            {content.heroImage ? (
              <div style={{ marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={content.heroImage} alt="" style={{ maxWidth: 360, borderRadius: 8, display: "block", marginBottom: 8 }} />
                <button className="btn btn-outline btn-sm" onClick={() => set(["heroImage"], "")}>Remove cover photo</button>
              </div>
            ) : (
              <p className="muted" style={{ marginBottom: 12 }}>No cover photo set.</p>
            )}
            <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => uploadTo(["heroImage"], e, 2200)} />
          </>
        )}

        {active === "seo" && (
          <>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 16, maxWidth: "62ch" }}>
              The headline and blurb Google shows. Descriptions over ~155 characters get cut off.
            </p>
            <div className="field">
              <label>Home — search headline <CharCount value={content.seo?.title} max={65} /></label>
              <input value={content.seo?.title ?? ""} onChange={(e) => set(["seo", "title"], e.target.value)} />
            </div>
            <div className="field">
              <label>Home — description <CharCount value={content.seo?.description} max={158} /></label>
              <textarea rows={2} value={content.seo?.description ?? ""} onChange={(e) => set(["seo", "description"], e.target.value)} />
            </div>
            {SEO_PAGES.map((pg) => (
              <div key={pg.key} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
                <strong style={{ fontSize: 14 }}>{pg.label} <span className="muted" style={{ fontWeight: 400 }}>({pg.path})</span></strong>
                {Field(["seo", "pages", pg.key, "title"], "Title")}
                {Field(["seo", "pages", pg.key, "description"], "Description", { textarea: true, rows: 2 })}
              </div>
            ))}
          </>
        )}

        {active === "tracking" && (
          <>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>Each tag loads only when its ID is filled in. Leave blank to disable.</p>
            {Field(["tracking", "ga4Id"], "Google Analytics 4 (G-…)")}
            {Field(["tracking", "googleAdsId"], "Google Ads (AW-…)")}
            {Field(["tracking", "googleAdsLeadLabel"], "Google Ads lead label")}
            {Field(["tracking", "linkedinPartnerId"], "LinkedIn Partner ID")}
            {Field(["tracking", "metaPixelId"], "Meta Pixel ID")}
          </>
        )}

        {active === "home" && (
          <>
            {Field(["home", "heroTitle"], "Hero heading")}
            {Field(["home", "heroRole"], "Hero subhead (role)")}
            {Field(["home", "heroBody"], "Hero paragraph", { textarea: true })}
            {Field(["home", "featuredTitle"], "Featured section heading")}
            {Field(["home", "aboutTitle"], "About section heading")}
            {Field(["home", "aboutBody"], "About paragraph 1", { textarea: true })}
            {Field(["home", "aboutBody2"], "About paragraph 2", { textarea: true })}
            {Field(["home", "experienceTitle"], "Experience section heading")}
            {Field(["home", "contactTitle"], "Contact CTA heading")}
            {Field(["home", "contactBody"], "Contact CTA text", { textarea: true, rows: 2 })}
          </>
        )}

        {active === "about" && (
          <>
            {Field(["about", "heroTitle"], "Page heading")}
            <div className="field"><label>Body paragraphs</label>{Bullets(["about", "body"])}</div>
            {Field(["about", "skillsTitle"], "Skills section heading")}
            {Field(["about", "educationTitle"], "Education section heading")}
          </>
        )}

        {active === "experience" && (
          <div className="field">
            <label>Roles</label>
            {List(["experience"], { company: "", title: "", dates: "", bullets: [] }, (job, i) => (
              <>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="field"><label>Title</label><input value={job.title || ""} onChange={(e) => set(["experience", i, "title"], e.target.value)} /></div>
                  <div className="field"><label>Company</label><input value={job.company || ""} onChange={(e) => set(["experience", i, "company"], e.target.value)} /></div>
                </div>
                <div className="field"><label>Dates</label><input value={job.dates || ""} onChange={(e) => set(["experience", i, "dates"], e.target.value)} /></div>
                <div className="field"><label>Bullet points</label>{Bullets(["experience", i, "bullets"])}</div>
              </>
            ), "+ Add role")}
          </div>
        )}

        {active === "skills" && (
          <div className="field">
            <label>Skill groups</label>
            {List(["skills"], { group: "", items: "" }, (s, i) => (
              <>
                <div className="field"><label>Group</label><input value={s.group || ""} onChange={(e) => set(["skills", i, "group"], e.target.value)} /></div>
                <div className="field"><label>Items (comma-separated)</label><input value={s.items || ""} onChange={(e) => set(["skills", i, "items"], e.target.value)} /></div>
              </>
            ), "+ Add group")}
          </div>
        )}

        {active === "education" && (
          <>
            {Field(["education", "school"], "School")}
            {Field(["education", "degree"], "Degree")}
            {Field(["education", "details"], "Details", { textarea: true, rows: 2 })}
            {Field(["education", "year"], "Year")}
          </>
        )}

        {active === "hobbies" && (
          <>
            {Field(["hobbies", "heroTitle"], "Page heading")}
            {Field(["hobbies", "heroSub"], "Page subhead")}
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hobbies", "legoTitle"], "LEGO heading")}
            {Field(["hobbies", "legoBody"], "LEGO description", { textarea: true })}
            <div className="field"><label>LEGO photos (upload, caption, reorder)</label>{Gallery(["hobbies", "legoPhotos"])}</div>
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hobbies", "liftingTitle"], "Lifting heading")}
            {Field(["hobbies", "liftingBody"], "Lifting description", { textarea: true })}
            {Field(["hobbies", "liftingVideoUrl"], "Lifting video URL")}
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hobbies", "chessTitle"], "Chess heading")}
            {Field(["hobbies", "chessBody"], "Chess description", { textarea: true })}
            {Field(["hobbies", "chessUrl"], "Chess profile URL")}
          </>
        )}

        {active === "hire" && (
          <>
            {Field(["hire", "eyebrow"], "Small label above heading")}
            {Field(["hire", "heroTitle"], "Hero heading")}
            {Field(["hire", "heroBody"], "Hero paragraph", { textarea: true })}
            {Field(["hire", "heroNote"], "Hero note (small line)")}
            {Field(["hire", "bookingUrl"], "Booking link (Calendly, etc.)", { hint: "Where every “Book a call” button goes. Blank → your Contact page." })}
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hire", "pillarsTitle"], "Pillars heading")}
            <div className="field"><label>Pillars</label>
              {List(["hire", "pillars"], { title: "", body: "" }, (p, i) => (
                <>
                  <div className="field"><label>Title</label><input value={p.title || ""} onChange={(e) => set(["hire", "pillars", i, "title"], e.target.value)} /></div>
                  <div className="field"><label>Body</label><textarea rows={2} value={p.body || ""} onChange={(e) => set(["hire", "pillars", i, "body"], e.target.value)} /></div>
                </>
              ), "+ Add pillar")}
            </div>
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hire", "pricingTitle"], "Pricing heading")}
            {Field(["hire", "pricingSub"], "Pricing subhead", { textarea: true, rows: 2 })}
            <div className="field"><label>Packages</label>
              {List(["hire", "packages"], { name: "", price: "", for: "", features: [], featured: false }, (pk, i) => (
                <>
                  <div className="grid-2" style={{ gap: 10 }}>
                    <div className="field"><label>Name</label><input value={pk.name || ""} onChange={(e) => set(["hire", "packages", i, "name"], e.target.value)} /></div>
                    <div className="field"><label>Price</label><input value={pk.price || ""} onChange={(e) => set(["hire", "packages", i, "price"], e.target.value)} /></div>
                  </div>
                  <div className="field"><label>Who it's for</label><input value={pk.for || ""} onChange={(e) => set(["hire", "packages", i, "for"], e.target.value)} /></div>
                  <div className="field"><label>Features</label>{Bullets(["hire", "packages", i, "features"])}</div>
                  <label style={{ fontSize: 14 }}><input type="checkbox" checked={!!pk.featured} onChange={(e) => set(["hire", "packages", i, "featured"], e.target.checked)} /> Most popular</label>
                </>
              ), "+ Add package")}
            </div>
            {Field(["hire", "carePlan"], "Care plan heading")}
            {Field(["hire", "carePlanBody"], "Care plan text", { textarea: true, rows: 2 })}
            {Field(["hire", "priceNote"], "Price note (small italic)", { textarea: true, rows: 2 })}
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hire", "processTitle"], "Process heading")}
            <div className="field"><label>Process steps</label>
              {List(["hire", "process"], { n: "", title: "", body: "" }, (s, i) => (
                <>
                  <div className="grid-2" style={{ gap: 10 }}>
                    <div className="field"><label>Number</label><input value={s.n || ""} onChange={(e) => set(["hire", "process", i, "n"], e.target.value)} /></div>
                    <div className="field"><label>Title</label><input value={s.title || ""} onChange={(e) => set(["hire", "process", i, "title"], e.target.value)} /></div>
                  </div>
                  <div className="field"><label>Body</label><textarea rows={2} value={s.body || ""} onChange={(e) => set(["hire", "process", i, "body"], e.target.value)} /></div>
                </>
              ), "+ Add step")}
            </div>
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hire", "faqTitle"], "FAQ heading")}
            <div className="field"><label>FAQ</label>
              {List(["hire", "faq"], { q: "", a: "" }, (f, i) => (
                <>
                  <div className="field"><label>Question</label><input value={f.q || ""} onChange={(e) => set(["hire", "faq", i, "q"], e.target.value)} /></div>
                  <div className="field"><label>Answer</label><textarea rows={2} value={f.a || ""} onChange={(e) => set(["hire", "faq", i, "a"], e.target.value)} /></div>
                </>
              ), "+ Add question")}
            </div>
            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--line)" }} />
            {Field(["hire", "ctaTitle"], "Closing CTA heading")}
            {Field(["hire", "ctaBody"], "Closing CTA text", { textarea: true, rows: 2 })}
          </>
        )}

        {active === "contact" && (
          <>
            {Field(["contact", "heroTitle"], "Page heading")}
            {Field(["contact", "heroSub"], "Page subhead", { textarea: true, rows: 2 })}
            {Field(["contact", "noteHeading"], "Form heading")}
            {Field(["contact", "noteBody"], "Form intro text", { textarea: true, rows: 2 })}
          </>
        )}

        {active === "privacy" && (
          <>
            {Field(["privacy", "heroTitle"], "Heading")}
            {Field(["privacy", "heroSub"], "Subhead", { textarea: true, rows: 2 })}
            {Field(["privacy", "body"], "Body (Markdown-ish)", { textarea: true, rows: 16 })}
          </>
        )}

        {active === "terms" && (
          <>
            {Field(["terms", "heroTitle"], "Heading")}
            {Field(["terms", "heroSub"], "Subhead", { textarea: true, rows: 2 })}
            {Field(["terms", "body"], "Body (Markdown-ish)", { textarea: true, rows: 16 })}
          </>
        )}

        {active === "footer" && <>{Field(["footer", "tagline"], "Footer tagline", { textarea: true, rows: 2 })}</>}
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "var(--paper, #fbf9f3)", padding: "14px 0", borderTop: "1px solid var(--line)" }}>
        <button className="btn btn-ember" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save all changes"}</button>
      </div>
    </div>
  );
}
