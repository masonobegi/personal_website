import { formatText } from "@/lib/formatText";

// Renders admin-entered text with real paragraph + line breaks preserved and
// inline **bold** / *italic* / [link](url) formatting. Blank lines start a new
// paragraph; single newlines inside a paragraph are kept (white-space:
// pre-wrap). A paragraph whose every line starts with "- " (or "1. ") becomes a
// bulleted (or numbered) list. Safe for server components — it only emits
// React nodes, never raw HTML.

const BULLET = /^\s*(?:[-•▪●]|\*(?=\s))\s+/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+/;

function listKind(para) {
  const lines = para.split("\n").filter((l) => l.trim());
  if (!lines.length) return null;
  if (lines.every((l) => BULLET.test(l))) return "ul";
  if (lines.every((l) => NUMBERED.test(l))) return "ol";
  return null;
}

export default function RichText({ text, className, style, pStyle }) {
  const paragraphs = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/); // blank line = paragraph break

  return (
    <div className={className} style={style}>
      {paragraphs.map((para, i) => {
        const margin = i === 0 ? "0" : "1em 0 0";
        const kind = listKind(para);
        if (kind) {
          const Tag = kind;
          const strip = kind === "ul" ? BULLET : NUMBERED;
          const rows = para.split("\n").filter((l) => l.trim());
          // Start from the number that was actually written. A document whose
          // steps are separated by prose becomes several one-line paragraphs,
          // and every one restarted at "1." — so a six-step process was
          // published as "1." six times over.
          const firstNumber =
            kind === "ol" ? Number(/^\s*(\d{1,3})/.exec(rows[0])?.[1]) || 1 : 1;
          return (
            <Tag
              key={i}
              className="rt-list"
              {...(kind === "ol" && firstNumber > 1 ? { start: firstNumber } : {})}
              style={{ margin, ...pStyle }}
            >
              {rows
                .map((line, j) => (
                  <li key={j}>{formatText(line.replace(strip, ""), { links: true })}</li>
                ))}
            </Tag>
          );
        }
        return (
          <p
            key={i}
            style={{
              whiteSpace: "pre-wrap",
              margin,
              ...pStyle,
            }}
          >
            {formatText(para, { links: true })}
          </p>
        );
      })}
    </div>
  );
}
