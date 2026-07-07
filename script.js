/* =========================================================================
   EDIT THIS FILE TO ADD / CHANGE PROJECTS — nothing in index.html to touch.

   1. Add a new project  -> copy a block in PROJECTS and edit it.
   2. Add a screenshot    -> drop an image in the images/ folder and point
                             "image" at it (e.g. "images/my-project.png").
   3. Feature a project   -> set  featured: true  (shows big at the top).
   ========================================================================= */

// --- Your links (edit these) ---------------------------------------------
const SOCIALS = {
  github:   "https://github.com/masonobegi",
  linkedin: "https://www.linkedin.com/in/YOUR-HANDLE", // TODO: paste your real LinkedIn URL
  email:    "mason.obegi@gmail.com",
};

// The order categories appear in on the page.
const CATEGORY_ORDER = [
  "Board Game Adaptations",
  "Discord Games",
  "Apps",
  "Client Work",
];

// --- Your projects --------------------------------------------------------
const PROJECTS = [
  {
    title: "Bootleggers",
    category: "Board Game Adaptations",
    description:
      "A browser-based, real-time multiplayer build of the tabletop game Lords of Vegas, where players fight over Vegas casinos for points. An authoritative Node/TypeScript server runs the full rules engine and Socket.IO rooms, with difficulty-tunable AI opponents and a Phaser + Three.js board.",
    tags: ["TypeScript", "Socket.IO", "Node", "Phaser", "PostgreSQL"],
    image: "images/bootleggers.png",
    live: "",   // TODO: paste the public URL
    code: "",   // TODO: paste the GitHub repo URL
    featured: true,
  },
  {
    title: "Cigar Maps",
    category: "Apps",
    description:
      "A full-stack PWA for cigar lovers: browse nearby lounges on an interactive map, track your collection, log tasting reviews, and follow store deals. Backed by a PostgreSQL API with JWT auth and store-owner dashboards, and wrapped with Capacitor for native iOS/Android builds.",
    tags: ["React", "Vite", "Express", "PostgreSQL", "Leaflet"],
    image: "images/cigar-maps.png",
    live: "",
    code: "",
    status: "In progress",
  },
  {
    title: "Discord Soccer",
    category: "Discord Games",
    description:
      "A two-player penalty-shootout party game that runs as a Discord Activity, with momentum-powered special abilities. Playable versus a bot, pass-and-play, or online in real time over WebSockets.",
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    image: "images/discord-soccer.png",
    live: "",
    code: "",
  },
  {
    title: "Betrayal",
    category: "Board Game Adaptations",
    description:
      "An online multiplayer engine for Betrayal at House on the Hill, built on a server-authoritative rules architecture with a framework-free HTML5 Canvas client and procedural audio.",
    tags: ["Node", "WebSocket", "Vanilla JS", "Canvas"],
    image: "images/betrayal.png",
    live: "",
    code: "",
    status: "In progress",
  },
  {
    title: "Best of 5",
    category: "Discord Games",
    description:
      "A best-of-five Discord duel that rotates through Connect 4, Checkers, Battleship, Chess, and mini golf — first to three games wins. Full Discord Activity integration.",
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    image: "images/bestof5.png",
    live: "",
    code: "",
  },
  {
    title: "Gibbs Prudential",
    category: "Client Work",
    description:
      "A marketing site and password-protected admin dashboard for a wealth-management advisory firm.",
    tags: ["Next.js", "React", "Tailwind", "PostgreSQL"],
    image: "images/gibbs-prudential.png",
    live: "",
    code: "",
    featured: true,
  },
  {
    title: "Imad Photography",
    category: "Client Work",
    description:
      "An e-commerce storefront for a photographer, selling fine-art prints with Stripe checkout.",
    tags: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    image: "images/imad-website.png",
    live: "",
    code: "",
    featured: true,
  },
  {
    title: "The Pooch Pit",
    category: "Client Work",
    description:
      "A booking-and-deposit website for a dog & cat grooming business, with an admin dashboard for managing appointments.",
    tags: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    image: "images/jaidyn-website.png",
    live: "",
    code: "",
    featured: true,
  },
];

/* =========================================================================
   Rendering logic below — you normally won't need to touch this.
   ========================================================================= */

const ICONS = {
  github:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6Zm-2 0-8 5-8-5h16Zm0 12H4V8l8 5 8-5v10Z"/></svg>',
  external:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

function socialsHtml() {
  const items = [];
  if (SOCIALS.github)
    items.push(`<a href="${SOCIALS.github}" target="_blank" rel="noopener" aria-label="GitHub">${ICONS.github}</a>`);
  if (SOCIALS.linkedin)
    items.push(`<a href="${SOCIALS.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">${ICONS.linkedin}</a>`);
  if (SOCIALS.email)
    items.push(`<a href="mailto:${SOCIALS.email}" aria-label="Email">${ICONS.email}</a>`);
  return items.join("");
}

function tagsHtml(tags) {
  return `<div class="tags">${(tags || []).map((t) => `<span>${t}</span>`).join("")}</div>`;
}

function linksHtml(p) {
  const links = [];
  if (p.live)
    links.push(`<a href="${p.live}" target="_blank" rel="noopener" class="card-link">Live ${ICONS.external}</a>`);
  if (p.code)
    links.push(`<a href="${p.code}" target="_blank" rel="noopener" class="card-link">Code ${ICONS.github}</a>`);
  return links.length ? `<div class="card-links">${links.join("")}</div>` : "";
}

function thumbHtml(p) {
  // Shows the screenshot if it exists; otherwise a clean placeholder.
  return `
    <div class="thumb">
      <span class="thumb-placeholder">Screenshot coming soon</span>
      <img src="${p.image}" alt="${p.title} screenshot" loading="lazy" onerror="this.remove()" />
    </div>`;
}

function statusHtml(p) {
  return p.status ? `<span class="badge">${p.status}</span>` : "";
}

function featuredCard(p) {
  return `
    <article class="feature-card">
      ${thumbHtml(p)}
      <div class="feature-body">
        <p class="eyebrow">Featured Project</p>
        <h4>${p.title} ${statusHtml(p)}</h4>
        <p>${p.description}</p>
        ${tagsHtml(p.tags)}
        ${linksHtml(p)}
      </div>
    </article>`;
}

function gridCard(p) {
  return `
    <article class="project-card">
      ${thumbHtml(p)}
      <div class="card-body">
        <h4>${p.title} ${statusHtml(p)}</h4>
        <p>${p.description}</p>
        ${tagsHtml(p.tags)}
        ${linksHtml(p)}
      </div>
    </article>`;
}

function render() {
  // Social icons (hero + contact)
  const s = socialsHtml();
  document.getElementById("socials").innerHTML = s;
  document.getElementById("socials-contact").innerHTML = s;

  // Featured row
  const featured = PROJECTS.filter((p) => p.featured);
  document.getElementById("featured").innerHTML = featured.map(featuredCard).join("");

  // Grouped grid (ALL projects, including featured ones), in CATEGORY_ORDER.
  // Featured projects show big at the top AND again inside their category.
  const groupsEl = document.getElementById("project-groups");
  let html = "";
  for (const category of CATEGORY_ORDER) {
    const items = PROJECTS.filter((p) => p.category === category);
    if (!items.length) continue;
    html += `
      <div class="project-group">
        <h4 class="group-title">${category}</h4>
        <div class="projects-grid">${items.map(gridCard).join("")}</div>
      </div>`;
  }
  groupsEl.innerHTML = html;

  // Footer year
  document.getElementById("year").textContent = new Date().getFullYear();
}

render();
