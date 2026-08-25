import Papa from "papaparse";

// Shared by every "ייצוא לאקסל" button — a .csv Excel opens natively, no extra library needed
// beyond papaparse (already a dependency for the CSV import side).
export function downloadCsv(filename, rows) {
  const csv = Papa.unparse(rows);
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
