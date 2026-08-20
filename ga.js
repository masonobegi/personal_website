/* =========================================================================
   Google Analytics 4 — conversion + campaign tracking for the Hire page.
   INERT until you add your Measurement ID, so nothing loads until you're ready.

   Setup (5 minutes, one time):
     1. Go to analytics.google.com → Admin → Create Property.
     2. Add a "Web" data stream for masonobegi.com.
     3. Copy the Measurement ID (looks like  G-ABC123XYZ ).
     4. Paste it below in place of  G-XXXXXXXXXX  and save.

   After that, GA automatically records page views AND the ?utm_source /
   ?utm_campaign tags on your ad links — so you can see which channel produced
   which lead. The "book_call_click" event (fired from hire.js) shows up under
   Reports → Engagement → Events, so you can mark it as a conversion.
   ========================================================================= */
(function () {
  var GA_ID = "G-XXXXXXXXXX"; // <-- paste your GA4 Measurement ID here

  // Stay inert until a real ID is set — no network calls, no cookies.
  if (!GA_ID || GA_ID.indexOf("XXXX") !== -1) return;

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
})();
