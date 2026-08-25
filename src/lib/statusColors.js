// Centralized so the Inbox board, the Lead Drawer, and the "not interested" tab all color the
// same status the same way. Anything not listed falls back to a neutral gray.
export const LEAD_STATUS_COLORS = {
  "ליד חדש": "#6b7280",
  "ליד איכותי": "#0ea5a5",
  "לקוח עבר": "#6b7280",
};

export const PROCESS_STATUS_COLORS = {
  "ליד ראשוני": "#6b7280",
  "בוצע שיחה ראשונית": "#3548c7",
  "נשלח הצעת מחיר": "#0ea5a5",
  "פולואפ": "#7c3aed",
  "אין מענה ראשון": "#c9a227",
  "אין מענה שני": "#d97706",
  "אין מענה שלישי": "#dc2626",
  "המחיר יקר": "#6b7280",
  "היקף הפרויקט לא מתאים": "#6b7280",
  "ממתין לאישור": "#a9862e",
};

export function colorFor(map, key) {
  return map[key] || "#6b7280";
}
