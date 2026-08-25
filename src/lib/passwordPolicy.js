// Shared everywhere a password gets set: signup (Settings → ניהול משתמשים) and self-service
// change (Settings → שינוי סיסמה). Returns an error string, or null if the password is valid.
export function validatePassword(pw) {
  if (!pw || pw.length < 8 || pw.length > 16) return "הסיסמה חייבת להכיל בין 8 ל-16 תווים";
  if (!/[A-Z]/.test(pw)) return "הסיסמה חייבת לכלול לפחות אות גדולה אחת (A-Z)";
  if (!/[a-z]/.test(pw)) return "הסיסמה חייבת לכלול לפחות אות קטנה אחת (a-z)";
  if (!/[0-9]/.test(pw)) return "הסיסמה חייבת לכלול לפחות ספרה אחת (0-9)";
  return null;
}
