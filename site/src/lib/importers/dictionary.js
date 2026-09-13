import { readFileSync } from "node:fs";

// The English word list used to repair text pulled out of PDFs (see
// repairPdfText in ./common.js). ~274k words; loaded on the first import and
// kept, since imports are rare and the list is only ~20 MB in memory.
let words = null;

export async function getDictionary() {
  if (words) return words;
  try {
    const { default: listPath } = await import("word-list");
    words = new Set(readFileSync(listPath, "utf8").split("\n").map((w) => w.trim()).filter(Boolean));
  } catch (e) {
    // Deliberately not cached. A failure here used to stick for the life of
    // the process, so one bad moment at startup meant every import for the
    // rest of the deploy silently skipped the text repairs.
    console.warn("[import] Word list unavailable; PDF text will not be auto-repaired:", e?.message);
    return new Set();
  }
  return words;
}
