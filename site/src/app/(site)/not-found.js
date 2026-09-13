import Link from "next/link";

// Without these the page inherits the root layout's title and robots rule,
// and the second one is emitted alongside this route group's — so a crawler
// was handed two conflicting instructions and a title that was just the
// firm's name.
export const metadata = {
  title: { absolute: "Page not found | Oswego Legacy Partners" },
  robots: { index: false, follow: true },
};

// 404 for anything under the main site (unknown /<slug>, a missing Library
// article). Rendered inside the (site) layout, so the header and footer come
// with it.
export default function SiteNotFound() {
  return (
    <section className="hero" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
      <div className="container hero-inner" style={{ textAlign: "center", paddingBlock: 80 }}>
        <div className="eyebrow" style={{ color: "var(--brass-soft)" }}>
          404
        </div>
        <h1 style={{ marginTop: 14 }}>This page could not be found.</h1>
        <p className="hero-body" style={{ marginInline: "auto", marginTop: 16 }}>
          The page you&apos;re looking for may have moved or never existed.
        </p>
        <div className="btn-row" style={{ marginTop: 28, justifyContent: "center" }}>
          <Link href="/" className="btn btn-ember">
            Return Home
          </Link>
          <Link href="/library" className="btn btn-ghost-light">
            Browse the Library
          </Link>
        </div>
      </div>
    </section>
  );
}
