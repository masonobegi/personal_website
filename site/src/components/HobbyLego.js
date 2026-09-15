"use client";

import { useEffect, useState } from "react";

// LEGO carousel + click-to-enlarge lightbox. Same markup/classes as the static
// site (see .hobby-carousel / .carousel-* / .lightbox in globals.css), but
// state-driven and content-fed.
export default function HobbyLego({ photos = [] }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const n = photos.length;
  const go = (i) => setIdx((i + n) % n);

  useEffect(() => {
    const onKey = (e) => {
      if (open) {
        if (e.key === "Escape") setOpen(false);
        else if (e.key === "ArrowLeft") { setIdx((i) => (i - 1 + n) % n); e.preventDefault(); }
        else if (e.key === "ArrowRight") { setIdx((i) => (i + 1) % n); e.preventDefault(); }
        return;
      }
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { setIdx((i) => (i - 1 + n) % n); }
      else if (e.key === "ArrowRight") { setIdx((i) => (i + 1) % n); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, n]);

  if (!n) return null;

  return (
    <div className="hobby-media hobby-carousel" aria-label="LEGO builds">
      <div className="carousel-viewport">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            className={"carousel-slide" + (i === idx ? " is-active" : "")}
            src={p.src}
            alt={p.caption || "LEGO build"}
            loading="lazy"
            style={{ cursor: "zoom-in" }}
            onClick={() => setOpen(true)}
          />
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" className="carousel-arrow carousel-prev" onClick={() => go(idx - 1)} aria-label="Previous build">‹</button>
          <button type="button" className="carousel-arrow carousel-next" onClick={() => go(idx + 1)} aria-label="Next build">›</button>
          <div className="carousel-dots">
            {photos.map((_, i) => (
              <button key={i} type="button" className={"carousel-dot" + (i === idx ? " is-active" : "")} onClick={() => go(i)} aria-label={`Show build ${i + 1}`} />
            ))}
          </div>
        </>
      )}
      {open && (
        <div className="lightbox open" aria-hidden="false" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <button className="lightbox-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          {n > 1 && <button className="lightbox-nav lightbox-prev" onClick={() => go(idx - 1)} aria-label="Previous image">‹</button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lightbox-img" src={photos[idx].src} alt={photos[idx].caption || ""} />
          {n > 1 && <button className="lightbox-nav lightbox-next" onClick={() => go(idx + 1)} aria-label="Next image">›</button>}
        </div>
      )}
    </div>
  );
}
