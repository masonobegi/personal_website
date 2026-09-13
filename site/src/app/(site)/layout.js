import SiteChrome from "@/components/SiteChrome";

// Every normal page: header, content, footer. Ad landing pages (/go/…) live
// outside this group so they render without navigation — but they do paint the
// same photograph, so the preload lives in the root layout rather than here.
export default function SiteLayout({ children }) {
  return <SiteChrome>{children}</SiteChrome>;
}
