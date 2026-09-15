import Link from "next/link";
import { primaryNav, site } from "@/lib/site";

export default function Header({ siteName = site.name }) {
  return (
    <header className="topnav">
      <Link className="brand" href="/" aria-label={siteName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/images/logo-mo.png" alt={siteName} />
      </Link>
      <nav className="nav-links">
        {primaryNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>
    </header>
  );
}
