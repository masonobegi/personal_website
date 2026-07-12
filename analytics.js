/* =========================================================================
   Cloudflare Web Analytics — privacy-first, no cookies, no consent banner.

   To activate:
   1. Cloudflare dashboard → your account → Analytics & Logs → Web Analytics.
   2. Add masonobegi.com (or, since the site is proxied through Cloudflare,
      just toggle it on for the zone — Cloudflare can auto-inject it with no
      code at all, in which case you can ignore this file).
   3. Copy the token it gives you and paste it into TOKEN below.

   With an empty TOKEN this file does nothing, so it's safe to ship as-is.
   ========================================================================= */
(function () {
  var TOKEN = ""; // ← paste your Cloudflare Web Analytics token here
  if (!TOKEN) return;
  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", '{"token":"' + TOKEN + '"}');
  document.head.appendChild(s);
})();
