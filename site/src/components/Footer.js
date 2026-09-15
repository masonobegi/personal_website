import Link from "next/link";
import { defaultContent } from "@/lib/defaultContent";

export default function Footer({ content = defaultContent }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <span>© {year} {content.siteName}</span>
      <nav className="footer-links">
        <Link href="/hire">Hire</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </footer>
  );
}
