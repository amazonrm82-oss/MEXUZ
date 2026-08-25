import jsPDF from "jspdf";
import { RUBIK_FONT_BASE64 } from "./rubikFontBase64";

function isHebrewChar(ch) {
  const code = ch.codePointAt(0);
  return code >= 0x0590 && code <= 0x05ff;
}

// jsPDF only draws left-to-right and doesn't run the Unicode Bidi Algorithm, so plain Hebrew
// text comes out backwards. This does the minimal reordering this table-style content actually
// needs: split into Hebrew vs. non-Hebrew runs, flip the run order (RTL context), and reverse
// characters only *within* Hebrew runs — numbers, punctuation, and ₪ amounts stay in their own
// natural left-to-right order, which is how mixed Hebrew/number text is supposed to read.
function toVisualRTL(text) {
  if (!text) return "";
  const runs = [];
  let current = "";
  let currentIsHebrew = null;
  for (const ch of String(text)) {
    const heb = isHebrewChar(ch);
    if (currentIsHebrew === null || heb === currentIsHebrew) {
      current += ch;
      currentIsHebrew = heb;
    } else {
      runs.push({ text: current, hebrew: currentIsHebrew });
      current = ch;
      currentIsHebrew = heb;
    }
  }
  if (current) runs.push({ text: current, hebrew: currentIsHebrew });
  return runs.reverse().map((r) => (r.hebrew ? [...r.text].reverse().join("") : r.text)).join("");
}

let fontRegistered = false;
function ensureFont(doc) {
  if (!fontRegistered) {
    doc.addFileToVFS("Rubik.ttf", RUBIK_FONT_BASE64);
    doc.addFont("Rubik.ttf", "Rubik", "normal");
    fontRegistered = true;
  }
  doc.setFont("Rubik", "normal");
}

// rows: array of [label, value, emphasize?] — emphasize draws a divider line above and grows
// the font, used for the total line.
export function downloadQuotePdf({ filename, title, subtitle, rows, footer }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  ensureFont(doc);
  const rightMargin = 555;
  let y = 60;

  doc.setFontSize(20);
  doc.text(toVisualRTL(title), rightMargin, y, { align: "right" });
  y += subtitle ? 20 : 35;
  if (subtitle) {
    doc.setFontSize(11);
    doc.text(toVisualRTL(subtitle), rightMargin, y, { align: "right" });
    y += 30;
  }

  doc.setFontSize(12);
  rows.forEach(([label, value, emphasize]) => {
    if (emphasize) {
      doc.setLineWidth(1);
      doc.line(40, y - 14, rightMargin, y - 14);
      y += 6;
      doc.setFontSize(15);
    }
    const line = value != null && value !== "" ? `${label}: ${value}` : label;
    doc.text(toVisualRTL(line), rightMargin, y, { align: "right" });
    y += emphasize ? 26 : 20;
    if (emphasize) doc.setFontSize(12);
  });

  if (footer) {
    y += 20;
    doc.setFontSize(10);
    doc.text(toVisualRTL(footer), rightMargin, y, { align: "right" });
  }

  doc.save(filename);
}
