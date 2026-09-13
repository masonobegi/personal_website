// =============================================================================
//  SITE CONFIG — masonobegi.com (personal portfolio)
//  Central place for nav and shared identity. Editable copy lives in the
//  admin dashboard (see defaultContent.js); these are seed/fallback values.
// =============================================================================

export const site = {
  name: "Mason Obegi",
  shortName: "Mason Obegi",
  tagline: "Software Engineer",
  // Left blank on purpose — the real values live in the dashboard and fall
  // back to these only if the database is briefly unreachable.
  phone: "(360) 921-0148",
  email: "info@masonobegi.com",
  location: "Camas, WA",
  githubUrl: "https://github.com/masonobegi",
  linkedinUrl: "https://www.linkedin.com/in/mason-obegi-5a963b1ba",
  resumeUrl: "/resume.pdf",
};

// Primary navigation (shown in the header). The logo links Home.
// The Hire page is intentionally NOT in the primary nav — it's a conversion
// landing page you point prospects and ads at.
export const primaryNav = [
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Hobbies", href: "/hobbies" },
  { label: "Library", href: "/library" },
  { label: "Contact", href: "/contact" },
];
