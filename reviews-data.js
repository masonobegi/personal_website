/* =========================================================================
   CLIENT REVIEWS — single source of truth for the "Work With Me" page.

   HOW TO ADD A REAL REVIEW (takes 20 seconds, no code knowledge needed):
     1. Copy your client's EXACT words (from a text, email, or Google review).
     2. Paste a new block below, following the same shape.
     3. Delete the `placeholder: true` line so it renders as a real review.
     4. Save. That's it — the page rebuilds the reviews section automatically.

   Fields:
     quote        - the client's exact words (don't paraphrase — that's the point)
     name         - who said it            (e.g., "Sarah M.")
     business     - their business         (e.g., "The Pooch Pit")
     rating       - 1–5 stars              (usually 5)
     source       - "Google" or "Direct"   (where the review came from)
     link         - optional URL to the Google review ("" for none)
     placeholder  - REMOVE this line when it's a real review. While present,
                    the card shows as a greyed-out "example" slot.

   Tip: reviews with a real name + business + "Google" source convert best.
   ========================================================================= */

const REVIEWS = [
  {
    quote:
      "Paste your client's exact words here — a sentence or two about what the site changed for their business. Keep their voice; don't rewrite it.",
    name: "Client name",
    business: "The Pooch Pit",
    rating: 5,
    source: "Google",
    link: "",
    placeholder: true,
  },
  {
    quote:
      "A second real quote goes here. The best ones mention a concrete result — 'I update the whole site myself now' or 'bookings doubled after launch.'",
    name: "Client name",
    business: "OBGillustrator",
    rating: 5,
    source: "Direct",
    link: "",
    placeholder: true,
  },
  {
    quote:
      "One more here rounds out the section. Three to six strong reviews is the sweet spot.",
    name: "Client name",
    business: "Oswego Legacy Partners",
    rating: 5,
    source: "Google",
    link: "",
    placeholder: true,
  },
];
