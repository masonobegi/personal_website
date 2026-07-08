/* =========================================================================
   PROJECT DETAIL PAGE. Reads ?id=SLUG from the URL and renders the matching
   project from projects-data.js. Shared theme/copy behavior in theme.js.
   ========================================================================= */

function getProject() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return PROJECTS.find((p) => p.slug === id) || null;
}

function statusPill(p) {
  const bits = [];
  if (p.featured) bits.push(`<span class="pill pill-featured">Featured</span>`);
  if (p.status) bits.push(`<span class="pill pill-status">${p.status}</span>`);
  return bits.length ? `<div class="detail-pills">${bits.join("")}</div>` : "";
}

function galleryHtml(p) {
  const shots = (p.gallery && p.gallery.length ? p.gallery : [p.image]).filter(Boolean);
  const vid = p.video
    ? `<video class="detail-video" controls preload="metadata" src="${p.video}"></video>`
    : "";
  const imgs = shots
    .map(
      (src) => `
      <figure class="shot">
        <img src="${src}" alt="${p.title} screenshot" loading="lazy" onerror="this.closest('.shot').remove()" />
      </figure>`
    )
    .join("");
  if (!imgs && !vid) return "";
  return `
    <div class="detail-gallery">
      ${vid}
      ${imgs}
    </div>`;
}

function render() {
  initTheme();
  initCopyEmail();

  const el = document.getElementById("detail");
  const p = getProject();

  if (!p) {
    document.title = "Project not found — Mason Obegi";
    el.innerHTML = `
      <a class="back-link" href="index.html#projects">← Back to projects</a>
      <h1 class="detail-title">Project not found</h1>
      <p class="detail-lead">That project doesn't exist. Head back to <a href="index.html#projects">all projects</a>.</p>`;
    return;
  }

  document.title = `${p.title} — Mason Obegi`;

  const paras = (p.long && p.long.length ? p.long : [p.description])
    .map((t) => `<p>${t}</p>`)
    .join("");

  const tools = (p.tools && p.tools.length ? p.tools : p.tags || [])
    .map((t) => `<span>${t}</span>`)
    .join("");

  const liveLink = p.live
    ? `<a class="detail-live" href="${p.live}" target="_blank" rel="noopener">Visit live site ↗</a>`
    : "";
  const codeLink = p.code
    ? `<a class="detail-live" href="${p.code}" target="_blank" rel="noopener">View code ↗</a>`
    : "";

  el.innerHTML = `
    <a class="back-link" href="index.html#projects">← Back to projects</a>

    <header class="detail-head">
      <div class="detail-head-top">
        <p class="detail-cat">${p.category}</p>
        ${statusPill(p)}
      </div>
      <h1 class="detail-title">${p.title}</h1>
      <div class="detail-links">${liveLink}${codeLink}</div>
    </header>

    ${galleryHtml(p)}

    <div class="detail-columns">
      <div class="detail-body">${paras}</div>
      <aside class="detail-aside">
        <h2 class="aside-title">Built with</h2>
        <div class="tool-list">${tools}</div>
      </aside>
    </div>`;
}

render();
