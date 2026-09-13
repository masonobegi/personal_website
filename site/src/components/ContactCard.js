import Link from "next/link";
import ContactForm from "@/components/ContactForm";

// The "Begin a Private Conversation" card used as the right-hand rail on the
// home and segment pages (matches the reference layout). Combines the email
// contact form with a direct booking link.
export default function ContactCard({ source = "website", sticky = true }) {
  return (
    <div className={sticky ? "rail" : undefined}>
      <div className="contact-card">
        <div className="eyebrow">Begin a Private Conversation</div>
        <h3 style={{ marginTop: 10, marginBottom: 8 }}>
          The first conversation is simply a conversation.
        </h3>
        <p
          className="muted"
          style={{ fontSize: 16, marginBottom: 20, lineHeight: 1.5 }}
        >
          Share a little about your situation and we&apos;ll be in touch.
        </p>
        <ContactForm source={source} />
        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--line-soft)",
            fontSize: 15,
          }}
        >
          <span className="muted">Prefer to book directly? </span>
          <Link href="/contact" style={{ color: "var(--ember)", fontWeight: 600 }}>
            Schedule a call →
          </Link>
        </div>
      </div>
    </div>
  );
}
