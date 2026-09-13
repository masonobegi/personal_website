export const metadata = {
  title: { absolute: "Page not found | Oswego Legacy Partners" },
  robots: { index: false, follow: true },
};

// Fallback 404 for URLs outside the main site's routes (and for landing pages
// that don't exist). Kept deliberately light: Next embeds this component in
// every page's data, so a full header and footer here would add weight to the
// whole site. Pages under the main site use (site)/not-found.js instead.
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="hero"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}
    >
      <div className="container hero-inner" style={{ textAlign: "center", paddingBlock: 80 }}>
        <div className="eyebrow" style={{ color: "var(--brass-soft)" }}>
          404
        </div>
        <h1 style={{ marginTop: 14 }}>This page could not be found.</h1>
        <p className="hero-body" style={{ marginInline: "auto", marginTop: 16 }}>
          The page you&apos;re looking for may have moved or never existed.
        </p>
        <div className="btn-row" style={{ marginTop: 28, justifyContent: "center" }}>
          <a href="/" className="btn btn-ember">
            Return Home
          </a>
          <a href="/library" className="btn btn-ghost-light">
            Browse the Library
          </a>
        </div>
      </div>
    </main>
  );
}
