import React, { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { colors, panelStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { pushSupported, pushStatus, enablePush, disablePush } from "../lib/push";
import { useLanguage } from "../lib/LanguageContext";

// Lets a user opt into real push notifications for their tasks/reminders — these arrive even
// when the app isn't open, unlike the in-tab toasts useTaskAlerts already shows. Needs
// migration 0008 + the send-task-push Edge Function + pg_cron deployed to actually fire.
export default function NotificationsToggle({ profile }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("checking"); // checking | unsupported | denied | disabled | enabled
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) { setStatus("unsupported"); return; }
    pushStatus().then(setStatus);
  }, []);

  async function toggle() {
    setBusy(true);
    if (status === "enabled") {
      await disablePush();
      setStatus("disabled");
    } else {
      const { error } = await enablePush(profile.id);
      setStatus(error ? "denied" : "enabled");
    }
    setBusy(false);
  }

  if (status === "checking") return null;

  return (
    <div style={{ ...panelStyle, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {status === "enabled" ? <Bell size={20} color={colors.accent} /> : <BellOff size={20} color={colors.muted} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{t("התראות דחיפה למשימות ותזכורות")}</div>
          <div style={{ fontSize: 11.5, color: colors.mutedText, marginTop: 2 }}>
            {status === "unsupported" && t("הדפדפן הזה לא תומך בהתראות דחיפה.")}
            {status === "denied" && t("ההרשאה נחסמה בדפדפן — יש לאפשר התראות להאתר בהגדרות הדפדפן.")}
            {status === "enabled" && t("מופעל — תזכורות ומשימות יגיעו גם כשהאתר סגור.")}
            {status === "disabled" && t("כרגע כבוי — תזכורות יופיעו רק כשהאתר פתוח בדפדפן.")}
          </div>
        </div>
      </div>
      {(status === "enabled" || status === "disabled") && (
        <button onClick={toggle} disabled={busy} style={status === "enabled" ? buttonGhost : buttonPrimary}>
          {busy ? t("רגע…") : status === "enabled" ? t("כבה התראות") : t("הפעל התראות")}
        </button>
      )}
    </div>
  );
}
