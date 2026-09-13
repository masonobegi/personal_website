"use client";

import { useState } from "react";
import Link from "next/link";
import { primaryNav, site } from "@/lib/site";

const linkStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 17.5,
  color: "#e8e2d3",
  whiteSpace: "nowrap",
};

export default function Header({ siteName = site.name }) {
  const [open, setOpen] = useState(false); // mobile menu

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(20,32,26,0.96)",
        backdropFilter: "saturate(140%) blur(6px)",
        color: "#f4f0e8",
        borderBottom: "1px solid rgba(162,133,79,0.28)",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBlock: 16 }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, color: "#efe9db" }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {siteName}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main" className="hdr-desktop" style={{ display: "none", gap: 20, alignItems: "baseline" }}>
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} style={linkStyle}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="hdr-toggle"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#f4f0e8",
            padding: "8px 12px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            letterSpacing: "0.1em",
          }}
        >
          {open ? "CLOSE" : "MENU"}
        </button>
      </div>

      {/* Mobile menu */}
      <nav
        id="mobile-menu"
        aria-label="Main (mobile)"
        className="hdr-mobile"
        style={{ display: open ? "block" : "none", borderTop: "1px solid rgba(162,133,79,0.28)", padding: "10px 28px 22px" }}
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              paddingBlock: 12,
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: "#e8e2d3",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <style>{`
        @media (min-width: 1000px) {
          .hdr-desktop { display: flex !important; }
          .hdr-toggle { display: none !important; }
          .hdr-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}
