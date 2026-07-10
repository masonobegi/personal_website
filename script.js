/* =========================================================================
   HOME PAGE logic. Project data lives in projects-data.js (loaded first);
   shared theme/copy behavior lives in theme.js.
   ========================================================================= */

// --- Your links (edit these) ---------------------------------------------
const SOCIALS = {
  github:   "https://github.com/masonobegi?tab=repositories",
  linkedin: "https://www.linkedin.com/in/mason-obegi-5a963b1ba/",
  email:    "mobegibusiness@gmail.com",
};

function socialsHtml() {
  const items = [];
  if (SOCIALS.github)
    items.push(`<a href="${SOCIALS.github}" target="_blank" rel="noopener">GitHub →</a>`);
  if (SOCIALS.linkedin)
    items.push(`<a href="${SOCIALS.linkedin}" target="_blank" rel="noopener">LinkedIn →</a>`);
  return items.join("");
}

function tagsHtml(tags) {
  return `<p class="card-tags">${(tags || []).join(", ")}</p>`;
}

function thumbHtml(p, showFeatured) {
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

// Every card links to its own detail page (project.html?id=SLUG).
function card(p, showFeatured) {
  const cls = `card card-linked${showFeatured && p.featured ? " is-featured" : ""}`;
  return `
    <a class="${cls}" href="project.html?id=${p.slug}">
      ${thumbHtml(p, showFeatured)}
      <div class="card-body">
        <div class="card-title">
          <h3>${p.title}</h3>
          ${badgesHtml(p)}
        </div>
        <p class="desc">${p.description}</p>
        ${tagsHtml(p.tags)}
      </div>
    </a>`;
}

function render() {
  // Social links (hero + contact page)
  [document.getElementById("socials"), document.getElementById("contact-socials")].forEach(
    (el) => { if (el) el.innerHTML = socialsHtml(); }
  );

  // Featured grid (shown first, highlighted)
  const featured = PROJECTS.filter((p) => p.featured);
  document.getElementById("featured").innerHTML =
    featured.map((p) => card(p, true)).join("");

  // Grouped grid (ALL projects, including featured), in CATEGORY_ORDER.
  const groupsEl = document.getElementById("project-groups");
  let html = "";

  // Lead with a Featured group so best work is clear on the Projects page too.
  if (featured.length) {
    html += `
      <div class="project-group">
        <h3 class="group-title">Featured</h3>
        <div class="card-grid">${featured.map((p) => card(p, true)).join("")}</div>
      </div>`;
  }

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

  initTheme();
  initCopyEmail();
  initTabs();
  initContactForm();
  initHobbyCarousel();
  initHobbyLightbox();
}

// --- LEGO carousel: prev/next arrows + dots ---------------------------------
function initHobbyCarousel() {
  document.querySelectorAll(".hobby-carousel").forEach((car) => {
    const slides = Array.from(car.querySelectorAll(".carousel-slide"));
    if (slides.length < 2) return;
    const dotsWrap = car.querySelector(".carousel-dots");
    let idx = 0;

    const dots = slides.map((_, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "carousel-dot" + (i === 0 ? " is-active" : "");
      d.setAttribute("aria-label", "Show build " + (i + 1));
      d.addEventListener("click", () => go(i));
      if (dotsWrap) dotsWrap.appendChild(d);
      return d;
    });

    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("is-active", k === idx));
      dots.forEach((d, k) => d.classList.toggle("is-active", k === idx));
    }

    car.querySelector(".carousel-prev").addEventListener("click", () => go(idx - 1));
    car.querySelector(".carousel-next").addEventListener("click", () => go(idx + 1));

    // Arrow-key navigation — only when the carousel is visible, the lightbox is
    // closed, and you're not typing in a field.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!car.offsetParent) return; // carousel not on the visible tab
      const lb = document.getElementById("hobby-lightbox");
      if (lb && lb.classList.contains("open")) return;
      go(e.key === "ArrowLeft" ? idx - 1 : idx + 1);
      e.preventDefault();
    });
  });
}

// --- Click-to-enlarge for hobby photos, with prev/next through a set ---------
function initHobbyLightbox() {
  const imgs = Array.from(document.querySelectorAll("img[data-full]"));
  const lb = document.getElementById("hobby-lightbox");
  const lbImg = document.getElementById("hobby-lightbox-img");
  const prevBtn = document.getElementById("hobby-lb-prev");
  const nextBtn = document.getElementById("hobby-lb-next");
  const closeBtn = document.getElementById("hobby-lightbox-close");
  if (!imgs.length || !lb || !lbImg) return;

  let group = [];
  let gi = 0;

  const render = () => {
    const im = group[gi];
    lbImg.src = im.getAttribute("data-full") || im.src;
    lbImg.alt = im.alt || "";
    const many = group.length > 1;
    if (prevBtn) prevBtn.style.display = many ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = many ? "flex" : "none";
  };
  const nav = (d) => {
    if (group.length < 2) return;
    gi = (gi + d + group.length) % group.length;
    render();
  };
  const close = () => {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    lbImg.src = "";
    group = [];
  };
  const open = (im) => {
    // If the image belongs to a carousel, page through that whole set.
    const car = im.closest(".hobby-carousel");
    group = car ? Array.from(car.querySelectorAll("img[data-full]")) : [im];
    gi = Math.max(0, group.indexOf(im));
    render();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
  };

  imgs.forEach((im) => im.addEventListener("click", () => open(im)));

  // Clicking the backdrop closes; clicking a control does not.
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target === lbImg) close(); });
  if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); nav(-1); });
  if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); nav(1); });
  if (closeBtn) closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });

  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") { nav(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { nav(1); e.preventDefault(); }
  });
}

// --- Tabbed navigation: show one "page" section at a time --------------------
function initTabs() {
  const pages = Array.from(document.querySelectorAll(".page"));
  if (!pages.length) return;
  const navLinks = Array.from(document.querySelectorAll(".nav-links a[data-tab]"));

  function show(tab) {
    if (!document.getElementById("page-" + tab)) tab = "home";
    pages.forEach((p) => { p.hidden = p.id !== "page-" + tab; });
    navLinks.forEach((a) =>
      a.classList.toggle("is-active", a.getAttribute("data-tab") === tab)
    );
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", () =>
    show((location.hash || "#home").slice(1))
  );
  show((location.hash || "#home").slice(1));
}

// --- Contact form (Web3Forms — no backend needed) ----------------------------
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = document.getElementById("form-status");
  const setStatus = (msg, cls) => {
    status.textContent = msg;
    status.className = "form-status" + (cls ? " " + cls : "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = form.querySelector('input[name="access_key"]').value;
    if (key.indexOf("YOUR_") === 0) {
      setStatus(
        "The form isn't wired up yet — email me directly at mobegibusiness@gmail.com.",
        "is-error"
      );
      return;
    }
    setStatus("Sending…", "");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: new FormData(form),
      });
      const json = await res.json();
      if (json.success) {
        form.reset();
        setStatus("Thanks — your message is on its way. I'll get back to you soon.", "is-success");
      } else {
        throw new Error(json.message || "failed");
      }
    } catch (err) {
      setStatus(
        "Something went wrong. Please email me directly at mobegibusiness@gmail.com.",
        "is-error"
      );
    }
  });
}

render();
