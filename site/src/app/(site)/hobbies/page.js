import HobbyLego from "@/components/HobbyLego";
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
      <h1 className="page-title">{h.heroTitle || "Hobbies"}</h1>
      {h.heroSub && <p className="page-lead">{fmt(h.heroSub)}</p>}

      <div className="exp-list">
        {/* Lifting */}
        {h.liftingBody && (
          <article className="exp-item">
            <div className="exp-meta"><span className="exp-company">{h.liftingTitle || "Lifting"}</span></div>
            <div className="exp-detail">
              <div className="hobby-row">
                <div className="hobby-text">
                  <p>{fmt(h.liftingBody)}</p>
                  {h.liftingVideoUrl && <a className="hobby-cta" href={h.liftingVideoUrl} target="_blank" rel="noopener">Watch a lift on YouTube →</a>}
                </div>
                {h.liftingVideoUrl && (
                  <a className="hobby-media hobby-media-video" href={h.liftingVideoUrl} target="_blank" rel="noopener" aria-label="Watch a lift on YouTube">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {h.liftingThumb && <img src={h.liftingThumb} alt="A lift on YouTube" loading="lazy" />}
                    <span className="hobby-play" aria-hidden="true">▶</span>
                  </a>
                )}
              </div>
            </div>
          </article>
        )}

        {/* Chess */}
        {h.chessBody && (
          <article className="exp-item">
            <div className="exp-meta"><span className="exp-company">{h.chessTitle || "Chess"}</span></div>
            <div className="exp-detail">
              <div className="hobby-row">
                <div className="hobby-text">
                  <p>{fmt(h.chessBody)}</p>
                  {h.chessUrl && <a className="hobby-cta" href={h.chessUrl} target="_blank" rel="noopener">Play me on Chess.com →</a>}
                </div>
                {h.chessUrl && (
                  <a className="hobby-media hobby-media-wide" href={h.chessUrl} target="_blank" rel="noopener" aria-label="Chess.com profile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/chess-thumb.png" alt="Chess.com profile" loading="lazy" />
                  </a>
                )}
              </div>
            </div>
          </article>
        )}

        {/* LEGO */}
        {legoPhotos.length > 0 && (
          <article className="exp-item">
            <div className="exp-meta"><span className="exp-company">{h.legoTitle || "LEGO"}</span></div>
            <div className="exp-detail">
              <div className="hobby-row">
                <div className="hobby-text">
                  {h.legoBody && <p>{fmt(h.legoBody)}</p>}
                  <span className="hobby-hint">Use the arrows to browse — click a build to enlarge it.</span>
                </div>
                <HobbyLego photos={legoPhotos} />
              </div>
            </div>
          </article>
        )}
      </div>
      <div style={{ height: "4rem" }} />
    </>
  );
}
