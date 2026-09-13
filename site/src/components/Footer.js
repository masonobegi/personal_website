import { Children } from "react";
import Link from "next/link";
import { primaryNav } from "@/lib/site";
import { defaultContent } from "@/lib/defaultContent";

export default function Footer({ content = defaultContent }) {
  const year = new Date().getFullYear();
  const f = content.footer || {};
  const email = content.email || "";
  const phone = content.phone || "";

  return (
    <footer style={{ background: "var(--cream)", color: "var(--ink)", fontFamily: "var(--font-body)" }}>
      <div className="container" style={{ paddingBlock: "70px 40px" }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 40, alignItems: "start" }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--ink)" }}>
              {content.siteName}
            </div>
            <p style={{ color: "var(--ink-soft)", maxWidth: "36ch", marginTop: 12, fontSize: 16.5, lineHeight: 1.6 }}>
              {f.tagline}
            </p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link href="/contact" className="btn btn-ember">Get in touch</Link>
              <Link href="/hire" className="btn btn-outline">Hire me</Link>
            </div>
          </div>

          {/* Explore */}
          <FooterCol title="Explore">
            {primaryNav.map((n) => (
              <FooterLink key={n.href} href={n.href}>{n.label}</FooterLink>
            ))}
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </FooterCol>

          {/* Get in Touch */}
          <FooterCol title="Get in Touch">
            {email && (
              <a href={`mailto:${email}`} style={{ color: "var(--ink)", display: "block", marginBottom: 4 }}>{email}</a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} style={{ color: "var(--ink)", display: "block", marginBottom: 4 }}>{phone}</a>
            )}
            {content.githubUrl && (
              <a href={content.githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)", display: "block", marginTop: 6 }}>GitHub ↗</a>
            )}
            {content.linkedinUrl && (
              <a href={content.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-soft)", display: "block" }}>LinkedIn ↗</a>
            )}
          </FooterCol>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 26,
            borderTop: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13.5,
            color: "var(--ink-faint)",
          }}
        >
          <span>© {year} {content.siteName}</span>
          <FooterLink href="/admin">Admin</FooterLink>
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) { .footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px) { .footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}

function FooterCol({ title, children }) {
  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: "0 0 16px" }}>{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {Children.map(children, (child) => (child ? <li>{child}</li> : null))}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }) {
  return (
    <Link href={href} style={{ color: "var(--ink-soft)", fontSize: 16 }} className="footer-link">
      {children}
    </Link>
  );
}
