// Tells the browser about the hero photograph before it has read the
// stylesheet, which is otherwise the only place the hero is mentioned.
//
// Two links rather than one with a srcset: React does not put a srcset preload
// into the server-rendered HTML at all, which defeats the point of announcing
// it early. The breakpoint matches globals.css, and the wide rule is written as
// a negation so the two cannot both match — "(min-width: 760.01px)" looked
// exclusive but browsers round it down, so at exactly 760px both fired.
export default function HeroPreload({ isDefaultHero, custom }) {
  if (!isDefaultHero) {
    return custom ? <link rel="preload" as="image" href={custom} fetchPriority="high" /> : null;
  }

  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/hero-1080.webp"
        type="image/webp"
        media="(max-width: 760px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/hero-1920.webp"
        type="image/webp"
        media="not all and (max-width: 760px)"
        fetchPriority="high"
      />
    </>
  );
}
