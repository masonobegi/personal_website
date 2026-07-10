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
  const raw = (p.gallery && p.gallery.length ? p.gallery : [p.image]).filter(Boolean);
  // Gallery entries may be a plain "path" or { src, caption }.
  const shots = raw.map((s) => (typeof s === "string" ? { src: s, caption: "" } : s));
  const vid = p.video
    ? `<div class="detail-video-wrap"><video class="detail-video" controls preload="metadata" src="${p.video}"></video></div>`
    : "";
  if (!shots.length && !vid) return "";

  const first = shots[0] || { src: "", caption: "" };
  const main = shots.length
    ? `<figure class="gallery-main">
         <img id="gallery-main-img" src="${first.src}" alt="${p.title} screenshot" />
         <span class="gallery-zoom" aria-hidden="true">Click to enlarge</span>
       </figure>`
    : "";

  const thumbs =
    shots.length > 1
      ? `<div class="gallery-thumbs">${shots
          .map(
            (s, i) => `
          <button type="button" class="gallery-thumb${i === 0 ? " is-active" : ""}" data-src="${s.src}" data-caption="${(s.caption || "").replace(/"/g, "&quot;")}" aria-label="View screenshot ${i + 1}">
            <img src="${s.src}" alt="" loading="lazy" />
          </button>`
          )
          .join("")}</div>`
      : "";

  const caption = shots.some((s) => s.caption)
    ? `<p class="gallery-caption" id="gallery-caption">${first.caption || ""}</p>`
    : "";

  return `
    ${vid}
    <div class="detail-gallery${shots.length > 1 ? "" : " is-single"}">
      ${main}
      ${thumbs}
    </div>
    ${caption}
    <div class="lightbox" id="lightbox" aria-hidden="true">
      <button type="button" class="lightbox-close" aria-label="Close">&times;</button>
      <img class="lightbox-img" id="lightbox-img" src="" alt="" />
    </div>`;
}

// Thumbnail rail swaps the main image; clicking the main image opens a lightbox.
function initGallery() {
  const main = document.getElementById("gallery-main-img");
  if (!main) return;

  const thumbs = Array.from(document.querySelectorAll(".gallery-thumb"));
  const capEl = document.getElementById("gallery-caption");
  thumbs.forEach((btn) => {
    btn.addEventListener("click", () => {
      main.src = btn.getAttribute("data-src");
      if (capEl) capEl.textContent = btn.getAttribute("data-caption") || "";
      thumbs.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const open = () => {
    lbImg.src = main.src;
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
  };
  const close = () => {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
  };
  main.addEventListener("click", open);
  lb.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Match the thumbnail rail height to the main image (desktop side-rail only).
  const rail = document.querySelector(".gallery-thumbs");
  const sync = () => {
    if (!rail) return;
    if (window.innerWidth > 760) {
      const h = main.clientHeight;
      if (h) rail.style.maxHeight = h + "px";
    } else {
      rail.style.maxHeight = "";
    }
  };
  if (main.complete) sync();
  main.addEventListener("load", sync);
  window.addEventListener("resize", sync);
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
    ? `<a class="detail-live" href="${p.live}" target="_blank" rel="noopener">${p.liveLabel || "Visit live site ↗"}</a>`
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

  initGallery();
}

render();
