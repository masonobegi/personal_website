import { PageHero, SectionHead } from "@/components/ui";
import { getContent } from "@/lib/contentStore";
import { buildMetadata } from "@/lib/seo";
import { formatText as fmt } from "@/lib/formatText";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const c = await getContent();
  const p = c.seo?.pages?.hobbies || {};
  return buildMetadata({ path: "/hobbies", title: p.title || "Hobbies", description: p.description, firm: c.siteName });
}

export default async function HobbiesPage() {
  const c = await getContent();
  const h = c.hobbies || {};
  const legoPhotos = Array.isArray(h.legoPhotos) ? h.legoPhotos.filter((g) => g && g.src) : [];

  return (
    <>
      <PageHero eyebrow="Outside the code" title={h.heroTitle || "Hobbies"} sub={h.heroSub} />

      {/* LEGO */}
      <section className="section" style={{ background: "var(--cream)" }}>
        <div className="container">
          <SectionHead eyebrow="Building" title={h.legoTitle || "LEGO"} />
          {h.legoBody && <p className="lead" style={{ maxWidth: "60ch" }}>{fmt(h.legoBody)}</p>}
          {legoPhotos.length > 0 ? (
            <div className="grid-3" style={{ gap: 20, marginTop: 26 }}>
              {legoPhotos.map((g, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.src} alt={g.caption || "LEGO build"} loading="lazy" style={{ width: "100%", borderRadius: 10, display: "block", border: "1px solid var(--line)" }} />
                  {g.caption && <figcaption className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>{g.caption}</figcaption>}
                </figure>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Photos coming soon.</p>
          )}
        </div>
      </section>

      {/* Lifting + Chess */}
      <section className="section" style={{ background: "var(--cream-deep)" }}>
        <div className="container grid-2" style={{ alignItems: "start", gap: 48 }}>
          <div>
            <div className="eyebrow">Training</div>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", marginTop: 10 }}>{h.liftingTitle || "Lifting"}</h2>
            {h.liftingBody && <p className="muted" style={{ marginTop: 12 }}>{fmt(h.liftingBody)}</p>}
            {h.liftingVideoUrl && (
              <a href={h.liftingVideoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ marginTop: 18 }}>Watch ↗</a>
            )}
          </div>
          <div>
            <div className="eyebrow">Strategy</div>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)", marginTop: 10 }}>{h.chessTitle || "Chess"}</h2>
            {h.chessBody && <p className="muted" style={{ marginTop: 12 }}>{fmt(h.chessBody)}</p>}
            {h.chessUrl && (
              <a href={h.chessUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ marginTop: 18 }}>My chess.com profile ↗</a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
