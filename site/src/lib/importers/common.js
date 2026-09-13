// -----------------------------------------------------------------------------
//  Shared helpers for turning an uploaded Word document or PDF into article
//  blocks (see lib/articlesStore for the block format).
// -----------------------------------------------------------------------------

const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
  "of", "on", "or", "over", "per", "the", "to", "vs", "via", "with",
]);

const stripPunct = (w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "");

// How each word is normally capitalised in this document's own body text:
// "Nike", "ESPP", "RSUs", "401(k)", "September". Only words that are not the
// first of a sentence are counted, so "The" at a sentence start doesn't teach
// us that "the" is capitalised. Used to fix up ALL-CAPS labels.
export function buildVocabulary(paragraphs) {
  const counts = new Map(); // lower → Map(variant → n)
  for (const para of paragraphs) {
    const tokens = String(para).split(/\s+/);
    let sentenceStart = true;
    for (const tok of tokens) {
      const word = stripPunct(tok);
      // An all-caps word is an acronym even at the start of a sentence.
      const acronym = word.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase();
      if (word && /\p{L}/u.test(word) && (!sentenceStart || acronym)) {
        const key = word.toLowerCase();
        if (!counts.has(key)) counts.set(key, new Map());
        const m = counts.get(key);
        m.set(word, (m.get(word) || 0) + 1);
      }
      sentenceStart = /[.?!:]["”')\]]*$/.test(tok);
    }
  }
  const vocab = new Map();
  for (const [key, variants] of counts) {
    const best = [...variants.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Only remember words that aren't plain lowercase — those are the ones
    // that need their special form restored.
    if (best !== key) vocab.set(key, best);
  }
  return vocab;
}

// Registers acronyms — AMT, ESPP, RSUs — so re-casing an all-caps heading
// leaves them alone rather than writing "says iso" or "esPP".
//
// Only ordinary mixed-case text is examined. A word inside an all-caps
// heading proves nothing: "THE SIX-PART TAX PROCESS" would make acronyms of
// "SIX" and "PART". A run of capitals sitting in a normal sentence is the
// only reliable evidence, and a word list cannot stand in for it — it lists
// "iso" as a word and not "rsu".
// The vocabulary of this particular business. A general word list is no help
// here: it lists "iso", "sar" and "sep" as ordinary words and has never heard
// of "rsu". Anything here keeps its capitals wherever it appears.
//
// Deliberately excluded: terms that are also ordinary English in normal use —
// TIPS, SIMPLE, CD, LP, CAP, BASIS. Forcing those to capitals would be wrong
// far more often than it would be right.
const DOMAIN_ACRONYMS = [
  // Equity compensation
  "ISO", "ISOs", "NSO", "NSOs", "NQSO", "NQSOs", "RSU", "RSUs", "RSA", "RSAs",
  "PSU", "PSUs", "ESPP", "ESOP", "SAR", "SARs", "FMV", "AMT", "NUA", "IPO",
  "NQDC", "DCP", "PSP", "SERP", "QSBS", "QDRO",
  // Accounts and plans
  "IRA", "IRAs", "SEP", "HSA", "HSAs", "FSA", "FSAs", "HDHP", "RMD", "RMDs",
  "QCD", "QCDs", "DAF", "DAFs", "UTMA", "UGMA", "TSP", "ERISA", "COBRA", "FICA",
  // Investments and markets
  "ETF", "ETFs", "REIT", "REITs", "NAV", "CAGR", "EPS", "ROI", "YTD", "YOY",
  "FIFO", "LIFO", "ADR", "ADRs", "NYSE", "NASDAQ", "GDP", "CPI", "APR", "APY",
  // Tax
  "AGI", "MAGI", "LTCG", "IRS", "W-2", "NIIT",
  // Regulators, firms, designations
  "LPL", "LPLE", "SEC", "FINRA", "SIPC", "FDIC", "CFP", "CRPC", "CPA", "CFA",
  "RIA", "BD", "LLC", "LLP",
];

export function addAcronyms(vocab, texts) {
  for (const term of DOMAIN_ACRONYMS) {
    const lower = term.toLowerCase();
    if (!vocab.has(lower)) vocab.set(lower, term);
  }
  for (const text of texts) {
    const value = String(text || "");
    if (!value.trim() || isAllCaps(value)) continue;
    for (const raw of value.split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 2 || raw.length > 6) continue;
      if (!/^\p{Lu}+$/u.test(raw)) continue;
      const lower = raw.toLowerCase();
      if (vocab.has(lower)) continue;
      // "RSUS" is the plural of "RSU", and the usual spelling is "RSUs" — but
      // only when there is reason to think the last S is a plural. An acronym
      // that genuinely ends in S was being rewritten into a word that does not
      // exist, so the singular has to be corroborated first.
      const stem = raw.slice(0, -1);
      const plural =
        raw.length > 2 &&
        raw.endsWith("S") &&
        (vocab.has(stem.toLowerCase()) || DOMAIN_ACRONYMS.includes(stem));
      vocab.set(lower, plural ? `${stem}s` : raw);
    }
  }
  return vocab;
}

export function isAllCaps(text) {
  // Drop any word containing a digit before judging. The firm's most common
  // term is "401(k)", whose lowercase k made every heading containing it look
  // like ordinary sentence case — so those headings were left shouting.
  const letters = String(text)
    .split(/\s+/)
    .filter((word) => !/\p{N}/u.test(word))
    .join("")
    .replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function recase(word, vocab, { capitalize }) {
  const core = stripPunct(word);
  if (!core) return word;
  // The pronoun, which the vocabulary can never learn for itself: a one-letter
  // token is skipped when the acronyms are collected, so with capitalize off
  // this fell through to toLowerCase. That is how run-in leads in the Nike
  // papers reached the page reading "How much of the match am i capturing?".
  if (/^i(['’](m|ll|ve|d))?$/i.test(core)) {
    return word.replace(core, core[0].toUpperCase() + core.slice(1).toLowerCase());
  }
  const known = vocab.get(core.toLowerCase());
  let fixed;
  if (known) fixed = known;
  else if (/\d/.test(core) && /\p{L}/u.test(core)) fixed = core.toLowerCase(); // "401(K)" → "401(k)"
  else fixed = capitalize ? core[0].toUpperCase() + core.slice(1).toLowerCase() : core.toLowerCase();
  if (capitalize && fixed === fixed.toLowerCase()) fixed = fixed[0].toUpperCase() + fixed.slice(1);
  return word.replace(core, fixed);
}

// "A SIMPLE ILLUSTRATIVE STRESS TEST" → "A Simple Illustrative Stress Test".
// Leaves text that isn't all caps untouched.
export function titleCase(text, vocab = new Map()) {
  if (!isAllCaps(text)) return text;
  let first = true;
  return text
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part.trim() || part === "-") return part;
      const lower = stripPunct(part).toLowerCase();
      const cap = first || !SMALL_WORDS.has(lower);
      first = /[:.?!]$/.test(part); // capitalise after a colon too
      return recase(part, vocab, { capitalize: cap });
    })
    .join("");
}

// "WHAT IS THE COMPLETE OWNED PERCENTAGE?" → "What is the complete owned percentage?"
// (proper nouns and acronyms keep their form).
export function sentenceCase(text, vocab = new Map()) {
  if (!isAllCaps(text)) return text;
  let first = true;
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      const hasLetter = /\p{L}/u.test(part);
      const out = recase(part, vocab, { capitalize: first && hasLetter });
      if (hasLetter) first = false;
      return out;
    })
    .join("");
}

// Turns a flat list of { kind, text, level? } items into article blocks:
// headings stay separate; consecutive paragraphs and list items are merged
// into one text block (paragraphs separated by blank lines, list items as
// "- item" lines) so the editor shows a handful of blocks, not hundreds.
export function assembleBlocks(items) {
  const blocks = [];
  let buf = [];
  let list = null; // { ordered, lines }

  const flushList = () => {
    if (list) {
      // Start from the number the document used, not from one. A list that is
      // really step four of six has to say four.
      const first = Number.isFinite(list.start) ? list.start : 1;
      buf.push(
        list.lines
          .map((l, i) => (list.ordered ? `${first + i}. ${l}` : `- ${l}`))
          .join("\n")
      );
      list = null;
    }
  };
  const flush = () => {
    flushList();
    const text = buf.join("\n\n").trim();
    if (text) blocks.push({ type: "text", text });
    buf = [];
  };

  for (const it of items) {
    if (it.kind === "heading") {
      flush();
      const text = it.text.replace(/\s+/g, " ").trim();
      if (text) blocks.push({ type: "heading", level: it.level === 3 ? 3 : 2, text });
    } else if (it.kind === "image") {
      flush();
      blocks.push({ type: "image", src: it.src, caption: it.caption || "", alt: it.alt || "", width: it.width, height: it.height });
    } else if (it.kind === "li") {
      if (list && list.ordered !== Boolean(it.ordered)) flushList();
      if (!list) list = { ordered: Boolean(it.ordered), lines: [], start: it.number };
      list.lines.push(it.text.replace(/\s*\n\s*/g, " ").trim());
    } else {
      flushList();
      const text = it.text.trim();
      if (text) buf.push(text);
    }
  }
  flush();
  return blocks;
}

// ---- Repairing text pulled out of PDFs --------------------------------------
//
// Some PDFs (justified or letter-spaced text, design tools, "Print to PDF")
// place letters so far apart that the extractor guesses a space inside a
// word ("thor oughly", "extr action"). Small-caps fonts often map lowercase
// x/o/s/v/w/z to their capitals, giving "eXtraction" or "DIvERSIFICATION".
// These repairs only change a word when the result is a real English word,
// so names, brands (LinkedIn, iPhone), and acronyms (RSUs, ESPP) are left
// alone.

// Word endings that happen to be dictionary words ("ing", "ment") but, alone
// in the middle of prose, are nearly always the back half of a split word.
const ENDING_FRAGMENTS = new Set([
  "ing", "ings", "ment", "ments", "ly", "ed", "er", "ers", "es", "al", "ous",
  "ness", "ful", "ity", "ities", "ive", "ives", "ence", "ences", "ance",
  "ances", "ant", "ants", "ent", "ents", "ist", "ists", "ism", "able", "ible",
  "ize", "ized", "ise", "ated", "ation", "ations", "tion", "tions", "sion",
  "sions", "ure", "ures", "ual", "ally", "ology", "ical", "ian", "ians",
]);

// The word list leaves out one-letter words; "a part" must never become "apart".
const ALWAYS_WORDS = new Set(["a", "i", "o"]);

// Words that are never the front half of a split word — they are the ordinary
// little words of English, and some of the endings above ("able", "ally",
// "ant", "ist") are also words in their own right. Without this, "An ally"
// became "Anally" and "is not able to" became "is notable to".
const NEVER_FIRST = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by", "can",
  "could", "did", "do", "does", "each", "for", "from", "had", "has", "have",
  "he", "her", "hers", "his", "how", "i", "if", "in", "is", "it", "its", "may",
  "might", "more", "most", "must", "my", "no", "none", "nor", "not", "of",
  "off", "on", "one", "or", "our", "out", "own", "she", "should", "so", "some",
  "than", "that", "the", "their", "them", "these", "they", "this", "those",
  "to", "too", "up", "us", "very", "was", "we", "were", "what", "when",
  "which", "who", "why", "will", "with", "would", "you", "your",
]);

const isAcronym = (w) => /^[A-Z]{2,}$/.test(w);

// "thor oughly" → "thoroughly": joins two (or three) neighbouring pieces when
// the joined form is a word and at least one piece isn't. "may be", "any one",
// and "in to" stay apart because each piece is a word in its own right.
export function repairSplitWords(text, dict) {
  if (!dict?.size || !text) return text;
  const inDict = (w) => dict.has(w.toLowerCase());
  const standsAlone = (w) =>
    ALWAYS_WORDS.has(w.toLowerCase()) || (inDict(w) && !ENDING_FRAGMENTS.has(w.toLowerCase()));
  // Letter runs and everything between them, so a piece is only ever joined
  // across a single plain space (never a hyphen, apostrophe, or line break).
  const t = String(text).match(/[A-Za-z]+|[^A-Za-z]+/g) || [];
  const isLetters = (i) => i < t.length && /^[A-Za-z]/.test(t[i]);
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    // Never start from a single letter or the tail of an apostrophe: the "R"
    // in "1099-R and" or the "s" in "spouse's wages" are not word fragments.
    const joinable =
      isLetters(i) &&
      a.length >= 2 &&
      !isAcronym(a) &&
      !NEVER_FIRST.has(a.toLowerCase()) &&
      !/['’]$/.test(t[i - 1] || "");
    if (joinable && t[i + 1] === " " && isLetters(i + 2) && t[i + 2].length >= 2 && /^[a-z]/.test(t[i + 2])) {
      const b = t[i + 2];
      // Three pieces first: "ex tr action" → "extraction".
      if (t[i + 3] === " " && isLetters(i + 4) && /^[a-z]/.test(t[i + 4])) {
        const c = t[i + 4];
        const abc = a + b + c;
        if (inDict(abc) && [a, b, c].some((x) => !standsAlone(x))) {
          out.push(abc);
          i += 4;
          continue;
        }
      }
      if (inDict(a + b) && (!standsAlone(a) || !standsAlone(b))) {
        out.push(a + b);
        i += 2;
        continue;
      }
    }
    out.push(a);
  }
  return out.join("");
}

// "eXtraction" → "extraction", "TaXes" → "Taxes", "DIvERSIFICATION" →
// "DIVERSIFICATION" (which heading casing then turns into "Diversification").
// The letters a small-caps font maps to their capitals. Anything else inside a
// word is somebody's spelling, not an artefact.
const SMALL_CAPS_LETTERS = new Set(["X", "O", "S", "V", "W", "Z"]);

export function repairStrayCaps(text, dict) {
  if (!dict?.size || !text) return text;
  return String(text).replace(/[A-Za-z]{3,}/g, (w) => {
    const lower = w.toLowerCase();
    if (!dict.has(lower)) return w; // names and brands are never touched
    const inner = w.slice(1);
    const lowers = (w.match(/[a-z]/g) || []).length;
    // Mostly lowercase with a capital inside it — but only the letters a
    // small-caps font actually confuses. Flattening any interior capital also
    // flattened brand names whose lowercase form happens to be a word, so
    // "NetBenefits" became "Netbenefits" and "TurboTax" became "Turbotax".
    const interiorCaps = inner.match(/[A-Z]/g) || [];
    if (
      lowers >= 2 &&
      interiorCaps.length &&
      inner !== inner.toUpperCase() &&
      interiorCaps.every((c) => SMALL_CAPS_LETTERS.has(c))
    ) {
      return w[0] + inner.toLowerCase();
    }
    // Mostly capitals with a stray lowercase letter (small caps). Plural
    // acronyms like "RSUs" and "IRAs" are left as they are.
    if (lowers && lowers / w.length < 0.34 && !/^[A-Z]+s$/.test(w)) {
      return w.toUpperCase();
    }
    return w;
  });
}

export function repairPdfText(text, dict) {
  return repairSplitWords(repairStrayCaps(text, dict), dict);
}

// "Reviewed August 2026" / "Information reviewed as of 8/1/2026" → the date.
export function findReviewedDate(text) {
  const m = /reviewed(?:\s+as\s+of)?[:\s]+([A-Z][a-z]+\.?\s+(?:\d{1,2},\s+)?\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(
    String(text || "")
  );
  return m ? m[1] : "";
}

// Small-print sections that belong in the article's Disclosures panel rather
// than its body.
export const DISCLOSURE_HEADING = /^(?:regulatory\s+|important\s+|legal\s+)?disclosures?(?:\s+and\s+disclaimers?)?:?$/i;
export const SOURCES_HEADING = /^(?:sources?|references?|documents\s+reviewed|sources\s+and\s+documents\s+reviewed|notes)(?:\s+and\s+[a-z ]+)?:?$/i;


// Whether a short bold line reads as a section heading rather than a sentence
// someone emphasised. Firms bold their compliance lines, and those were being
// turned into headings in the middle of articles. Length is no help here:
// "Past performance is no guarantee of future results" is fifty characters.
// Words Title Case leaves in lower case, and so cannot be evidence either way.
const TITLE_CASE_MINOR = new Set(["a","an","the","and","or","nor","but","of","to","in","on","for","with","by","as","at","from","into","over","per","via","vs","no","not"]);

// Verbs that turn a line into a statement, in both their forms. The firm's own
// disclosures say "LPLE and LPL Financial are not affiliated…", where the verb
// is the plural one, so both have to be here.
const FINITE_STEMS = ["involve","include","provide","offer","mean","require","remain","apply","depend","vary","carry","assure","protect","guarantee"];
const FINITE_VERBS = new Set([
  "is","are","was","were","will","would","should","may","might","must","can",
  "could","does","do","did","has","have","had",
  ...FINITE_STEMS,
  ...FINITE_STEMS.map((v) =>
    /[sxz]$|ch$|sh$/.test(v) ? `${v}es` : v.endsWith("y") ? `${v.slice(0, -1)}ies` : `${v}s`
  ),
]);

// The things a regulated firm puts in its small print. These are never section
// headings, however they are capitalised — and they are the lines that must not
// end up in the article body, so they are named rather than inferred.
const COMPLIANCE_PHRASES = [
  /past performance/i,
  /\bno guarantee/i,
  /not affiliated/i,
  /loss of principal/i,
  /not intended to provide/i,
  /securities[^.]{0,40}offered through/i,
  /involves? risk/i,
  /assures? success/i,
  /protects? against loss/i,
  /not a recommendation/i,
  /for general information/i,
  /member finra/i,
];

// Whether a short bold line is a section heading someone styled by hand rather
// than a sentence they emphasised. Firms bold their compliance lines, and
// those were being published as headings in the middle of articles.
//
// Shaped as rejections with a permissive default, because the headings this
// has to accept vary far more than the sentences it has to reject: they come
// in Title Case, in sentence case, in capitals, and as single words ("Sources",
// "Disclosures") — and a one-word bold "Disclosures" is what tells the importer
// where a paper's small print begins. An earlier version required Title Case
// outright and threw all of those away.
export function looksLikeHeading(text) {
  const t = String(text || "").trim();
  if (t.length < 2 || t.length > 110) return false;
  // Punctuated like a sentence. A question mark or colon is not — headings
  // routinely end that way ("What actually vests?").
  if (/[.,;]$/.test(t)) return false;
  if (COMPLIANCE_PHRASES.some((re) => re.test(t))) return false;

  const words = t.split(/\s+/);
  if (words.length > 12) return false;

  const bare = (w) => w.replace(/[^A-Za-z]/g, "");
  const shouting = isAllCaps(t);
  if (shouting && words.length > 10) return false;

  // Title Case is the strongest signal there is, but only where the writer had
  // the option of lower case. In text that is entirely capitals every word
  // begins with a capital, so this test accepts any capitalised sentence — and
  // the firm sets its disclosures in capitals. Skip it there and let the verb
  // test below decide instead. The cost is that a shouted heading containing a
  // verb is read as prose, which an admin sees in the preview; the error this
  // prevents is small print published as a section heading, re-cased, on a page
  // nobody checks again.
  if (!shouting) {
    const telling = words.filter(
      (w) => bare(w).length >= 2 && !TITLE_CASE_MINOR.has(bare(w).toLowerCase())
    );
    // Settled before the verb test — plenty of real headings contain one
    // ("Why the Stock Option Is the Riskier Investment").
    if (telling.length >= 2) {
      const capitalised = telling.filter((w) => /^[A-Z]/.test(bare(w))).length;
      if (capitalised / telling.length >= 0.75) return true;
    }
  }

  // Not Title Case: a finite verb with a subject in front of it makes it a
  // sentence. The same word first is an instruction, which is a fine heading.
  if (words.slice(1).some((w) => FINITE_VERBS.has(bare(w).toLowerCase()))) return false;

  return true;
}