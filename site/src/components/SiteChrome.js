import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getContent } from "@/lib/contentStore";

// Header + page + footer for every normal page on the site. Ad landing pages
// deliberately skip this (no navigation to wander off through).
export default async function SiteChrome({ children }) {
  const content = await getContent();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header siteName={content.siteName} />
      {/* Focusable so "skip to content" actually moves the keyboard there. */}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer content={content} />
    </>
  );
}
