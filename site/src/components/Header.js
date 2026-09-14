"use client";

import { useState } from "react";
import Link from "next/link";
import { primaryNav, site } from "@/lib/site";

const linkStyle = {
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--ink-soft)",
  whiteSpace: "nowrap",
};

export default function Header({ siteName = site.name }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--cream)",
        color: "var(--ink)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBlock: 14 }}
      >
        <Link href="/" aria-label={siteName} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-mo.png" alt={siteName} style={{ height: 24, width: "auto", display: "block" }} />
        </Link>

        <nav aria-label="Main" className="hdr-desktop" style={{ display: "none", gap: 26, alignItems: "baseline" }}>
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} style={linkStyle} className="hdr-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="hdr-toggle"
          style={{
            background: "transparent",
            border: "1px solid var(--line-control)",
            color: "var(--ink)",
            padding: "7px 11px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            letterSpacing: "0.1em",
          }}
        >
          {open ? "CLOSE" : "MENU"}
        </button>
      </div>

      <nav
        id="mobile-menu"
        aria-label="Main (mobile)"
        className="hdr-mobile"
        style={{ display: open ? "block" : "none", borderTop: "1px solid var(--line)", padding: "6px 28px 18px" }}
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              paddingBlock: 11,
              fontSize: 17,
              color: "var(--ink)",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <style>{`
        .hdr-link:hover { color: var(--ink); }
        @media (min-width: 900px) {
          .hdr-desktop { display: flex !important; }
          .hdr-toggle { display: none !important; }
          .hdr-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}
