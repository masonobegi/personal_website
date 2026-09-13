// -----------------------------------------------------------------------------
//  A one-page, branded "thank you for downloading" PDF, written directly (no
//  PDF library). It's what a landing page hands out until the firm uploads the
//  real guide in the dashboard.
//
//  Uses the PDF standard fonts (Helvetica, Times), so nothing is embedded and
//  the file is a few KB. Text is WinAnsi-encoded, which covers the curly
//  quotes, dashes, ® and © the firm's copy uses.
// -----------------------------------------------------------------------------

const WIN_ANSI = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "•": 0x95, "–": 0x96, "—": 0x97,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "™": 0x99,
};

// A PDF string literal, WinAnsi-encoded with octal escapes.
function pdfString(s) {
  let out = "(";
  for (const ch of String(s)) {
    let code = WIN_ANSI[ch] ?? ch.codePointAt(0);
    if (code > 255) code = 0x3f; // "?" for anything WinAnsi can't show
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `${out})`;
}

// Rough word wrap from an average glyph width (good enough for one page of
// prose in Times/Helvetica).
function wrap(text, size, width, avg = 0.47) {
  const maxChars = Math.floor(width / (size * avg));
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if ((line + " " + word).length <= maxChars) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function thankYouPdf({ firm = "Oswego Legacy Partners", title = "", site = "", phone = "", email = "", disclosure = "" }) {
  const W = 612;
  const H = 792;
  const M = 72; // margins
  const ops = [];
  const text = (font, size, x, y, s, rgb = "0.137 0.137 0.122") =>
    ops.push(`BT ${rgb} rg /${font} ${size} Tf ${x} ${y} Td ${pdfString(s)} Tj ET`);

  // Forest band with the firm name.
  ops.push("0.078 0.125 0.102 rg 0 692 612 100 re f");
  ops.push("0.635 0.522 0.310 rg 0 690 612 2 re f");
  text("F1", 11, M, 736, firm.toUpperCase().split("").join(" "), "0.761 0.671 0.494");

  let y = 620;
  text("F3", 13, M, y, "Thank you for downloading", "0.635 0.522 0.310");
  y -= 38;
  for (const line of wrap(title || `${firm} Guide`, 26, W - 2 * M, 0.5)) {
    text("F2", 26, M, y, line);
    y -= 32;
  }
  y -= 14;

  const body = [
    `Thank you for requesting this guide from ${firm}. We're glad you're here.`,
    "Every financial decision is connected to the others: equity awards, taxes, retirement income, and the people your wealth is meant to support. When you're ready to talk through your own situation, we'd welcome a conversation. There is no cost and no obligation.",
  ];
  for (const para of body) {
    for (const line of wrap(para, 12.5, W - 2 * M)) {
      text("F2", 12.5, M, y, line, "0.333 0.333 0.298");
      y -= 18;
    }
    y -= 10;
  }

  y -= 8;
  ops.push(`0.635 0.522 0.310 rg ${M} ${y + 6} 54 1 re f`);
  y -= 18;
  if (site) {
    text("F1", 10, M, y, "SCHEDULE A CONVERSATION", "0.635 0.522 0.310");
    y -= 17;
    text("F2", 12.5, M, y, `${site.replace(/^https?:\/\//, "")}/intake`);
    y -= 26;
  }
  const contact = [phone, email].filter(Boolean).join("   •   ");
  if (contact) {
    text("F2", 12, M, y, contact, "0.333 0.333 0.298");
    y -= 20;
  }

  // The full regulatory disclosure at the foot of the page, built upward from
  // the copyright line so it's never cut short.
  const discLines = wrap(disclosure, 7.5, W - 2 * M, 0.5).slice(0, 22);
  let fy = 50 + discLines.length * 10;
  for (const line of discLines) {
    text("F2", 7.5, M, fy, line, "0.45 0.45 0.42");
    fy -= 10;
  }
  text("F2", 7.5, M, 34, `© ${new Date().getFullYear()} ${firm}. All rights reserved.`, "0.45 0.45 0.42");

  const content = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfString(title || firm)} /Author ${pdfString(firm)} /Creator ${pdfString(firm)} >>`,
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
