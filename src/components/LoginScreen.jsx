import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { useLanguage } from "../lib/LanguageContext";
import { colors, inputStyle, buttonPrimary } from "../lib/theme";

const REMEMBERED_USERNAME_KEY = "crm-remembered-username";

export default function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const rememberedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY) || "";
  const [username, setUsername] = useState(rememberedUsername);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!rememberedUsername);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await login(username.trim(), password, t);
    setSubmitting(false);
    if (error) { setError(error); return; }
    if (remember) localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
    else localStorage.removeItem(REMEMBERED_USERNAME_KEY);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, fontFamily: "sans-serif", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 32, borderRadius: 16, width: 320, maxWidth: "100%", boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 26, fontWeight: 800, textAlign: "center", marginBottom: 4 }}>MEXUZ</div>
        <div style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 20 }}>{t("CRM - מערכת לידים")}</div>
        <input
          placeholder={t("שם משתמש")} value={username} onChange={(e) => setUsername(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }} autoFocus={!rememberedUsername}
        />
        <input
          type="password" placeholder={t("סיסמה")} value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }} autoFocus={!!rememberedUsername}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: colors.mutedText, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          {t("זכור אותי")}
        </label>
        {error && <div style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ ...buttonPrimary, width: "100%" }}>
          {submitting ? t("מתחבר…") : t("כניסה")}
        </button>
      </form>
    </div>
  );
}
