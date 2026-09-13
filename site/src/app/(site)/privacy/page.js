import { PageHero } from "@/components/ui";
import CTABand from "@/components/CTABand";
import JsonLd from "@/components/JsonLd";
import RichText from "@/components/RichText";
import { getContent } from "@/lib/contentStore";
import { breadcrumbLd } from "@/lib/seo";
import { standardMetadata } from "@/lib/pageMeta";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return standardMetadata("privacy", "/privacy", { title: "Privacy Notice" });
}

export default async function PrivacyPage() {
  const c = await getContent();
  const p = c.privacy || {};

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Privacy", path: "/privacy" },
        ])}
      />

      <PageHero eyebrow="Privacy" title={p.heroTitle} sub={p.heroSub} />

      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <RichText
            text={p.body}
            style={{ fontSize: 17.5, lineHeight: 1.75 }}
            pStyle={{ margin: "0 0 1.15em" }}
          />

          <div
            style={{
              marginTop: 34,
              paddingTop: 26,
              borderTop: "1px solid var(--line)",
            }}
          >
            <h2 style={{ fontSize: "1.5rem" }}>Contact us</h2>
            <p className="muted" style={{ marginTop: 10 }}>
              {c.phone && (
                <>
                  <a href={`tel:${String(c.phone).replace(/[^0-9+]/g, "")}`}>
                    {c.phone}
                  </a>
                  {" · "}
                </>
              )}
              {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
            </p>
          </div>
        </div>
      </section>

      <CTABand />
    </>
  );
}
