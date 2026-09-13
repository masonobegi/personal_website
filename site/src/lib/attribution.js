"use client";

// Where a visitor came from — the ad, campaign, or site — captured on their
// first page view and attached to anything they submit, so every lead in the
// Inbox says which campaign produced it.
//
// Kept in sessionStorage: it lasts while the tab is open (long enough to read
// a page or two and then fill in a form) and is forgotten afterwards.

const KEY = "olp_attribution";
const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid", // Google Ads click
  "fbclid", // Meta click
  "li_fat_id", // LinkedIn click
  "msclkid", // Microsoft Ads click
];

export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const found = {};
    for (const p of PARAMS) {
      const v = url.searchParams.get(p);
      if (v) found[p] = v.slice(0, 200);
    }
    const existing = JSON.parse(sessionStorage.getItem(KEY) || "null");
    // A new ad click replaces the old attribution; otherwise the first page
    // of the visit wins.
    if (Object.keys(found).length || !existing) {
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin)
        ? document.referrer.slice(0, 300)
        : "";
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          ...found,
          landingPage: (url.pathname + url.search).slice(0, 300),
          referrer: ref || existing?.referrer || "",
        })
      );
    }
  } catch {
    /* storage blocked — attribution is a nice-to-have */
  }
}

export function readAttribution() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// Reports a form submission to every ad/analytics platform configured in the
// admin. Sends only the event — never what the visitor typed.
export function trackLead(formName) {
  if (typeof window === "undefined") return;
  const cfg = window.__olpTracking || {};
  try {
    if (cfg.ga4 && window.gtag) window.gtag("event", "generate_lead", { form_name: formName });
    if (cfg.googleAds && window.gtag) window.gtag("event", "conversion", { send_to: cfg.googleAds });
    if (cfg.linkedinConversion && window.lintrk) {
      window.lintrk("track", { conversion_id: Number(cfg.linkedinConversion) });
    }
    if (cfg.meta && window.fbq) window.fbq("track", "Lead");
  } catch {
    /* never let tracking break a form */
  }
}
