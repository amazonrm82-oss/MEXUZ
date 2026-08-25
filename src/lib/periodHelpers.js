export const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const YEAR_COLORS = ["#7a8a5e", "#c67139", "#4b8fa8", "#8a6fae", "#b3261e", "#6b6b6b", "#c9a227"];
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
