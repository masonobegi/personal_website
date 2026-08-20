/* =========================================================================
   Work-With-Me landing page behavior:
   - wires every "Book a call" button to your booking link
   - renders your client work from projects-data.js
   - renders reviews from reviews-data.js
   ========================================================================= */

/* ↓↓↓ MASON: paste your Calendly / Google Bookings link here ↓↓↓
   e.g. "https://calendly.com/mason-obegi/intro-call"
   Until you set this, every "Book a call" button scrolls to the contact
   section at the bottom of the page (which shows your email + phone). */
var BOOKING_URL = "";

function initBookingCtas() {
  var hasBooking = BOOKING_URL && BOOKING_URL.indexOf("http") === 0;
  document.querySelectorAll(".book-cta").forEach(function (a) {
    if (hasBooking) {
      a.setAttribute("href", BOOKING_URL);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    } else {
      a.setAttribute("href", "#lets-talk");
    }
    a.addEventListener("click", function () {
      // Fires a GA event so you can mark "book_call_click" as a conversion.
      if (typeof window.gtag === "function") {
        window.gtag("event", "book_call_click", { location: a.textContent.trim() });
      }
    });
  });
}

function renderClientWork() {
  var grid = document.getElementById("lp-work-grid");
  if (!grid || typeof PROJECTS === "undefined") return;
  var clients = PROJECTS.filter(function (p) { return p.category === "Client Work"; });
  grid.innerHTML = clients.map(function (p) {
    var img = p.image
      ? '<img src="' + p.image + '" alt="' + p.title + '" loading="lazy" onerror="this.remove()" />'
      : "";
    return (
      '<a class="lp-work-card" href="project.html?id=' + p.slug + '">' +
        '<div class="lp-work-thumb">' + img + "</div>" +
        '<div class="lp-work-body">' +
          "<h3>" + p.title + "</h3>" +
          "<p>" + (p.category || "") + "</p>" +
        "</div>" +
      "</a>"
    );
  }).join("");
}

function stars(n) {
  n = Math.max(0, Math.min(5, parseInt(n, 10) || 5));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

function renderReviews() {
  var grid = document.getElementById("lp-reviews-grid");
  if (!grid || typeof REVIEWS === "undefined") return;
  grid.innerHTML = REVIEWS.map(function (r) {
    var isPh = r.placeholder === true;
    var by = "<b>" + (r.name || "") + "</b>" +
             (r.business ? ' <span>· ' + r.business + "</span>" : "");
    var src = r.source
      ? '<span class="lp-review-src">' +
          (r.link
            ? '<a href="' + r.link + '" target="_blank" rel="noopener">via ' + r.source + " ↗</a>"
            : "via " + r.source) +
        "</span>"
      : "";
    return (
      '<figure class="lp-review' + (isPh ? " is-placeholder" : "") + '">' +
        (isPh ? '<span class="lp-review-example">Example — replace in reviews-data.js</span>' : "") +
        '<div class="lp-stars" aria-label="' + (r.rating || 5) + ' out of 5">' + stars(r.rating) + "</div>" +
        '<blockquote class="lp-quote">“' + (r.quote || "") + "”</blockquote>" +
        '<figcaption class="lp-review-by">' + by + src + "</figcaption>" +
      "</figure>"
    );
  }).join("");
}

function setYear() {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", function () {
  if (typeof initTheme === "function") initTheme();
  if (typeof initCopyEmail === "function") initCopyEmail();
  initBookingCtas();
  renderClientWork();
  renderReviews();
  setYear();
});
