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
  if (SOCIALS.email)
    items.push(`<a href="#" class="copy-email" data-email="${SOCIALS.email}">Email →</a>`);
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

  initTheme();
  initCopyEmail();
}

render();
