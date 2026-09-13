"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import ArticleCover from "@/components/ArticleCover";
import { formatText as fmt } from "@/lib/formatText";

// Type filters, in display order. "written" and "linked" both read as
// articles to a visitor, so they share one filter.
const TYPES = [
  { key: "article", label: "Articles", kinds: ["written", "linked"] },
  { key: "pdf", label: "White Papers", kinds: ["pdf"] },
  { key: "video", label: "Videos", kinds: ["video"] },
];

// Searchable Library browser. Matches the typed keywords against each article's
// title, author, tags, excerpt, and body text. Tag chips act as one-click
// "pre-done searches"; type pills narrow to articles, white papers, or videos.
export default function LibraryBrowser({ items, allTags, kinds = [], initialTag = "", initialType = "" }) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(initialTag);
  const [type, setType] = useState(TYPES.some((t) => t.key === initialType) ? initialType : "");
  const [sort, setSort] = useState("newest");

  const types = TYPES.filter((t) => t.kinds.some((k) => kinds.includes(k)));

  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const typeKinds = TYPES.find((t) => t.key === type)?.kinds;
    const filtered = items.filter((a) => {
      if (typeKinds && !typeKinds.includes(a.kind)) return false;
      if (activeTag && !a.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) {
        return false;
      }
      return tokens.every((tok) => a.search.includes(tok));
    });
    const sorted = [...filtered].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt))
    );
    return sort === "newest" ? sorted.reverse() : sorted;
  }, [items, query, activeTag, type, sort]);

  const filtering = Boolean(query.trim() || activeTag || type);
  const searchRef = useRef(null);

  // What the live region reads out. Kept as one plain sentence so a screen
  // reader announces the count and nothing else — the toolbar it used to live
  // inside meant "Sort, Newest first, combo box" was read on every keystroke.
  const summary = results.length
    ? `${results.length} ${results.length === 1 ? "item" : "items"}${
        filtering ? " match your filters" : ""
      }`
    : filtering
      ? "Nothing matches that search."
      : "No articles have been published yet.";

  const pill = (on) => ({
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    padding: "6px 15px",
    borderRadius: 999,
    cursor: "pointer",
    border: "1px solid",
    borderColor: on ? "var(--forest-2)" : "var(--line)",
    background: on ? "var(--forest-2)" : "#fff",
    color: on ? "#f4efe2" : "var(--ink-soft)",
    transition: "all 0.15s ease",
  });

  return (
    <div>
      {/* Search bar */}
      <div style={{ maxWidth: 620, marginInline: "auto", marginBottom: 22 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          ref={searchRef}
          placeholder="Search articles — e.g. Roth, retirement, taxes…"
          aria-label="Search articles"
          style={{
            width: "100%",
            fontFamily: "var(--font-body)",
            fontSize: 17,
            color: "var(--ink)",
            background: "#fff",
            border: "1px solid var(--line-control)",
            padding: "14px 18px",
          }}
        />
      </div>

      {/* Type pills — only when there's more than one type to choose from */}
      {types.length > 1 && (
        <div role="group" aria-label="Filter by type" style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center", marginBottom: 14 }}>
          <button type="button" aria-pressed={!type} onClick={() => setType("")} style={pill(!type)}>
            All
          </button>
          {types.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              onClick={() => setType(type === t.key ? "" : t.key)}
              style={pill(type === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tag chips — quick, pre-done searches */}
      {allTags.length > 0 && (
        <div role="group" aria-label="Filter by topic" style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center", marginBottom: 34 }}>
          {allTags.map((t) => {
            const on = activeTag.toLowerCase() === t.toLowerCase();
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveTag(on ? "" : t)}
                style={{ ...pill(on), background: on ? "var(--forest-2)" : "transparent" }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {/* One live region that is always present, holding only the sentence to
          be read out. It used to be the toolbar itself, which only existed
          when there were results — so a search matching nothing produced the
          region and its text in the same change and was never announced. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {summary}
      </div>

      {/* Result summary + sort control */}
      {results.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 26,
            fontFamily: "var(--font-sans)",
            fontSize: 14.5,
            color: "var(--ink-soft)",
          }}
        >
          <span>
            {results.length} {results.length === 1 ? "item" : "items"}
            {type && (
              <>
                {" "}in <strong style={{ color: "var(--ink)" }}>{TYPES.find((t) => t.key === type)?.label}</strong>
              </>
            )}
            {activeTag && (
              <>
                {" "}tagged <strong style={{ color: "var(--ink)" }}>{activeTag}</strong>
              </>
            )}
            {query.trim() && (
              <>
                {" "}matching <strong style={{ color: "var(--ink)" }}>{query.trim()}</strong>
              </>
            )}
            {filtering && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveTag("");
                    setType("");
                    // This button removes itself the moment the filters clear,
                    // which would drop focus onto the page body. Send it
                    // somewhere deliberate instead.
                    searchRef.current?.focus();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--ember)",
                    fontWeight: 600,
                    fontSize: 14.5,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </span>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--ink-faint)" }}>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 15,
                color: "var(--ink)",
                background: "#fff",
                border: "1px solid var(--line-control)",
                // The browser's own dropdown arrow was the only rounded,
                // system-styled thing among the page's square controls. The box
                // still matches the search field above it; only the arrow is
                // replaced.
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2355554c' stroke-width='1.5'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "10px",
                padding: "7px 28px 7px 10px",
                cursor: "pointer",
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      )}

      {results.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", maxWidth: "46ch", marginInline: "auto" }}>
          {filtering
            ? "Nothing matches that search. Try a different word or clear the filters."
            : "No articles have been published yet. Check back soon."}
        </p>
      ) : (
        <div className="grid-3" style={{ gap: 34 }}>
          {results.map((a, idx) => {
            const cardProps = a.external
              ? { href: a.href, target: "_blank", rel: "noopener noreferrer" }
              : { href: a.href };
            const Card = a.external ? "a" : Link;
            return (
              <Card
                key={a.slug}
                {...cardProps}
                className="card"
                style={{
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                <ArticleCover
                  thumbnail={a.thumbnail}
                  alt=""
                  height={200}
                  video={a.kind === "video"}
                  priority={idx < 3}
                />
                <div
                  style={{
                    padding: "22px 24px 26px",
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                  }}
                >
                  <div className="card-meta">
                    {[a.kindLabel, a.date, a.author].filter(Boolean).join(" · ")}
                  </div>
                  {/* h2, not h3: this page's only other heading is the h1,
                      and skipping a level reads as a missing section. The
                      inline size keeps it looking exactly the same. */}
                  <h2 style={{ fontSize: "1.45rem", lineHeight: 1.2 }}>{fmt(a.title)}</h2>
                  {a.excerpt && (
                    <p className="muted card-excerpt" style={{ marginTop: 10, fontSize: 16 }}>
                      {fmt(a.excerpt)}
                    </p>
                  )}
                  <span className="card-cta">
                    {a.kind === "video"
                      ? /linkedin\.com/i.test(a.href || "")
                        ? "Watch on LinkedIn ↗"
                        : "Watch the Video ↗"
                      : a.external
                      ? "Read Article ↗"
                      : a.kind === "pdf"
                      ? "Read the Paper →"
                      : "Read Article →"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
