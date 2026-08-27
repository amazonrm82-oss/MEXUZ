import Papa from "papaparse";

// CSV/formula injection guard: a cell starting with =, +, -, @ (or tab/CR) is parsed as a
// formula by Excel/Sheets when the file is opened — and these rows can contain values a lead
// typed into a public webhook, not just what a rep typed. Prefixing with a single quote forces
// spreadsheet apps to treat it as plain text instead of evaluating it.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
function sanitizeCell(value) {
  if (typeof value !== "string") return value;
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}
function sanitizeRows(rows) {
  return rows.map((row) => {
    if (Array.isArray(row)) return row.map(sanitizeCell);
    const out = {};
    for (const key of Object.keys(row)) out[key] = sanitizeCell(row[key]);
    return out;
  });
}

// Shared by every "ייצוא לאקסל" button — a .csv Excel opens natively, no extra library needed
// beyond papaparse (already a dependency for the CSV import side).
export function downloadCsv(filename, rows) {
  const csv = Papa.unparse(sanitizeRows(rows));
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM so Excel shows Hebrew correctly
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
