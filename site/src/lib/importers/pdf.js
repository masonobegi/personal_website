import {
  addAcronyms,
  assembleBlocks,
  buildVocabulary,
  findReviewedDate,
  isAllCaps,
  repairPdfText,
  sentenceCase,
  titleCase,
  DISCLOSURE_HEADING,
  SOURCES_HEADING,
} from "@/lib/importers/common";
import { getDictionary } from "@/lib/importers/dictionary";

// -----------------------------------------------------------------------------
//  PDF → article.
//
//  A PDF has no paragraphs or headings, only positioned runs of text in a
//  given font and size. This rebuilds the structure the way a reader sees it:
//    • the running header/footer and page numbers repeat on every page → dropped
//    • the largest text on page one is the title; the line under it a subtitle
//    • clearly larger text is a section heading (H2)
//    • a short bold line on its own is a sub-heading (H3)
//    • a bold label that runs into its paragraph becomes a bold lead-in
//    • lines are rejoined into paragraphs by spacing; bullets become lists
//    • small print is split into Sources and Disclosures
//  Images and charts inside the PDF are not carried over.
// -----------------------------------------------------------------------------

const BOLD_RE = /bold|black|heavy|semibold|demibold|demi\b/i;
const ITALIC_RE = /italic|oblique/i;
const BULLET_RE = /^\s*(?:[•●▪◦‣∙·•▪●]|[-–]\s)\s*/;
const NUMBER_ITEM_RE = /^\s*\d{1,2}[.)]\s+/;

function round(n, step = 0.5) {
  return Math.round(n / step) * step;
}

// Clusters text items into lines (same baseline), left to right.
function toLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(2, it.size * 0.35));
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    // Merge items into styled runs, restoring spaces the PDF left implicit.
    const runs = [];
    let prev = null;
    for (const it of line.items) {
      let str = it.str;
      if (prev) {
        const gap = it.x - (prev.x + prev.w);
        const needsSpace =
          gap > prev.size * 0.18 && !/\s$/.test(runs[runs.length - 1].text) && !/^\s/.test(str);
        if (needsSpace) str = ` ${str}`;
      }
      const last = runs[runs.length - 1];
      const sameStyle =
        last && last.bold === it.bold && last.italic === it.italic && Math.abs(last.size - it.size) < 0.6;
      // Whitespace-only items inherit the style of whatever they sit between.
      if (last && (sameStyle || !it.str.trim())) last.text += str;
      else runs.push({ text: str, size: it.size, bold: it.bold, italic: it.italic });
      prev = it;
    }
    line.runs = runs.map((r) => ({ ...r, text: r.text.replace(/\s+/g, " ") })).filter((r) => r.text.trim());
    line.text = line.runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
    line.x = line.items[0].x;
    // The line's "real" size and style: whatever most of its characters use.
    const bySize = new Map();
    for (const r of line.runs) bySize.set(r.size, (bySize.get(r.size) || 0) + r.text.length);
    line.size = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    line.bold = line.runs.length > 0 && line.runs.every((r) => r.bold);
    line.italic = line.runs.length > 0 && line.runs.every((r) => r.italic);
  }
  return lines.filter((l) => l.text);
}

// Well past any real white paper, and short of the point where reading a
// document costs more memory than the server has.
const MAX_PAGES = 600;

// A line whose pieces sit in three or more separate columns with wide empty
// space between them is a row of a table, not a sentence. The header row of a
// table is usually bold, and was becoming a section heading — which put a
// column label like "Award type" in the article's contents list.
// A page is in two columns when a good share of its lines share one wide gap
// at about the same place across the page — the gutter. Scattered wide gaps
// are tab stops or a table, not a column break.
function hasTwoColumns(page) {
  // Rows of a table have wide gaps too, and there is no point warning about
  // reading order for those — they are handled separately and the admin is
  // told about them in the same banner.
  // Rows of a table have wide gaps too. The heading-detection test needs three
  // columns before it calls something a row, which is right there — but a
  // two-column table (a label and a figure) would otherwise be counted as page
  // gutters and report a perfectly ordinary document as being set in columns.
  const tabular = (l) => {
    const items = l.items || [];
    if (items.length < 2) return false;
    const wide = Math.max(l.size * 1.8, 8);
    let columns = 1;
    for (let i = 0; i < items.length; i++) {
      const gap = i > 0 ? items[i].x - (items[i - 1].x + items[i - 1].w) : 0;
      const padded = !String(items[i].str || "").trim() ? items[i].w : 0;
      if (Math.max(gap, padded) > wide) columns++;
    }
    if (columns < 2) return false;
    // What separates a table row from two columns of prose is how much text
    // sits on each SIDE of the gap, not how long any individual piece is —
    // keying on piece length missed a narrow or large-type two-column layout,
    // where the lines are short for reasons that have nothing to do with
    // tables. A row is a short label against a short figure; a column of prose
    // runs to the margin on both sides.
    const { at } = widestGap(items);
    let left = 0;
    let right = 0;
    for (const item of items) {
      const len = String(item.str || "").trim().length;
      if (!len) continue;
      if (item.x < at) left += len;
      else right += len;
    }
    return left > 0 && right > 0 && left + right <= 60;
  };
  const lines = (page.lines || []).filter(
    (l) => (l.items || []).length > 1 && !looksLikeTableRow(l) && !tabular(l)
  );
  if (lines.length < 4) return false;
  const gutters = [];
  for (const line of lines) {
    const { width, at } = widestGap(line.items);
    // A gutter is wide compared with a word space but not enormous; a real
    // two-column layout sits around three to five times the type size.
    if (width > line.size * 2.5) gutters.push(at);
  }
  if (gutters.length < Math.max(3, lines.length * 0.35)) return false;
  // Clustered tightly enough to be one gutter rather than several.
  gutters.sort((a, b) => a - b);
  const mid = gutters[Math.floor(gutters.length / 2)];
  const near = gutters.filter((g) => Math.abs(g - mid) < 24).length;
  return near >= gutters.length * 0.7;
}

// The widest horizontal space inside a line, and where it starts.
//
// Empty space between columns reaches us in two different shapes depending on
// how the document was produced: either as a gap between two pieces of text,
// or as a piece of text that is nothing but spaces. Only counting the first
// missed every PDF that pads its columns out with spaces, which is most of
// them.
function widestGap(items = []) {
  let width = 0;
  let at = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = item.x - (prev.x + prev.w);
      if (gap > width) {
        width = gap;
        at = prev.x + prev.w;
      }
    }
    if (!String(item.str || "").trim() && item.w > width) {
      width = item.w;
      at = item.x;
    }
  }
  return { width, at };
}

function looksLikeTableRow(line) {
  const items = line.items || [];
  if (items.length < 3) return false;
  const wide = Math.max(line.size * 1.8, 8);
  let columns = 1;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const gap =
      i > 0 ? item.x - (items[i - 1].x + items[i - 1].w) : 0;
    const padded = !String(item.str || "").trim() ? item.w : 0;
    if (Math.max(gap, padded) > wide) columns++;
  }
  return columns >= 3;
}

const LITERAL_ASTERISK = "∗";
function keepLiteralAsterisks(text) {
  return String(text || "").split("*").join(LITERAL_ASTERISK);
}

export async function importPdf(buffer) {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const warnings = [];

  // The 20 MB limit on the upload bounds the file, not the work. A compressed
  // PDF of a few megabytes can hold thousands of pages, and reading them costs
  // memory that is never given back until the whole import finishes — enough,
  // measured, to take the server down. The page count is known before a single
  // page is read, so it is checked here. Six hundred is far beyond any white
  // paper this is meant for.
  if (pdf.numPages > MAX_PAGES) {
    return {
      title: "",
      subtitle: "",
      blocks: [],
      sources: "",
      disclosures: "",
      reviewedDate: "",
      warnings: [
        `This PDF has ${pdf.numPages} pages, which is more than the importer will take (${MAX_PAGES}). Split it up, or import the part you want as its own file.`,
      ],
    };
  }

  // ---- 1. Read every page into styled lines --------------------------------
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    try {
      await page.getOperatorList(); // loads fonts, so bold/italic can be read
    } catch {
      /* styles just won't be detected */
    }
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      if (typeof it.str !== "string" || !it.str) continue;
      if (Math.abs(it.transform[1]) > 0.01) continue; // rotated text (watermarks)
      let fontName = "";
      try {
        fontName = page.commonObjs.get(it.fontName)?.name || "";
      } catch {
        fontName = "";
      }
      const family = tc.styles?.[it.fontName]?.fontFamily || "";
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
        size: round(Math.hypot(it.transform[2], it.transform[3]) || it.height || 0, 0.1),
        bold: BOLD_RE.test(fontName) || BOLD_RE.test(family),
        italic: ITALIC_RE.test(fontName) || ITALIC_RE.test(family),
      });
    }
    pages.push({ n: p, height, lines: toLines(items) });
  }

  // Two columns read straight across, one line at a time, which produces
  // sentences with another sentence spliced into the middle of them. Detecting
  // it is cheap; putting it back in order is not, so the admin is told rather
  // than left to find it.
  const columnar = pages.filter((pg) => hasTwoColumns(pg)).length;
  if (columnar && columnar >= pages.length / 2) {
    warnings.push(
      "This PDF looks like it is set in two columns. The text came through, but almost certainly in the wrong order — read the article body before saving, or import a single-column version instead."
    );
  }

  const allLines = pages.flatMap((pg) => pg.lines);
  if (allLines.length < 3) {
    return {
      title: "",
      subtitle: "",
      blocks: [],
      sources: "",
      disclosures: "",
      reviewedDate: "",
      warnings: [
        "No text could be read from this PDF. It may be a scanned image; export it from the original document instead, or use a Word file.",
      ],
    };
  }

  // ---- 2. Drop running headers, footers, and page numbers ------------------
  const edgeKey = (l) => l.text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  // Measure the band each page's text actually occupies instead of comparing
  // against the page box. A page that carries /Rotate (landscape exhibits) or
  // a MediaBox that doesn't start at the origin reports a height that the raw
  // y values don't line up with — which used to leave real headers in place on
  // some documents and cut body text out of others. Observed extents are
  // correct either way, and the "repeats on another page" test below is what
  // actually decides that a line is a running header.
  for (const pg of pages) {
    const ys = pg.lines.map((l) => l.y);
    pg.top = ys.length ? Math.max(...ys) : 0;
    pg.bottom = ys.length ? Math.min(...ys) : 0;
  }
  const inEdge = (l, pg) => {
    const span = pg.top - pg.bottom;
    if (!(span > 0)) return true; // a one-line page is all edge
    return l.y >= pg.bottom + span * 0.92 || l.y <= pg.bottom + span * 0.08;
  };
  // The biggest type on page one, so a repeated line that is also the paper's
  // title survives on page one. Without this, a document whose title is
  // repeated as a running header loses its title along with the header.
  const titleSize = Math.max(0, ...(pages[0]?.lines || []).map((l) => l.size));
  const edgeCounts = new Map();
  for (const pg of pages) {
    const seen = new Set();
    for (const l of pg.lines) if (inEdge(l, pg)) seen.add(edgeKey(l));
    for (const k of seen) edgeCounts.set(k, (edgeCounts.get(k) || 0) + 1);
  }
  for (const pg of pages) {
    pg.lines = pg.lines.filter((l) => {
      if (!inEdge(l, pg)) return true;
      const k = edgeKey(l);
      if (/^(page\s*)?#(\s*(of|\/)\s*#)?$/.test(k)) return false;
      if (!(pages.length >= 2 && edgeCounts.get(k) >= 2)) return true;
      // Repeats everywhere — a running header, unless it's page one's headline.
      return pg.n === 1 && titleSize > 0 && l.size >= titleSize - 0.6;
    });
  }

  // Everything on every page turned out to be a header, footer, or page
  // number: there is no article here to import.
  if (!pages.some((pg) => pg.lines.length)) {
    return {
      title: "",
      subtitle: "",
      blocks: [],
      sources: "",
      disclosures: "",
      reviewedDate: "",
      warnings: [
        "No article text could be read from this PDF — only page headers and footers. It may be a scanned image; export it from the original document instead, or use a Word file.",
      ],
    };
  }

  // ---- 3. Body text size: the size most characters are set in --------------
  const sizeWeight = new Map();
  for (const pg of pages)
    for (const l of pg.lines) sizeWeight.set(round(l.size), (sizeWeight.get(round(l.size)) || 0) + l.text.length);
  const body = [...sizeWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;

  // ---- 4. Title and subtitle from the top of page one ----------------------
  const coverLabels = new Set();
  let title = "";
  let subtitle = "";
  const first = pages[0];
  // Only the first few lines are candidates. The search used to run over the
  // whole page, so a pull quote or a large figure caption further down could be
  // taken for the title — and everything above it, the real title included, was
  // then discarded as cover furniture.
  const head = first.lines.slice(0, 5);
  const maxSize = head.length ? Math.max(...head.map((l) => l.size)) : 0;
  if (maxSize >= body * 1.5) {
    const tIdx = first.lines.findIndex((l) => l.size === maxSize);
    let end = tIdx;
    while (end + 1 < first.lines.length && Math.abs(first.lines[end + 1].size - maxSize) < 0.6) end++;
    title = first.lines.slice(tIdx, end + 1).map((l) => l.text).join(" ");
    let sEnd = end;
    while (
      sEnd + 1 < first.lines.length &&
      first.lines[sEnd + 1].size > body * 1.1 &&
      first.lines[sEnd + 1].size < maxSize &&
      !first.lines[sEnd + 1].bold
    )
      sEnd++;
    subtitle = first.lines.slice(end + 1, sEnd + 1).map((l) => l.text).join(" ");
    // Everything above the title (a series label, a logo line) is dropped.
    // Those same words usually reappear as a running header further in, so
    // remember them: in a short document a header that only starts on page two
    // never repeats often enough for the count above to catch it, and it ended
    // up published inside the article's "Sources and documents reviewed".
    for (const l of first.lines.slice(0, tIdx)) coverLabels.add(edgeKey(l));
    first.lines = first.lines.slice(sEnd + 1);
  }

  if (coverLabels.size) {
    for (const pg of pages) {
      if (pg.n === 1) continue;
      pg.lines = pg.lines.filter((l) => !(inEdge(l, pg) && coverLabels.has(edgeKey(l))));
    }
  }

  // ---- 5. Classify each line -------------------------------------------------
  const lines = pages.flatMap((pg) => pg.lines.map((l) => ({ ...l, page: pg.n })));
  for (const l of lines) {
    const leadBold = [];
    for (const r of l.runs) {
      if (!r.bold) break;
      leadBold.push(r);
    }
    const leadText = leadBold.map((r) => r.text).join("").trim();
    if (l.size <= body * 0.75) l.kind = "fine";
    else if (l.size >= body * 1.25) l.kind = "h2";
    else if (l.bold && l.text.length <= 140 && !looksLikeTableRow(l)) l.kind = "label";
    // 90 characters was short enough that a long all-caps lead fell through and
    // was published still shouting. All-caps ones get the same allowance as a
    // bold label; anything else keeps the tighter limit, because the run-in
    // branch appends a colon and that would be wrong mid-sentence.
    else if (
      leadText &&
      leadBold.length < l.runs.length &&
      (leadText.length <= 90 || (isAllCaps(leadText) && leadText.length <= 140))
    ) {
      l.kind = "runin";
      l.lead = leadText;
      l.rest = l.runs.slice(leadBold.length).map((r) => r.text).join("").trim();
    } else l.kind = "body";
    l.bullet = BULLET_RE.test(l.text);
  }

  // ---- 6. Rejoin lines into paragraphs --------------------------------------
  const paras = [];
  let cur = null;
  const endsSentence = (t) => /[.?!:;"”)\]]$/.test(t);
  const join = (a, b) => (/[-‐]$/.test(a) && /^[a-z]/.test(b) ? a + b : `${a} ${b}`);

  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const gap = prev && prev.page === l.page ? prev.y - l.y : null;
    const tight = gap !== null && gap <= Math.max(l.size, prev.size) * 1.65;
    // A paragraph can run across a page break when it clearly isn't finished.
    const spansPage =
      prev && prev.page !== l.page && cur && cur.kind === "body" && l.kind === "body" && !endsSentence(cur.text) && /^[a-z(]/.test(l.text);
    const continues =
      cur &&
      !l.bullet &&
      l.kind !== "runin" &&
      (tight || spansPage) &&
      // Headings wrap too. A two-line heading was arriving as two separate
      // headings — one live article has "…Age 55, Five Years of Service, and
      // the" followed by a heading reading only "Years", which then appears
      // that way in the contents list as well. Same size and close enough
      // together means one heading over two lines, not two headings.
      ((cur.kind === l.kind &&
        ["body", "fine", "label", "h2"].includes(l.kind) &&
        (l.kind !== "h2" || Math.round(cur.size) === Math.round(l.size))) ||
        (cur.kind === "runin" && l.kind === "body") ||
        (cur.kind === "li" && l.kind === "body")) &&
      cur.italic === l.italic;
    if (continues) {
      cur.text = join(cur.text, l.kind === "runin" ? l.text : l.text);
      cur.lines++;
      return;
    }
    if (cur) paras.push(cur);
    if (l.bullet) {
      cur = { kind: "li", text: l.text.replace(BULLET_RE, ""), italic: l.italic, size: l.size, lines: 1 };
    } else if (l.kind === "runin") {
      cur = { kind: "runin", lead: l.lead, text: l.rest, italic: false, size: l.size, lines: 1 };
    } else {
      cur = { kind: l.kind, text: l.text, italic: l.italic, size: l.size, lines: 1 };
    }
  });
  if (cur) paras.push(cur);

  // ---- 7. Repair split words and stray capitals ----------------------------
  // Some PDFs space letters so widely that a space lands inside a word, or use
  // small-caps fonts that turn letters into capitals mid-word. Fixed here,
  // before headings are re-cased, so the fixes carry through.
  const dict = await getDictionary();
  for (const p of paras) {
    // An asterisk from the document would be read as one of the importer's own
    // emphasis markers further down and deleted, taking footnote markers with
    // it. The typographic one looks the same and means nothing to the
    // formatter.
    p.text = keepLiteralAsterisks(repairPdfText(p.text, dict));
    if (p.lead) p.lead = keepLiteralAsterisks(repairPdfText(p.lead, dict));
  }
  title = repairPdfText(title, dict);
  subtitle = repairPdfText(subtitle, dict);

  // ---- 8. Turn paragraphs into blocks --------------------------------------
  const vocab = buildVocabulary(paras.filter((p) => p.kind === "body" || p.kind === "runin").map((p) => p.text));
  // Headings and bold leads carry acronyms the body may never mention, and
  // re-casing a heading would otherwise lowercase them.
  addAcronyms(vocab, paras.flatMap((p) => [p.text, p.lead]));
  const items = [];
  const sources = [];
  const disclosures = [];
  let mode = "body"; // body | sources | disclosures

  for (const p of paras) {
    const plain = p.text.trim();
    if (!plain) continue;

    if ((p.kind === "label" || p.kind === "h2") && DISCLOSURE_HEADING.test(plain)) {
      mode = "disclosures";
      continue;
    }
    if ((p.kind === "label" || p.kind === "h2") && SOURCES_HEADING.test(plain)) {
      mode = "sources";
      continue;
    }
    // A full-size heading that isn't itself a disclosures/sources heading means
    // the small print is over and the article continues — some papers put an
    // "Important Disclosures" box after an exhibit, mid-document, and every
    // section after it used to disappear into the fine print.
    if (mode !== "body" && p.kind === "h2") {
      mode = "body";
    } else if (mode === "disclosures") {
      disclosures.push(plain);
      continue;
    }
    if (p.kind === "fine") {
      sources.push(plain);
      continue;
    }
    if (mode === "sources") {
      // Back to body text once something body-sized, non-heading appears.
      if (p.kind !== "body") mode = "body";
      else {
        sources.push(plain);
        continue;
      }
    }

    if (p.kind === "h2") {
      items.push({ kind: "heading", level: 2, text: titleCase(plain, vocab) });
    } else if (p.kind === "label") {
      // A long bold passage is emphasis, not a heading.
      if (plain.length > 140 || p.lines > 2) items.push({ kind: "p", text: `**${plain}**` });
      else items.push({ kind: "heading", level: 3, text: titleCase(plain, vocab) });
    } else if (p.kind === "runin") {
      let lead = sentenceCase(p.lead.replace(/\s+/g, " ").trim(), vocab);
      if (!/[.?!:]$/.test(lead)) lead += ":";
      items.push({ kind: "p", text: `**${lead}** ${p.text.trim()}`.trim() });
    } else if (p.kind === "li") {
      items.push({ kind: "li", text: plain, ordered: false });
    } else {
      // Small italic asides (e.g. "This is a hypothetical example…") keep
      // their italics; a large italic intro reads better as plain text.
      const text = p.italic && p.size < body && !plain.includes("*") ? `*${plain}*` : plain;
      items.push({ kind: "p", text });
    }
  }

  // Numbered paragraphs ("1. …", "2. …") in a row are a numbered list.
  for (const it of items) {
    const numbered = it.kind === "p" && !it.text.startsWith("**") && NUMBER_ITEM_RE.exec(it.text);
    if (numbered) {
      it.kind = "li";
      it.ordered = true;
      // Keep the number that was actually written. Steps separated by prose
      // become several one-item lists, and renumbering each from one published
      // a six-step process as "1." six times over.
      it.number = Number(/\d+/.exec(numbered[0])[0]);
      it.text = it.text.replace(NUMBER_ITEM_RE, "");
    }
  }

  const blocks = assembleBlocks(items);
  const sourcesText = sources.join("\n\n");
  if (!blocks.length) warnings.push("The PDF was read, but no article text was found in it.");

  return {
    title: titleCase(title, vocab),
    subtitle: sentenceCase(subtitle, vocab),
    blocks,
    sources: sourcesText,
    disclosures: disclosures.join("\n\n"),
    reviewedDate: findReviewedDate(sourcesText) || findReviewedDate(disclosures.join(" ")),
    pageCount: pdf.numPages,
    warnings,
  };
}
