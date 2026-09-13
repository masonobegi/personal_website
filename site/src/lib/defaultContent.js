import { site } from "@/lib/site";

// -----------------------------------------------------------------------------
//  DEFAULT SITE CONTENT — masonobegi.com
//  Every field here is editable in the admin dashboard (Content tab). These are
//  the fallback / starting values; admin edits are stored in the database and
//  merged over these on read. Projects, Library articles, hidden Pages, and
//  Landing pages live in their own stores (not here).
//  NOTE: colors, fonts, and layout are intentionally NOT editable — only real
//  information (text, links, and photos).
// -----------------------------------------------------------------------------

export const defaultContent = {
  // --- Global / identity ---
  siteName: site.name,
  role: site.tagline,
  tagline: "Software engineer building production apps, real-time games, and websites for real clients.",
  phone: site.phone,
  email: site.email,
  location: site.location,
  githubUrl: site.githubUrl,
  linkedinUrl: site.linkedinUrl,
  resumeUrl: site.resumeUrl,
  heroImage: "/images/hero.jpg", // main cover photo — swappable from the admin (Content tab)

  // --- Search engine listing ---
  seo: {
    title: "Mason Obegi — Software Engineer",
    description:
      "Mason Obegi — software engineer building real-time multiplayer games, full-stack apps, and websites for real clients.",
    pages: {
      about: {
        title: "About — Mason Obegi",
        description:
          "Software engineer and Washington State University Data Analytics graduate. Full-stack, data, and ML — from idea to shipped.",
      },
      projects: {
        title: "Projects — Mason Obegi",
        description:
          "Production client sites, published apps, and real-time multiplayer games built by Mason Obegi.",
      },
      hobbies: {
        title: "Hobbies — Mason Obegi",
        description: "LEGO builds, lifting, and chess — a look outside the code.",
      },
      hire: {
        title: "Custom Websites for Local Businesses — Mason Obegi",
        description:
          "Real payments, online booking, and a dashboard you run yourself. Built by a software engineer, not a template.",
      },
      library: {
        title: "Writing & Notes — Mason Obegi",
        description: "Articles and notes on software, projects, and things worth writing down.",
      },
      contact: {
        title: "Contact — Mason Obegi",
        description: "Get in touch with Mason Obegi.",
      },
      privacy: {
        title: "Privacy Policy — Mason Obegi",
        description: "What this website collects, how it is used, and the choices you have.",
      },
      terms: {
        title: "Terms of Service — Mason Obegi",
        description: "The terms that apply to using this website.",
      },
    },
  },

  // --- Advertising & measurement (each tag loads only when its ID is set) ---
  tracking: {
    ga4Id: "",
    googleAdsId: "",
    googleAdsLeadLabel: "",
    linkedinPartnerId: "",
    linkedinLeadConversionId: "",
    metaPixelId: "",
  },

  // --- Home page ---
  home: {
    heroTitle: "Hi, I'm Mason Obegi.",
    heroRole: "Software Engineer",
    heroBody:
      "I take software from idea to shipped — frontend, backend, data, and deployment. Not a little of everything, but complete, production apps that real people and businesses use every day.",
    featuredTitle: "Featured Projects",
    aboutTitle: "About",
    aboutBody:
      "I'm a software engineer and Washington State University Data Analytics graduate, and a Quality Engineer at HP — I build internal web tools, test-automation systems, and data infrastructure by day, and ship complete products for real clients and myself by night.",
    aboutBody2:
      "I work across the stack in TypeScript, React, Node, and Next.js, with a data and ML background in Python and R.",
    experienceTitle: "Experience",
    contactTitle: "Get In Touch",
    contactBody: "I'm currently open to new opportunities — feel free to reach out.",
  },

  // --- About page ---
  about: {
    heroTitle: "About",
    body: [
      "I'm a software engineer and Washington State University Data Analytics graduate (3.62 GPA, minors in Mathematics and Criminal Justice). By day I'm a Quality Engineer at HP, where I build internal web tools and test-automation programs, rebuild data infrastructure, and turn ambiguous business requirements into reliable tooling and reporting.",
      "Outside of work I ship complete products end to end — production websites for real clients, real-time multiplayer games with authoritative servers and bot AI, a basketball roguelike published on the App Store, and a full-stack cigar-collection PWA with native mobile builds. They're for fun, but they're where I take on the hardest systems problems.",
    ],
    skillsTitle: "Technical Skills",
    educationTitle: "Education",
  },

  // --- Experience (Home shows the first entry; About shows all) ---
  experience: [
    {
      company: "HP",
      title: "Quality Engineer III",
      dates: "Oct 2025 – Present",
      bullets: [
        "Design and develop internal web applications to host automation tooling, giving testers a central place to launch, monitor, and share programs across the QE org.",
        "Build automation systems that replace repetitive manual testing processes, improving coverage and freeing engineering time.",
        "Rebuilt a degraded Power BI reporting database from the ground up, restoring reliable team-wide reporting on test results and product metrics.",
      ],
    },
    {
      company: "HP",
      title: "Test Specialist I",
      dates: "Feb 2025 – Oct 2025",
      bullets: [
        "Automated enterprise-level reporting pipelines using Python and R, improving efficiency, accuracy, and consistency across stakeholder workflows.",
        "Built time series forecasts and statistical models in R to support data-driven planning and decision-making.",
        "Developed prompt-engineering workflows for internal LLM tools and built dashboards and Tkinter desktop applications for internal stakeholders.",
      ],
    },
    {
      company: "Molecular Testing Labs",
      title: "Lab Automation Engineering Intern",
      dates: "Jun 2023 – Apr 2024",
      bullets: [
        "Developed computer vision pipelines using OpenCV and PIL.",
        "Built machine learning models using TensorFlow and Keras; presented findings to executive leadership.",
        "Created KPI dashboards using R Shiny and designed components in Autodesk Fusion 360.",
      ],
    },
  ],

  // --- Skills (About page) ---
  skills: [
    { group: "Languages", items: "Python, TypeScript, JavaScript, R, SQL, Java, C++" },
    { group: "Frontend", items: "React, Next.js, Tailwind CSS, Phaser 3" },
    { group: "Backend & Data", items: "Node.js, PostgreSQL, Prisma, Socket.io, REST APIs, Streamlit, Tkinter, Shiny" },
    { group: "ML & Analytics", items: "TensorFlow, Keras, PyTorch, OpenCV, Pandas, Scikit-Learn, Forecasting, Tableau, Power BI" },
    { group: "Tools", items: "Git, GitHub, Railway, Cloudflare, VS Code, Autodesk Fusion 360" },
  ],

  // --- Education (About page) ---
  education: {
    school: "Washington State University",
    degree: "B.S. Data Analytics",
    details: "Minor in Mathematics · Minor in Criminal Justice · GPA 3.62 · 2024 Outstanding Data Analytics Student Award",
    year: "2024",
  },

  // --- Projects page header (projects themselves live in the Projects tab) ---
  projectsPage: {
    heroTitle: "Projects",
    heroSub:
      "Production client sites, published apps, and the passion projects where I take on the hardest systems problems. Click any project for the full write-up.",
  },

  // --- Hobbies page ---
  hobbies: {
    heroTitle: "Hobbies",
    heroSub: "A look outside the code.",
    legoTitle: "LEGO",
    legoBody:
      "I build detailed modular sets — the kind with tens of thousands of pieces and a real sense of craft. It scratches the same itch as engineering: patience, precision, and a finished thing you can stand back and look at.",
    // The LEGO gallery — upload and reorder photos from the admin (Hobbies section).
    legoPhotos: [
      { src: "/images/lego-thumb.jpg", caption: "LEGO modular Jazz Club" },
      { src: "/images/starwars-thumb.jpg", caption: "LEGO Star Wars build" },
    ],
    liftingTitle: "Lifting",
    liftingBody:
      "Lifting gets me out of my head. Progress is slow, honest, and entirely on you — a good reminder that getting good at anything is just showing up and adding a little each time.",
    liftingVideoUrl: "https://www.youtube.com/shorts/E9dXasZ5ciQ",
    liftingThumb: "/images/lifting-thumb.jpg",
    chessTitle: "Chess",
    chessBody:
      "I play chess online — mostly rapid. It's the cheapest way I know to practice thinking a few moves ahead and owning my mistakes.",
    chessUrl: "https://www.chess.com/member/obg2001",
  },

  // --- Hire page (the client-facing landing page) ---
  hire: {
    eyebrow: "Custom websites for local businesses",
    heroTitle: "A website you actually own — not another template.",
    heroBody:
      "I build custom websites for local businesses and professional practices — real online payments, booking, and a dashboard you run yourself, with Google-ready SEO. Built by an engineer, priced for a small business.",
    heroNote: "Serving Camas, Vancouver & the greater Portland metro — and remote.",
    trustLabel: "Trusted to build for",
    trustNames: "The Pooch Pit, OBGillustrator, Oswego Legacy Partners, The Jeweler",
    pillarsEyebrow: "Why this, not a template",
    pillarsTitle: "More than a pretty page.",
    pillars: [
      {
        title: "A site you control",
        body: "Every site comes with a simple, no-code dashboard so you can edit text, photos, prices, and hours yourself — instantly, no dev calls.",
      },
      {
        title: "Real features, done right",
        body: "Stripe payments and deposits, online booking that prevents double-bookings, contact forms that never lose a message, and SEO built to show up on Google.",
      },
      {
        title: "Built by an engineer",
        body: "You work directly with the person writing the code — no agency markup, no offshore handoff. Fast, secure, and yours to keep, on your own domain and hosting.",
      },
    ],
    pricingEyebrow: "Packages",
    pricingTitle: "Straightforward pricing.",
    pricingSub: "Pick a starting point — every project is quoted individually after a quick call.",
    packages: [
      {
        name: "Starter Site",
        price: "Starting at $750",
        for: "For a business that needs a clean, credible presence online.",
        features: ["3–5 page custom marketing site", "Mobile & tablet responsive", "Contact form to your inbox", "Local SEO & Google-ready setup", "Your domain, your hosting"],
        featured: false,
      },
      {
        name: "Business Site",
        price: "Starting at $2,500",
        for: "For a business that needs to take bookings or sell online.",
        features: ["Everything in Starter", "Online booking or store (Stripe)", "No-code owner dashboard", "Deposits, payments & email notifications", "Photo galleries & content you manage"],
        featured: true,
      },
      {
        name: "Custom Platform",
        price: "Let's talk",
        for: "For a bigger build — multiple features, integrations, or scale.",
        features: ["Fully custom features", "Multi-section content platforms", "Integrations (payments, calendars, email)", "Advanced SEO & analytics", "Like the sites in my portfolio"],
        featured: false,
      },
    ],
    carePlan: "Care Plan — $250/year",
    carePlanBody:
      "Hosting, domain & SSL, backups, updates, and small edits handled for you — just $250 a year. Optional, and it keeps your site fast, secure, and current.",
    priceNote: "Prices are starting points and depend on scope — you'll get a fixed quote before any work begins.",
    processEyebrow: "How it works",
    processTitle: "Simple, no-surprises process.",
    process: [
      { n: "01", title: "Free call", body: "A quick 20 minutes to understand your business, goals, and what the site needs to do. You get a clear quote and timeline." },
      { n: "02", title: "Design", body: "I design a site around your brand and your customers — you review and shape it before a line of production code is written." },
      { n: "03", title: "Build", body: "I build the real thing — payments, booking, dashboard, SEO — and you see progress on a live preview link the whole way." },
      { n: "04", title: "Launch & care", body: "We go live on your domain, I show you the dashboard, and — if you want — I keep it running with a Care Plan." },
    ],
    workEyebrow: "Recent work",
    workTitle: "Real sites, real businesses.",
    workSub: "A few of the client sites I've designed, built, and shipped — click any to see the full write-up.",
    faqEyebrow: "Questions",
    faqTitle: "Good to know.",
    faq: [
      { q: "How long does a website take?", a: "Most Starter and Business sites launch in 2–4 weeks, depending on scope and how quickly you get me content. Larger custom platforms take longer — you'll get a timeline on our first call." },
      { q: "Can I update the site myself?", a: "Yes — that's the point. Every Business and Custom build comes with a simple dashboard where you edit text, photos, pricing, and hours yourself, with no code and no waiting on me." },
      { q: "Do I own the site and my domain?", a: "Completely. The site is yours, on your own domain and hosting. There's no lock-in — if you ever want to leave, everything goes with you." },
      { q: "What about payments and booking?", a: "I set up real payment processing through Stripe (deposits, checkout, tipping) and booking systems that prevent double-bookings." },
      { q: "What do you charge to maintain it?", a: "The site works on its own after launch. If you'd rather not think about hosting, updates, and small tweaks, the optional Care Plan ($250/year) covers all of it." },
    ],
    ctaTitle: "Let's build something you own.",
    ctaBody: "Book a free 20-minute call — no pressure, no jargon. We'll figure out what your business needs and I'll give you a clear quote.",
    bookingUrl: "",
  },

  // --- Contact page ---
  contact: {
    heroTitle: "Get In Touch",
    heroSub: "Send a message below, or reach me directly.",
    noteHeading: "Send a message",
    noteBody: "Questions, opportunities, or project ideas — I read everything.",
  },

  // --- Privacy policy ---
  privacy: {
    heroTitle: "Privacy Policy",
    heroSub: "What this website collects, how it is used, and the choices you have.",
    body: "*Last updated: September 13, 2026*\n\nThis website (masonobegi.com) is the personal portfolio of Mason Obegi. This policy explains the limited information the site collects and how it is handled.\n\n**Information I collect**\n\nThe only personal information this site collects is what you voluntarily submit through a form on the site: your name, email address, and message. The site does not use advertising or third-party tracking cookies unless analytics is enabled, in which case it collects standard, non-identifying usage data.\n\n**How I use it**\n\nI use the information you submit solely to read and respond to your message. I don't sell, rent, or share it for marketing purposes.\n\n**Hosting**\n\nThe site is hosted on Railway and served through Cloudflare, which may process standard technical data (such as IP address and browser type) in server logs for security and reliability.\n\n**Data retention**\n\nMessages you send are kept only as long as needed to correspond with you. You can ask me to delete your message at any time by emailing me.\n\n**External links**\n\nThis site links to third-party platforms (GitHub, LinkedIn, Chess.com, YouTube, and live client sites). Their privacy practices are their own.\n\n**Changes**\n\nI may update this policy from time to time; the date above will reflect any changes.\n\n**Contact**\n\nQuestions? Email me using the address in the footer.",
  },

  // --- Terms of service ---
  terms: {
    heroTitle: "Terms of Service",
    heroSub: "The terms that apply when you use this website.",
    body: "*Last updated: September 13, 2026*\n\nmasonobegi.com is a personal portfolio website owned and operated by Mason Obegi. By using this site, you agree to these terms.\n\n**Use of the site**\n\nYou may browse this site for personal, informational purposes. Please don't attempt to disrupt, attack, or gain unauthorized access to the site or its underlying services.\n\n**Intellectual property**\n\nThe content on this site — text, design, code, and original images — is owned by Mason Obegi unless otherwise noted, and may not be reproduced or reused without permission. Project screenshots may include third-party trademarks (such as client brands) that belong to their respective owners.\n\n**Third-party links**\n\nThis site links to external websites and services I don't control. I'm not responsible for their content, policies, or availability.\n\n**Disclaimer**\n\nThis site is provided \"as is,\" without warranties of any kind. I make no guarantee that it will be error-free or continuously available.\n\n**Changes**\n\nI may update these terms at any time; continued use of the site means you accept the current version.\n\n**Contact**\n\nQuestions? Email me using the address in the footer.",
  },

  // --- Footer ---
  footer: {
    tagline: "Software engineer — full-stack apps, real-time games, and websites for real clients.",
  },
};
