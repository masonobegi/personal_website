import Link from "next/link";
import { site } from "@/lib/site";
import { getContent } from "@/lib/contentStore";
import { formatText } from "@/lib/formatText";

// Full-width booking / email call-to-action band. Dropped onto every page that
// doesn't already show the contact form, so there's always a way to reach out.
//
// The address comes from the admin dashboard (Content -> Firm -> Email). It used
// to read the hardcoded default in lib/site instead, which meant the field in
// the dashboard did nothing and every page shipped a placeholder mailto.
export default async function CTABand({
  title = "Begin a private conversation.",
  sub = "The first conversation is simply a conversation — no pressure, no obligation.",
  // Background override — pass a deeper/different shade when the CTA follows
  // another dark section so the two read as separate bands, not one blob.
  bg = "var(--cream-deep)",
}) {
  const c = await getContent();
  const email = c.email || site.email;

  return (
    <section className="section" style={{ background: bg, color: "var(--ink)", borderTop: "1px solid var(--line)" }}>
      <div className="container" style={{ textAlign: "center" }}>
        <div className="eyebrow">Get in Touch</div>
        <h2 style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.7rem)", marginTop: 12, maxWidth: "22ch", marginInline: "auto" }}>
          {formatText(title)}
        </h2>
        <p className="muted" style={{ marginTop: 16, maxWidth: "48ch", marginInline: "auto" }}>
          {formatText(sub)}
        </p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 28 }}>
          <Link href="/contact" className="btn btn-ember">Get in touch</Link>
          <a href={`mailto:${email}`} className="btn btn-outline">Email me</a>
        </div>
      </div>
    </section>
  );
}
