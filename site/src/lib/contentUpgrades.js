import crypto from "node:crypto";

// -----------------------------------------------------------------------------
//  Lets improved default wording reach a site whose admin never edited it.
//
//  The Content tab saves the whole document it shows — defaults included — so
//  every default that existed at the admin's last save is now stored as if the
//  admin had typed it. Changing a default in code therefore never reaches the
//  live site on its own.
//
//  Each entry below fingerprints the value a field shipped with before. When a
//  stored value still matches that fingerprint exactly, the admin never touched
//  it, and the current default is shown in its place. Anything the admin did
//  change is left exactly as they wrote it. Nothing is written to the
//  database; the next save from the Content tab stores the new wording.
// -----------------------------------------------------------------------------

// Key order is normalised because Postgres JSONB reorders object keys.
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function fingerprint(v) {
  return crypto.createHash("sha256").update(stable(v)).digest("hex").slice(0, 16);
}

// path → fingerprints of earlier shipped defaults (September 2026 SEO pass).
const RETIRED_DEFAULTS = {
  "seo.title": ["49896d757476a149"],
  "seo.description": ["3a3ccea10d968c8c"],
  "faq.items": ["14b421a8dac8dec4"],
  // The second entry is the notice as it shipped until September 2026, whose
  // Meta opt-out link now answers 500. A privacy notice that names a way to
  // exercise a choice has to have that way work, so this one is worth retiring
  // even though the wording is otherwise unchanged.
  "privacy.body": ["3e8e8ef46558d952", "12772e1d84347174"],
  "privacy.heroSub": ["056b9a667e52ac86"],
  "accessibility.body": ["9f01f8f2a88c667b"],
};

const getAt = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setAt(obj, path, value) {
  const [head, ...rest] = path;
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setAt(obj?.[head] || {}, rest, value) };
}

// merged: defaults + saved overrides. saved: the raw stored overrides.
export function applyDefaultUpgrades(merged, saved, defaults) {
  let out = merged;
  for (const [key, retired] of Object.entries(RETIRED_DEFAULTS)) {
    const path = key.split(".");
    const stored = getAt(saved, path);
    if (stored === undefined) continue; // default already applies
    if (retired.includes(fingerprint(stored))) {
      out = setAt(out, path, getAt(defaults, path));
    }
  }
  return out;
}
