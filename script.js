/* =========================================================================
   EDIT THIS FILE TO ADD / CHANGE PROJECTS — nothing in index.html to touch.

   1. Add a new project  -> copy a block in PROJECTS and edit it.
   2. Add a screenshot    -> drop an image in the images/ folder and point
                             "image" at it (e.g. "images/my-project.png").
   3. Feature a project   -> set  featured: true  (shows big at the top).
   ========================================================================= */

// --- Your links (edit these) ---------------------------------------------
const SOCIALS = {
  github:   "https://github.com/masonobegi?tab=repositories",
  linkedin: "https://www.linkedin.com/in/mason-obegi-5a963b1ba/",
  email:    "mobegibusiness@gmail.com",
};

// The order categories appear in on the page.
const CATEGORY_ORDER = [
  "Client Work",
  "Apps",
  "Passion Projects",
];

// --- Your projects --------------------------------------------------------
const PROJECTS = [
  {
    title: "The Pooch Pit",
    category: "Client Work",
    description:
      "A booking-and-deposit platform for a real grooming business — Stripe deposits, an availability engine that prevents double-bookings, transactional email, and a no-code admin dashboard the owner runs herself.",
    tags: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    image: "images/jaidyn-website.png",
    live: "https://thepoochpitgrooming.com",
    code: "",
    featured: true,
  },
  {
    title: "OBGillustrator",
    category: "Client Work",
    description:
      "A multi-section fine-art e-commerce storefront for a photographer — prints, watercolors, and a sticker shop — with Stripe checkout and an automated image pipeline.",
    tags: ["Next.js", "TypeScript", "Prisma", "Stripe"],
    image: "images/imad-website.png",
    live: "https://imadobegi.up.railway.app",
    code: "",
    featured: true,
  },
  {
    title: "Oswego Legacy Partners",
    category: "Client Work",
    description:
      "A marketing site and password-protected admin dashboard for a wealth-management advisory firm.",
    tags: ["Next.js", "React", "Tailwind", "PostgreSQL"],
    image: "images/gibbs-prudential.png",
    live: "https://oswegolegacypartners.com",
    code: "",
    featured: true,
  },
  {
    title: "Cigar Maps",
    category: "Apps",
    description:
      "A full-stack PWA for cigar lovers: browse nearby lounges on an interactive map, track your collection, log tasting reviews, and follow store deals. Backed by a PostgreSQL API with JWT auth and store-owner dashboards, and wrapped with Capacitor for native iOS/Android builds.",
    tags: ["React", "Vite", "Express", "PostgreSQL", "Leaflet"],
    image: "images/cigar-maps.png",
    live: "https://cigarmapsclaude-production.up.railway.app",
    code: "",
    status: "In progress",
  },
  {
    title: "Bootleggers",
    category: "Passion Projects",
    description:
      "A real-time multiplayer strategy game (a Lords of Vegas build) with an authoritative Node/TypeScript server, a four-tier bot AI with EV-driven scoring, and a regression harness running 1,000+ simulated games with 25,000+ invariants.",
    tags: ["TypeScript", "Socket.IO", "Node", "Phaser", "PostgreSQL"],
    image: "images/bootleggers.png",
    live: "https://bootleggers.up.railway.app",
    code: "",
    featured: true,
  },
  {
    title: "Betrayal at House on the Hill",
    category: "Passion Projects",
    description:
      "An online multiplayer engine for Betrayal at House on the Hill, built on a server-authoritative rules architecture with a framework-free HTML5 Canvas client and procedural audio.",
    tags: ["Node", "WebSocket", "Vanilla JS", "Canvas"],
    image: "images/betrayal.png",
    live: "https://betrayal-production-c191.up.railway.app",
    code: "",
    status: "In progress",
  },
  {
    title: "Spot Kick",
    category: "Passion Projects",
    description:
      "A two-player penalty-shootout party game that runs as a Discord Activity, with momentum-powered special abilities. Playable versus a bot, pass-and-play, or online in real time over WebSockets.",
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    image: "images/discord-soccer.png",
    live: "https://discord-soccer-production.up.railway.app",
    code: "",
  },
  {
    title: "Best of 5",
    category: "Passion Projects",
    description:
      "A best-of-five Discord duel that rotates through Connect 4, Checkers, Battleship, Chess, and mini golf — first to three games wins. Full Discord Activity integration.",
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    image: "images/bestof5.png",
    live: "https://bestof5-production-54ef.up.railway.app",
    code: "",
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
    items.push(`<a href="${SOCIALS.github}" target="_blank" rel="noopener">GitHub →</a>`);
  if (SOCIALS.linkedin)
    items.push(`<a href="${SOCIALS.linkedin}" target="_blank" rel="noopener">LinkedIn →</a>`);
  if (SOCIALS.email)
    items.push(`<a href="#" class="copy-email" data-email="${SOCIALS.email}">Email →</a>`);
  return items.join("");
}

function tagsHtml(tags) {
  return `<p class="card-tags">${(tags || []).join(", ")}</p>`;
}

function thumbHtml(p, showFeatured) {
  // Shows the screenshot if it exists; otherwise a clean placeholder.
  const tag = showFeatured && p.featured ? `<span class="thumb-badge">Featured</span>` : "";
  return `
    <div class="thumb">
      <span class="thumb-placeholder">Screenshot coming soon</span>
      <img src="${p.image}" alt="${p.title} screenshot" loading="lazy" onerror="this.remove()" />
      ${tag}
    </div>`;
}

function badgesHtml(p) {
  return p.status ? `<span class="status-note">· ${p.status}</span>` : "";
}

// One card style everywhere. The whole card links to the project when a URL exists.
function card(p, showFeatured) {
  const url = p.live || p.code || "";
  const cls = `card${showFeatured && p.featured ? " is-featured" : ""}${url ? " card-linked" : ""}`;
  const inner = `
      ${thumbHtml(p, showFeatured)}
      <div class="card-body">
        <div class="card-title">
          <h3>${p.title}</h3>
          ${badgesHtml(p)}
        </div>
        <p class="desc">${p.description}</p>
        ${tagsHtml(p.tags)}
      </div>`;
  return url
    ? `<a class="${cls}" href="${url}" target="_blank" rel="noopener">${inner}</a>`
    : `<article class="${cls}">${inner}</article>`;
}

// ---- Light / dark theme toggle -------------------------------------------
const SUN =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.innerHTML = theme === "dark" ? SUN : MOON;
}

function initTheme() {
  let theme = "light";
  try {
    theme = localStorage.getItem("theme") || "light";
  } catch (e) {}
  applyTheme(theme);
  const btn = document.getElementById("theme-toggle");
  if (btn)
    btn.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
}

// Click-to-copy email — avoids opening a mail client (Outlook, etc.)
function initCopyEmail() {
  document.querySelectorAll(".copy-email").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const email = el.getAttribute("data-email");
      const done = () => {
        if (!el.dataset.original) el.dataset.original = el.textContent;
        el.textContent = "Copied!";
        setTimeout(() => { el.textContent = el.dataset.original; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done).catch(done);
      } else {
        done();
      }
    });
  });
}

function render() {
  // Social links (hero)
  document.getElementById("socials").innerHTML = socialsHtml();

  // Featured grid (shown first, highlighted)
  const featured = PROJECTS.filter((p) => p.featured);
  document.getElementById("featured").innerHTML =
    featured.map((p) => card(p, true)).join("");

  // Grouped grid (ALL projects, including featured), in CATEGORY_ORDER.
  const groupsEl = document.getElementById("project-groups");
  let html = "";
  for (const category of CATEGORY_ORDER) {
    const items = PROJECTS.filter((p) => p.category === category);
    if (!items.length) continue;
    html += `
      <div class="project-group">
        <h3 class="group-title">${category}</h3>
        <div class="card-grid">${items.map((p) => card(p, false)).join("")}</div>
      </div>`;
  }
  groupsEl.innerHTML = html;

  // Footer year
  document.getElementById("year").textContent = new Date().getFullYear();

  // Theme toggle
  initTheme();

  // Click-to-copy email links
  initCopyEmail();
}

render();
