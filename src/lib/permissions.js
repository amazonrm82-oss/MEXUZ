// Mirrors the RLS/trigger rules in supabase/migrations/0001_init.sql. This file only controls
// what the UI shows — the database is the real enforcement layer, so nothing here needs to be
// trusted for security.

export function canActLikeManager(profile) {
  return !!profile && (profile.is_super_admin || profile.role === "סגן" || profile.role === "מנהל");
}
export function canResetSystem(profile) {
  return !!profile && (profile.is_super_admin || profile.role === "מנהל");
}
export function isRegularRep(profile) {
  return !!profile && profile.role === "נציג רגיל";
}
export function isForeignRep(profile) {
  return !!profile && profile.role === "נציג חול";
}
export function canSeePaymentDues(profile) {
  return canActLikeManager(profile) || isRegularRep(profile);
}
// Access to the periodic Reports tab: super admins always, everyone else only if explicitly
// granted (profiles.can_view_reports, toggled from Settings → ניהול משתמשים).
export function canViewReports(profile) {
  return !!profile && (profile.is_super_admin || profile.can_view_reports);
}

// Mirrors the leads_select RLS policy — the server never sends a row this would hide, so this
// is only a client-side belt-and-suspenders filter (harmless no-op in practice).
export function isLeadVisibleForUser(lead, profile) {
  if (!profile) return true;
  if (canActLikeManager(profile)) return true;
  if (isForeignRep(profile)) return !!lead.is_international;
  if (isRegularRep(profile)) return !lead.is_international;
  return true;
}
