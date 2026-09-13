// The exact shape of each analytics and ad-platform ID.
//
// These end up inside inline scripts, so anything that does not match is
// dropped rather than injected. That is the right call for safety, but it used
// to happen silently: a mistyped ID looked configured in the dashboard and
// simply never loaded, so a campaign ran for weeks reporting no conversions
// with nothing anywhere saying why. The dashboard now checks the same patterns
// as you type, and the server refuses a save that would be thrown away.

export const TRACKING_FORMATS = {
  ga4Id: /^G-[A-Z0-9]{4,20}$/,
  googleAdsId: /^AW-\d{5,20}$/,
  googleAdsLeadLabel: /^[A-Za-z0-9_-]{4,60}$/,
  linkedinPartnerId: /^\d{3,15}$/,
  linkedinLeadConversionId: /^\d{3,15}$/,
  metaPixelId: /^\d{6,20}$/,
};

// What to tell someone who has typed something the pattern rejects. Written for
// the mistake each field actually attracts.
export const TRACKING_HELP = {
  ga4Id: 'A measurement ID looks like "G-ABCD123456".',
  googleAdsId:
    'A tag ID looks like "AW-123456789". If you pasted something like "AW-123456789/AbC-D_efG", put the part before the slash here and the part after it in the lead conversion label below.',
  googleAdsLeadLabel: 'A conversion label looks like "AbC-D_efGhIjKlM" — letters, numbers, hyphens and underscores only.',
  linkedinPartnerId: "A partner ID is digits only.",
  linkedinLeadConversionId: "A conversion ID is digits only.",
  metaPixelId: "A pixel ID is digits only.",
};

// "" when the value is missing or malformed — i.e. nothing is injected.
export function cleanTracking(raw = {}) {
  const out = {};
  for (const [key, re] of Object.entries(TRACKING_FORMATS)) {
    const v = String(raw?.[key] || "").trim();
    out[key] = re.test(v) ? v : "";
  }
  if (!out.ga4Id) {
    const env = String(process.env.NEXT_PUBLIC_GA_ID || "").trim();
    if (TRACKING_FORMATS.ga4Id.test(env)) out.ga4Id = env;
  }
  return out;
}

// The fields that were filled in but would be discarded, so a save can be
// refused with a message instead of quietly dropping them.
export function invalidTrackingFields(raw = {}) {
  return Object.entries(TRACKING_FORMATS)
    .filter(([key, re]) => {
      const v = String(raw?.[key] || "").trim();
      return v && !re.test(v);
    })
    .map(([key]) => key);
}
