"use client";

import { useEffect, useRef, useState } from "react";

// A quiet "there's more below" affordance for the bottom of a hero.
//
// Heroes are tall and vertically centred, so on a laptop they can fill the
// viewport with nothing but their own text — one visitor took the header for
// the whole page. This gives them something to aim at, and fades out once
// they've started scrolling.
//
// It scrolls to just past its own hero, so it works on any page without that
// page having to label the section underneath.
export default function ScrollCue() {
  const ref = useRef(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const onScroll = () => setGone(window.scrollY > 100);
    onScroll(); // handles a restored scroll position on back-navigation
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function jump() {
    const hero = ref.current?.closest(".hero");
    // Land just past the hero, leaving a sliver of it under the sticky header
    // so the jump reads as a scroll rather than a page change.
    const top = hero
      ? hero.getBoundingClientRect().bottom + window.scrollY - 58
      : window.innerHeight * 0.86;
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={jump}
      aria-label="Scroll to the next section"
      className="scroll-cue"
      // `inert` rather than visibility:hidden, which is not part of the
      // transition and would make the chevron vanish instead of fading. At
      // opacity 0 it was still reachable by Tab and still announced.
      inert={gone ? "" : undefined}
      style={{ opacity: gone ? 0 : 1, pointerEvents: gone ? "none" : "auto" }}
    >
      <svg width="26" height="15" viewBox="0 0 26 15" aria-hidden="true">
        <path
          d="M1 1 L13 13 L25 1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
