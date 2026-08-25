export const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const YEAR_COLORS = ["#0ea5a5", "#3548c7", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#059669"];
export const PERIOD_TYPES = [
  ["month", "חודשי"],
  ["quarter", "רבעוני"],
  ["half", "חצי שנתי"],
  ["year", "שנתי"],
];

export function periodLabelsFor(type) {
  if (type === "month") return MONTH_NAMES;
  if (type === "quarter") return ["רבעון 1", "רבעון 2", "רבעון 3", "רבעון 4"];
  if (type === "half") return ["מחצית ראשונה", "מחצית שנייה"];
  return ["השנה כולה"];
}
export function periodIndexFor(type, date) {
  const m = date.getMonth();
  if (type === "month") return m;
  if (type === "quarter") return Math.floor(m / 3);
  if (type === "half") return m < 6 ? 0 : 1;
  return 0;
}
