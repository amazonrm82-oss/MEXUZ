import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import { useLanguage } from "../lib/LanguageContext";
import { colors, inputStyle, buttonPrimary } from "../lib/theme";

// Shown instead of the app whenever the session is at aal1 but the account has a verified TOTP
// factor (i.e. password was correct but the 6-digit code hasn't been entered yet this session).
export default function MfaChallengeScreen() {
  const { logout, refreshMfaStatus } = useAuth();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (!factor) { setBusy(false); setError(t("לא נמצא אימות דו-שלבי פעיל")); return; }
    const { data: challenge, error: challErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challErr) { setBusy(false); setError(t("שגיאה ביצירת אתגר האימות")); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyErr) { setError(t("קוד שגוי")); return; }
    await refreshMfaStatus();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, fontFamily: "sans-serif", padding: 16 }}>
      <form onSubmit={verify} style={{ background: "#fff", padding: 32, borderRadius: 16, width: 320, maxWidth: "100%", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>{t("אימות דו-שלבי")}</div>
        <div style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 20 }}>{t("הזיני את הקוד מאפליקציית האימות")}</div>
        <input
          placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} autoFocus
          inputMode="numeric" maxLength={6} style={{ ...inputStyle, marginBottom: 10, textAlign: "center", letterSpacing: 4, fontSize: 18 }}
        />
        {error && <div style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={busy || code.length < 6} style={{ ...buttonPrimary, width: "100%", marginBottom: 10 }}>
          {busy ? t("בודק…") : t("אימות")}
        </button>
        <button type="button" onClick={logout} style={{ border: "none", background: "none", color: colors.muted, fontSize: 12.5, width: "100%", cursor: "pointer" }}>
          {t("חזרה להתחברות")}
        </button>
      </form>
    </div>
  );
}
