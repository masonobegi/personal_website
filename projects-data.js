/* =========================================================================
   SINGLE SOURCE OF TRUTH for all projects — used by both the home page
   (script.js) and the project detail pages (project.js).

   To add a project: copy a block and fill it in. Fields:
     slug        - unique id used in the URL (project.html?id=SLUG). keep it
                   lowercase-with-dashes and never reuse one.
     title       - display name
     category    - group heading on the home page (see CATEGORY_ORDER)
     description - short one/two-liner for the project CARD
     long        - array of paragraphs for the DETAIL page (the full story)
     tags        - short tech list shown on the card
     tools       - fuller tech list shown on the detail page
     image       - the card thumbnail (also the first gallery image)
     gallery     - array of screenshot paths for the detail page. Add more by
                   dropping images in images/ and listing them here.
     video       - optional screen-recording path (e.g. "images/pooch.mp4"); "" = none
     live        - public URL (shown as a subtle link on the detail page)
     liveLabel   - optional custom label for the live link (e.g. "Download on
                   the App Store ↗"); defaults to "Visit live site ↗"
     code        - GitHub URL (optional)
     status      - e.g. "In progress"  (optional)
     featured    - true to show in the featured row + a Featured tag
   ========================================================================= */

const CATEGORY_ORDER = ["Client Work", "Apps", "Passion Projects"];

const PROJECTS = [
  {
    slug: "pooch-pit",
    title: "The Pooch Pit",
    category: "Client Work",
    description:
      "A booking-and-deposit platform for a real grooming business — Stripe deposits, an availability engine that prevents double-bookings, transactional email, and a no-code admin dashboard the owner runs herself.",
    long: [
      "The Pooch Pit is a production booking-and-payments platform I built and deployed for a real dog & cat grooming business. Clients request appointments online, the owner approves them, and the system collects a Stripe deposit up front and the balance (plus tipping) after the visit — all through webhook-verified payments.",
      "An availability engine prevents double-bookings with interval-overlap checks and supports configurable hours plus one-off or recurring time-off. A no-code admin dashboard lets the non-technical owner manage pricing, hours, photos, content, and reviews herself, with every change cascading across the site instantly.",
      "It's hardened for production — input validation, rate limiting, spam protection, security headers, and automatic HEIC-to-JPEG image handling — and I own the full deployment: PostgreSQL with Prisma on Railway, Cloudflare DNS and SSL, and automated point-in-time backups.",
    ],
    tags: ["Next.js", "TypeScript", "Prisma", "Stripe", "Resend"],
    tools: ["Next.js", "TypeScript", "React", "Prisma", "PostgreSQL", "Stripe", "Resend", "Sharp", "Railway", "Cloudflare"],
    image: "images/poochpit-home.png",
    gallery: [
      { src: "images/poochpit-home.png", caption: "The public homepage — hero, services, and a clear path to booking." },
      { src: "images/poochpit-book.png", caption: "The booking flow: clients choose a pet, service, and time, then pay a Stripe deposit to lock the slot." },
      { src: "images/poochpit-gallery.png", caption: "A grooming gallery of before-and-afters the owner curates from the admin." },
      { src: "images/poochpit-admin-requests.png", caption: "Staff dashboard — approve or decline incoming appointment requests, with live status counts. (Client details redacted.)" },
      { src: "images/poochpit-admin-calendar.png", caption: "The availability engine: set working days and block one-off or recurring time off; blocked slots disappear from what clients can request." },
      { src: "images/poochpit-admin-edit.png", caption: "No-code CMS: the non-technical owner edits copy, pricing, contact info, and policies herself, and changes go live instantly." },
    ],
    video: "",
    live: "https://thepoochpitgrooming.com",
    code: "",
    featured: true,
  },
  {
    slug: "obgillustrator",
    title: "OBGillustrator",
    category: "Client Work",
    description:
      "A multi-section fine-art e-commerce storefront for an artist — prints, watercolors, and a sticker shop — with Stripe checkout and an automated image pipeline.",
    long: [
      "OBGillustrator is a multi-section fine-art e-commerce storefront I built for an artist, selling photography prints, watercolors, and a sticker shop with full Stripe checkout.",
      "I engineered an automated image-processing pipeline using Sharp and Python (pillow-heif) for watermarking and HEIC conversion, and added secure cookie-based auth, Open Graph/SEO, and a fully responsive mobile design. It's live on a custom domain with Cloudflare DNS/SSL and a Railway-managed Postgres database.",
    ],
    tags: ["Next.js", "TypeScript", "Stripe", "Sharp", "Cloudflare"],
    tools: ["Next.js", "TypeScript", "React", "Prisma", "PostgreSQL", "Stripe", "Sharp", "Python (pillow-heif)", "Railway", "Cloudflare"],
    image: "images/obg-home.png",
    gallery: [
      { src: "images/obg-home.png", caption: "The storefront homepage, with photography and fine-art sections." },
      { src: "images/obg-fineart.png", caption: "The fine-art catalog — oils, watercolors, and encaustics, each with its own gallery." },
      { src: "images/obg-about.png", caption: "The artist's About page." },
      { src: "images/obg-commission.png", caption: "A custom-commission request form that emails the artist directly." },
      { src: "images/obg-analytics.png", caption: "Built-in, cookie-free analytics: server-side page views, top pages, and referrers." },
      { src: "images/obg-products.png", caption: "No-code product management — drag to reorder artwork and set print pricing per size." },
      { src: "images/obg-orders.png", caption: "Order management with Stripe checkout: fulfil orders and email customers. (Customer details redacted.)" },
    ],
    video: "",
    live: "https://imadobegi.up.railway.app",
    code: "",
    featured: true,
  },
  {
    slug: "oswego",
    title: "Oswego Legacy Partners",
    category: "Client Work",
    description:
      "A marketing site and password-protected admin dashboard for a wealth-management advisory firm.",
    long: [
      "A marketing website and password-protected admin dashboard I built for a wealth-management advisory firm. The public site presents the firm and its services; behind a login, an admin area manages site content.",
      "Built with Next.js and Tailwind CSS, backed by PostgreSQL, with transactional email through Resend, and deployed on Railway.",
    ],
    tags: ["Next.js", "React", "Tailwind", "PostgreSQL", "Resend"],
    tools: ["Next.js", "React", "Tailwind CSS", "PostgreSQL", "Resend", "Railway"],
    image: "images/oswego-home.png",
    gallery: [
      { src: "images/oswego-home.png", caption: "The firm's marketing homepage." },
      { src: "images/oswego-team.png", caption: "The advisory-team section." },
      { src: "images/oswego-consultation.png", caption: "The private-consultation request flow." },
      { src: "images/oswego-admin.png", caption: "Password-protected admin: edit site content and hero imagery, all persisted in Postgres." },
    ],
    video: "",
    live: "https://oswegolegacypartners.com",
    code: "",
    featured: true,
  },
  {
    slug: "basketrogue",
    title: "BasketRogue",
    category: "Apps",
    description:
      "A published App Store basketball roguelike, built from scratch in Godot with GDScript. Draft a squad, pick a run-defining X-Factor, and battle deeper into an escalating bracket — earning upgrades, stealing players, and gambling in a between-rounds shop.",
    long: [
      "BasketRogue is a fast-paced basketball roguelike I designed, built, and shipped to the Apple App Store. Every run starts fresh: you draft and customize a squad, allocate skill points across shooting, defense, speed, and dribbling, and lock in a single run-defining X-Factor ability before tip-off — no two teams play the same.",
      "Matches play out on an arcade court with a retro LED scoreboard and a real game clock. Between rounds a roguelike progression loop lets you bank winnings, upgrade skills, steal players off the opposing roster, and gamble in a shop on one-off drinks and superstitions — while rivalry games and per-city difficulty modifiers ramp the pressure the deeper you push into the bracket.",
      "It's built in the Godot Engine with GDScript and exported natively to iOS (iPhone and iPad) as well as WebAssembly. This is a deliberately different stack from my TypeScript/Phaser games — a from-scratch Godot build covering game feel, UI, opponent AI, and the full economy and progression systems, carried all the way through App Store review and release.",
    ],
    tags: ["Godot", "GDScript", "iOS", "App Store", "WebAssembly"],
    tools: ["Godot Engine", "GDScript", "iOS (iPhone & iPad)", "WebAssembly", "Xcode", "App Store Connect"],
    image: "images/basketrogue.png",
    gallery: [
      { src: "images/basketrogue.png", caption: "Build your squad — customize your player and allocate stats before tip-off." },
      { src: "images/basketrogue-2.png", caption: "Scout the rivalry-game opponent and lock in a run-defining X-Factor." },
      { src: "images/basketrogue-3.png", caption: "Live gameplay on the arcade court, with a retro LED scoreboard and a real game clock." },
      { src: "images/basketrogue-4.png", caption: "Between rounds: bank winnings, upgrade skills, steal players, and choose the next city." },
    ],
    video: "",
    live: "https://apps.apple.com/us/app/basketrogue/id6762860660",
    liveLabel: "Download on the App Store ↗",
    code: "",
    status: "Published",
  },
  {
    slug: "cigar-maps",
    title: "Cigar Maps",
    category: "Apps",
    description:
      "A full-stack PWA for cigar lovers: browse nearby lounges on an interactive map, track your collection, log tasting reviews, and follow store deals. Backed by a PostgreSQL API with JWT auth and store-owner dashboards, and wrapped with Capacitor for native iOS/Android builds.",
    long: [
      "Cigar Maps is a full-stack progressive web app for cigar enthusiasts. Users browse nearby cigar lounges on an interactive Leaflet map, track their personal collection, log tasting reviews in a 'passport,' and follow store deals and events.",
      "It's backed by a PostgreSQL API with JWT auth and store-owner dashboards, geocodes store addresses via OpenStreetMap, syncs inventory from Google Sheets, and is wrapped with Capacitor for native iOS and Android builds.",
    ],
    tags: ["React", "Express", "PostgreSQL", "Leaflet", "Capacitor"],
    tools: ["React", "Vite", "Express", "Node.js", "PostgreSQL", "JWT", "Leaflet", "Capacitor", "Google Sheets API"],
    image: "images/cigar-maps.png",
    gallery: [
      { src: "images/cigar-maps.png", caption: "Browse nearby cigar lounges on an interactive Leaflet map." },
      { src: "images/cigar-maps-2.png", caption: "Track your personal collection and log tasting reviews." },
    ],
    video: "",
    live: "https://cigarmapsclaude-production.up.railway.app",
    code: "",
    status: "In progress",
  },
  {
    slug: "bootleggers",
    title: "Bootleggers",
    category: "Passion Projects",
    description:
      "A real-time multiplayer strategy game (a Lords of Vegas build) with an authoritative Node/TypeScript server, a four-tier bot AI with EV-driven scoring, and a regression harness running 1,000+ simulated games with 25,000+ invariants.",
    long: [
      "Bootleggers is a browser-based, real-time multiplayer strategy game — a full build of the tabletop game Lords of Vegas — with a Phaser 3 frontend and an authoritative Node/TypeScript + Socket.io backend, deployed on Railway.",
      "I designed a normalized PostgreSQL schema with a hand-rolled idempotent migration runner, and authored complex SQL for Google OAuth upsert, 24-column lifetime stat aggregation, and streak tracking.",
      "The standout is the AI: a four-tier bot (Easy–Expert) with EV-driven scoring across builds, sprawls, gambles, and trades. Expert bots evaluate ~30 candidate moves per turn using forward-thinking heuristics, color-card probability modeling, and adversarial leader-targeting, and a trade-evaluation engine simulates post-trade ownership to reject lopsided swaps.",
      "To keep it correct, I wrote a regression harness that runs 1,000+ simulated games per pass against 25,000+ behavioral invariants, catching strategy and state-machine bugs before they ship.",
    ],
    tags: ["TypeScript", "Socket.IO", "Node", "Phaser", "PostgreSQL"],
    tools: ["TypeScript", "Node.js", "Socket.io", "Phaser 3", "Three.js", "PostgreSQL", "Google OAuth", "Railway"],
    image: "images/bootleggers-title.png",
    gallery: [
      { src: "images/bootleggers-title.png", caption: "The landing screen — start a game, read the rules, or watch a match." },
      { src: "images/bootleggers.png", caption: "The main board: build, sprawl, and gamble across the Vegas strip." },
      { src: "images/bootleggers-dice.png", caption: "Rolling the bootlegging dice to resolve a play." },
      { src: "images/bootleggers-draw.png", caption: "Drawing a card on your turn." },
      { src: "images/bootleggers-roll.png", caption: "A roll resolves — win or lose big on the stakes." },
      { src: "images/bootleggers-stats.png", caption: "Lifetime player stats: 24 columns of aggregated career numbers." },
      { src: "images/bootleggers-gameover.png", caption: "Game over — a victory-points-over-time graph and the final standings." },
    ],
    video: "",
    live: "https://bootleggers.up.railway.app",
    code: "",
    featured: true,
  },
  {
    slug: "betrayal",
    title: "Betrayal at House on the Hill",
    category: "Passion Projects",
    description:
      "An online multiplayer engine for Betrayal at House on the Hill, built on a server-authoritative rules architecture with a framework-free HTML5 Canvas client and procedural audio.",
    long: [
      "An online multiplayer engine for the board game Betrayal at House on the Hill. It uses a server-authoritative rules architecture — all game logic is validated on the server — with a framework-free HTML5 Canvas client and procedural audio.",
      "Rules are data-driven and live in JSON, and it ships with bots and a test suite. Engine, netcode, and UI are working; game content is still being filled in.",
    ],
    tags: ["Node", "WebSocket", "Vanilla JS", "Canvas"],
    tools: ["Node.js", "WebSocket (ws)", "Vanilla JS (ES modules)", "HTML5 Canvas", "Web Audio API"],
    image: "images/betrayal-lobby.png",
    gallery: [
      { src: "images/betrayal.png", caption: "Room placement — rotate and place newly discovered rooms as you explore the house." },
      { src: "images/betrayal-lobby.png", caption: "The lobby: share a room code and each player claims an explorer." },
      { src: "images/betrayal-event.png", caption: "Resolving an event card, with the live game log on the right." },
    ],
    video: "",
    live: "https://betrayal-production-c191.up.railway.app",
    code: "",
    status: "In progress",
  },
  {
    slug: "spot-kick",
    title: "Spot Kick",
    category: "Passion Projects",
    description:
      "A two-player penalty-shootout party game that runs as a Discord Activity, with momentum-powered special abilities. Playable versus a bot, pass-and-play, or online in real time over WebSockets.",
    long: [
      "Spot Kick is a two-player penalty-shootout party game that runs as a Discord Activity. Each kick you're dealt a hand of powers — place your shot, guess the dive, and spend Momentum for special abilities; five kicks each, most goals wins.",
      "It's playable versus a bot, pass-and-play locally, or online in real time over WebSockets, with full Discord Activity integration.",
    ],
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    tools: ["JavaScript", "Node.js", "WebSockets (ws)", "@discord/embedded-app-sdk", "esbuild"],
    image: "images/spotkick.png",
    gallery: [
      { src: "images/spotkick.png", caption: "Choose your baller — each has a different special ability." },
      { src: "images/spotkick-kick.png", caption: "Take your kick: place the shot and spend Momentum on powers." },
      { src: "images/spotkick-goal.png", caption: "Goal! Five kicks each — most goals wins." },
    ],
    video: "",
    live: "https://discord-soccer-production.up.railway.app",
    code: "",
  },
  {
    slug: "best-of-5",
    title: "Best of 5",
    category: "Passion Projects",
    description:
      "A best-of-five Discord duel that rotates through Connect 4, Checkers, Battleship, Chess, and mini golf — first to three games wins. Full Discord Activity integration.",
    long: [
      "Best of 5 is a competitive Discord duel that rotates through five mini-games — Connect 4, Checkers, Battleship, Chess, and mini golf — first to three wins.",
      "It runs as a full Discord Activity with real-time WebSocket play.",
    ],
    tags: ["JavaScript", "Node", "WebSockets", "Discord SDK"],
    tools: ["JavaScript", "Node.js", "WebSockets (ws)", "@discord/embedded-app-sdk", "esbuild"],
    image: "images/bestof5.png",
    gallery: [
      { src: "images/bestof5.png", caption: "A best-of-five duel rotating through Connect 4, Checkers, Battleship, Chess, and mini golf." },
    ],
    video: "",
    live: "https://bestof5-production-54ef.up.railway.app",
    code: "",
  },
];
