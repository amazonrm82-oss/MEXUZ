export const LEAD_STATUS_BASE = ["ליד חדש", "ליד איכותי", "לקוח עבר"];
export const PROCESS_STATUS_OPTIONS = [
  "ליד ראשוני", "בוצע שיחה ראשונית", "נשלח הצעת מחיר", "פולואפ", "אין מענה ראשון", "אין מענה שני", "אין מענה שלישי",
  "המחיר יקר", "היקף הפרויקט לא מתאים", "מספר שגוי", "לא מעוניין",
];
export const CHANNELS = ["פייסבוק", "אינסטגרם", "לינקדאין", "אתר האינטרנט", "המלצה", "ייבוא"];
export const OPS_STATUS_OPTIONS = [
  "באפיון", "באישור הצעה", "ממתין תשלום מקדמה", "בפיתוח", "ממתין המשך תשלום", "בבדיקות ומסירה", "נמסר ללקוח",
];
export const ROLE_OPTIONS = ["נציג חול", "נציג רגיל", "סגן", "מנהל"];
export const TWO_WEEKS_MS = 14 * 24 * 3600 * 1000;
export const MEETING_BUFFER_MS = 60 * 60 * 1000;
export const UNCLAIMED_ALERT_MS = 72 * 3600 * 1000;
export const STUCK_LEAD_MS = 7 * 24 * 3600 * 1000;

export const REMIND_BEFORE_OPTIONS = [
  [0, "בזמן היעד בלבד"],
  [10, "10 דקות לפני"],
  [30, "חצי שעה לפני"],
  [60, "שעה לפני"],
  [180, "3 שעות לפני"],
  [1440, "יום לפני"],
  [2880, "יומיים לפני"],
  [10080, "שבוע לפני"],
];

export function commissionRateFor(role) {
  return role === "נציג חול" ? 0.5 : 0.06;
}

const US_STATES_HE = [
  'ארה"ב', "ארהב", "אלבמה", "אלסקה", "אריזונה", "ארקנסו", "קליפורניה", "קולורדו", "קונטיקט", "דלאוור",
  "פלורידה", "ג'ורג'יה", "הוואי", "איידהו", "אילינוי", "אינדיאנה", "איווה", "קנזס", "קנטקי", "לואיזיאנה",
  "מיין", "מרילנד", "מסצ'וסטס", "מישיגן", "מינסוטה", "מיסיסיפי", "מיזורי", "מונטנה", "נברסקה", "נבאדה",
  "ניו המפשייר", "ניו ג'רזי", "ניו מקסיקו", "ניו יורק", "צפון קרוליינה", "צפון דקוטה", "אוהיו", "אוקלהומה",
  "אורגון", "פנסילבניה", "רוד איילנד", "דרום קרוליינה", "דרום דקוטה", "טנסי", "טקסס", "יוטה", "ורמונט",
  "וירג'יניה", "וושינגטון", "מערב וירג'יניה", "ויסקונסין", "וויומינג",
];
const US_TOKENS_EN = [
  "usa", "u.s.a", "u.s.a.", "us", "u.s.", "united states", "united states of america", "america",
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
  "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
  "wisconsin", "wyoming",
];

// Used only client-side, at lead creation/import time, to compute the is_international column
// that RLS then relies on — the DB never re-derives this from free-text country strings.
export function isUSCountryValue(countryValue) {
  const raw = (countryValue || "").trim();
  if (!raw) return false;
  if (US_STATES_HE.includes(raw)) return true;
  const lower = raw.toLowerCase();
  return US_TOKENS_EN.some((t) => lower.includes(t));
}
