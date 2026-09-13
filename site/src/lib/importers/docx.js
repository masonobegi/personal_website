import {
  addAcronyms,
  assembleBlocks,
  buildVocabulary,
  findReviewedDate,
  sentenceCase,
  titleCase,
  DISCLOSURE_HEADING,
  SOURCES_HEADING,
  looksLikeHeading,
} from "@/lib/importers/common";

// -----------------------------------------------------------------------------
//  Word (.docx) → article.
//
//  mammoth reads the document's real structure — Heading 1/2/3 styles, lists,
//  bold/italic, links, tables, pictures — and emits simple HTML, which is
//  converted here into article blocks. Pictures are stored in the media store
//  through `saveImage`. Documents that fake headings with bold one-line
//  paragraphs (common) get those promoted to headings too.
// -----------------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// The importer marks emphasis with asterisks, so an asterisk that came from
// the document itself is indistinguishable from one of ours — a footnote
// marker like "Fees apply*" was read as an unclosed italic and deleted, and
// the reference went with it. Swapped for the typographic asterisk, which
// looks the same and means nothing to the formatter.
const LITERAL_ASTERISK = "∗";
function keepLiteralAsterisks(text) {
  return text.split("*").join(LITERAL_ASTERISK);
}

const attr = (attrs, name) => {
  const m = new RegExp(`${name}="([^"]*)"`, "i").exec(attrs || "");
  return m ? decode(m[1]) : "";
};

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function tidyInline(s) {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

// Walks mammoth's HTML (flat block elements, lists, tables) into items for
// assembleBlocks.
function htmlToItems(html) {
  const items = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  let buf = "";
  let linkStart = -1;
  let linkHref = "";
  const listStack = []; // { ordered }
  let inCell = false;
  let row = [];
  let tableRows = null;
  let blockTag = null; // p | h1..h6 | li
  let blockClass = "";
  const marks = []; // open bold/italic: { tag, at }

  // Bold/italic become **…** / *…*. Markers are only written around text
  // that actually exists, with surrounding spaces kept outside them — "**Bold
  // **text" or an empty "****" would render as stray asterisks.
  const openMark = (tag) => marks.push({ tag, at: buf.length });
  const closeMark = (tag) => {
    const idx = marks.map((m) => m.tag).lastIndexOf(tag);
    if (idx < 0) return;
    const { at } = marks.splice(idx, 1)[0];
    const inner = buf.slice(at);
    const core = inner.trim();
    if (!core) return;
    // Bold around italic becomes ***both***; any other nesting stays plain.
    if (core.includes("*") && !(tag === "b" && /^\*[^*]+\*$/.test(core))) return;
    const lead = inner.match(/^\s*/)[0];
    const trail = inner.match(/\s*$/)[0];
    const mark = tag === "b" ? "**" : "*";
    buf = `${buf.slice(0, at)}${lead}${mark}${core}${mark}${trail}`;
  };

  const endBlock = () => {
    marks.length = 0;
    const text = tidyInline(buf);
    buf = "";
    if (inCell) {
      if (text) row.push(text);
      return;
    }
    if (!text) return;
    if (blockTag === "li") {
      items.push({ kind: "li", text, ordered: listStack[listStack.length - 1]?.ordered });
    } else if (/^h[1-6]$/.test(blockTag || "")) {
      items.push({ kind: "heading", tag: blockTag, text: text.replace(/\*+/g, "") });
    } else {
      items.push({ kind: "p", text, cls: blockClass });
    }
  };

  for (const tok of tokens) {
    if (tok[0] !== "<") {
      buf += keepLiteralAsterisks(decode(tok));
      continue;
    }
    const m = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>/i.exec(tok);
    if (!m) continue;
    const closing = Boolean(m[1]);
    const tag = m[2].toLowerCase();
    const attrs = m[3];

    switch (tag) {
      case "p":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        if (closing) {
          endBlock();
          blockTag = null;
        } else {
          if (buf.trim()) endBlock();
          buf = "";
          // Inside a list item, a <p> continues the item rather than starting
          // a new block.
          blockTag = listStack.length && tag === "p" ? "li" : tag;
          blockClass = attr(attrs, "class");
        }
        break;
      case "li":
        if (closing) {
          if (buf.trim()) endBlock();
          blockTag = listStack.length ? "li" : null;
        } else {
          if (buf.trim()) endBlock();
          blockTag = "li";
        }
        break;
      case "ul":
      case "ol":
        if (closing) {
          if (buf.trim()) endBlock();
          listStack.pop();
        } else {
          if (buf.trim()) endBlock();
          listStack.push({ ordered: tag === "ol" });
        }
        break;
      case "strong":
      case "b":
        if (closing) closeMark("b");
        else openMark("b");
        break;
      case "em":
      case "i":
        if (closing) closeMark("i");
        else openMark("i");
        break;
      case "br":
        buf += "\n";
        break;
      case "a":
        if (!closing) {
          linkStart = buf.length;
          linkHref = attr(attrs, "href");
        } else if (linkStart >= 0) {
          const label = buf.slice(linkStart).replace(/\*+/g, "").trim();
          // The arrow Word puts at the end of a footnote to jump back to
          // where it was referenced. It means nothing on a web page, and was
          // being published as a stray character at the end of every note.
          if (/^#(foot|end)note-ref-/.test(linkHref || "")) {
            buf = buf.slice(0, linkStart);
          } else {
            buf =
              buf.slice(0, linkStart) +
              (label && SAFE_LINK.test(linkHref) ? `[${label}](${linkHref})` : label);
          }
          linkStart = -1;
        }
        break;
      case "img": {
        const src = attr(attrs, "src");
        if (src) {
          if (buf.trim() && !inCell) endBlock();
          items.push({
            kind: "image",
            src,
            alt: attr(attrs, "alt"),
            width: attr(attrs, "width") || undefined,
            height: attr(attrs, "height") || undefined,
          });
        }
        break;
      }
      case "table":
        if (!closing) {
          if (buf.trim()) endBlock();
          tableRows = [];
        } else if (tableRows) {
          // Tables become one line per row: "Cell · Cell · Cell".
          const text = tableRows.filter((r) => r.length).map((r) => r.join(" · ")).join("\n");
          if (text) items.push({ kind: "p", text });
          tableRows = null;
        }
        break;
      case "tr":
        if (!closing) row = [];
        else if (tableRows) tableRows.push(row);
        break;
      case "td":
      case "th":
        if (!closing) {
          inCell = true;
          buf = "";
        } else {
          endBlock();
          inCell = false;
        }
        break;
      default:
        break; // sup, sub, span, etc: keep the text, drop the tag
    }
  }
  if (buf.trim()) endBlock();
  return items;
}

// A .docx is a zip. The limit on the upload bounds the compressed file, not
// what comes out of it — and the text inside costs roughly sixty times its own
// size in memory to convert. A twenty megabyte document.xml was measured at
// 1.4 GB, and a larger one took the whole process down. The uncompressed size
// is written in the zip's own directory, so it can be read without unpacking
// anything.
const MAX_DOCUMENT_XML = 25 * 1024 * 1024;

// Finds the uncompressed size of word/document.xml from the zip central
// directory. Returns null when the structure is not what we expect, in which
// case the caller carries on — this is a guard, not a validator.
function documentXmlSize(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const needle = Buffer.from("word/document.xml", "latin1");
  let at = buf.indexOf(needle);
  while (at !== -1) {
    // A central directory entry puts the name 46 bytes after the record start,
    // with the uncompressed size 24 bytes in.
    const header = at - 46;
    if (header >= 0 && buf.readUInt32LE(header) === 0x02014b50) {
      const size = buf.readUInt32LE(header + 24);
      if (size > 0) return size;
    }
    at = buf.indexOf(needle, at + 1);
  }
  return null;
}

// A paragraph that is bold from end to end and nothing else.
const BOLD_ONLY_LINE = /^\*\*([^*\n]{2,110})\*\*$/;

export async function importDocx(buffer, { saveImage } = {}) {
  const declared = documentXmlSize(buffer);
  if (declared && declared > MAX_DOCUMENT_XML) {
    return {
      title: "",
      subtitle: "",
      blocks: [],
      sources: "",
      disclosures: "",
      reviewedDate: "",
      warnings: [
        `There is too much text in this document for the importer to take (about ${Math.round(declared / 1024 / 1024)} MB of it). Split it up, or import the part you want as its own file.`,
      ],
    };
  }

  const mammoth = (await import("mammoth")).default;
  const warnings = [];
  let skippedImages = 0;

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => p.subtitle:fresh",
        "p[style-name='Quote'] => p:fresh",
        "p[style-name='Intense Quote'] => p:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          if (!saveImage || !/^image\/(png|jpe?g|gif|webp)$/i.test(image.contentType)) {
            skippedImages++;
            return { src: "" };
          }
          const bytes = Buffer.from(await image.read("base64"), "base64");
          const saved = await saveImage(bytes, image.contentType.replace("jpg", "jpeg"));
          // The stored size travels with it. Without a width and a height the
          // page has to guess, and everything below the picture jumps when it
          // finally loads.
          return {
            src: saved?.url || "",
            alt: image.altText || "",
            ...(saved?.width
              ? { width: String(saved.width), height: String(saved.height) }
              : {}),
          };
        } catch {
          skippedImages++;
          return { src: "" };
        }
      }),
    }
  );

  if (skippedImages) {
    warnings.push(
      `${skippedImages} picture${skippedImages === 1 ? "" : "s"} couldn't be imported (charts and drawings saved in Word's own format). Add them as images in the editor if needed.`
    );
  }

  let items = htmlToItems(result.value);

  // ---- Title / subtitle -----------------------------------------------------
  let title = "";
  let subtitle = "";
  const titleIdx = items.findIndex((it) => it.kind === "heading" && it.tag === "h1");
  if (titleIdx >= 0 && titleIdx <= 2) {
    title = items[titleIdx].text;
    items.splice(titleIdx, 1);
  }
  const subIdx = items.findIndex((it) => it.cls === "subtitle");
  if (subIdx >= 0 && subIdx <= 2) {
    subtitle = items[subIdx].text.replace(/\*+/g, "");
    items.splice(subIdx, 1);
  }

  // ---- Fake headings: a short paragraph that is entirely bold ---------------
  //
  // A bold line is usually a heading someone styled by hand rather than with a
  // heading style. But a bolded sentence is not: firms bold their compliance
  // lines, and "Past performance is no guarantee of future results" was
  // becoming a section heading in the middle of an article. A length limit
  // does not separate the two — that sentence is fifty characters.
  const hasRealHeadings = items.some((it) => it.kind === "heading");
  items = items.map((it) => {
    const m = it.kind === "p" && BOLD_ONLY_LINE.exec(it.text);
    if (m && looksLikeHeading(m[1].trim())) {
      return {
        kind: "heading",
        tag: hasRealHeadings ? "h3" : "h2",
        text: m[1].trim(),
        // Marked so the section split below knows this was our decision, not
        // the document's.
        promoted: true,
      };
    }
    return it;
  });

  // ---- Heading levels, sources, disclosures -----------------------------------
  const vocab = buildVocabulary(items.filter((it) => it.kind === "p").map((it) => it.text));
  // Same as the PDF path: learn the acronyms this document uses from its
  // ordinary sentences, so re-casing an all-capitals heading does not write
  // "esPP" or "says iso".
  addAcronyms(vocab, items.map((it) => it.text));
  const body = [];
  const sources = [];
  const disclosures = [];
  let mode = "body";
  for (const it of items) {
    if (it.kind === "heading") {
      const text = it.text.trim();
      if (DISCLOSURE_HEADING.test(text)) {
        mode = "disclosures";
        continue;
      }
      if (SOURCES_HEADING.test(text)) {
        mode = "sources";
        continue;
      }
      // Only a heading the document itself declares ends the small print. A
      // bold line we decided to promote must not: the disclosures panel of a
      // white paper has bold sub-labels in it ("Risk Considerations",
      // "Tracking Number"), and treating those as the start of a new section
      // pushed the rest of the required disclosures into the article body.
      if (mode !== "body" && it.promoted) {
        (mode === "disclosures" ? disclosures : sources).push(`**${text}**`);
        continue;
      }
      mode = "body";
      // h1s after the title and h2s are sections; anything deeper is a
      // sub-section. Articles only use two levels.
      const level = it.tag === "h1" || it.tag === "h2" ? 2 : 3;
      body.push({ kind: "heading", level, text: titleCase(text, vocab) });
      continue;
    }
    if (mode === "disclosures" && it.kind !== "image") {
      disclosures.push(it.kind === "li" ? `- ${it.text}` : it.text);
      continue;
    }
    if (mode === "sources" && it.kind !== "image") {
      sources.push(it.kind === "li" ? `- ${it.text}` : it.text);
      continue;
    }
    body.push(it);
  }

  const sourcesText = sources.join("\n\n");
  const blocks = assembleBlocks(body);
  if (!blocks.length) warnings.push("No text was found in this document.");

  return {
    title: titleCase(title, vocab),
    subtitle: sentenceCase(subtitle, vocab),
    blocks,
    sources: sourcesText,
    disclosures: disclosures.join("\n\n"),
    reviewedDate: findReviewedDate(sourcesText) || findReviewedDate(disclosures.join(" ")),
    warnings,
  };
}
