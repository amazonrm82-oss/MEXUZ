import React, { useState } from "react";
import { Apple, Smartphone, Share, PlusSquare, MoreVertical, Download } from "lucide-react";
import { colors, panelStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { useLanguage } from "../lib/LanguageContext";
import NotificationsToggle from "../components/NotificationsToggle";

export default function DownloadView({ profile }) {
  const { t } = useLanguage();
  const [platform, setPlatform] = useState(null);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{t("הורדת האפליקציה")}</div>
      <div style={{ fontSize: 13, color: colors.mutedText, marginBottom: 20 }}>
        {t("אפשר להתקין את המערכת כאפליקציה על מסך הבית של הטלפון — נפתחת כמו אפליקציה רגילה, בלי סרגל הכתובת של הדפדפן.")}
      </div>

      <NotificationsToggle profile={profile} />

      {!platform ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <button onClick={() => setPlatform("ios")} style={{ ...panelStyle, cursor: "pointer", width: 200, textAlign: "center", border: "none" }}>
            <Apple size={34} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>iPhone (iOS)</div>
          </button>
          <button onClick={() => setPlatform("android")} style={{ ...panelStyle, cursor: "pointer", width: 200, textAlign: "center", border: "none" }}>
            <Smartphone size={34} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>Android</div>
          </button>
        </div>
      ) : platform === "ios" ? (
        <IosInstructions onBack={() => setPlatform(null)} t={t} />
      ) : (
        <AndroidInstall onBack={() => setPlatform(null)} t={t} />
      )}
    </div>
  );
}

function StepCard({ number, icon, children }) {
  return (
    <div style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: colors.bg, color: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
        {number}
      </div>
      {icon}
      <div style={{ fontSize: 13.5 }}>{children}</div>
    </div>
  );
}

function IosInstructions({ onBack, t }) {
  return (
    <div style={{ maxWidth: 460 }}>
      <button onClick={onBack} style={{ ...buttonGhost, marginBottom: 14 }}>← {t("חזרה")}</button>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>{t("התקנה באייפון (Safari)")}</div>
      <StepCard number={1} icon={null}>{t("פתחו את האתר הזה דרך דפדפן")} <b>Safari</b> ({t("לא כרום")}).</StepCard>
      <StepCard number={2} icon={<Share size={20} color={colors.accent} />}>{t("לחצו על כפתור")} <b>{t("השיתוף")}</b> {t("בתחתית המסך (ריבוע עם חץ כלפי מעלה).")}</StepCard>
      <StepCard number={3} icon={<PlusSquare size={20} color={colors.accent} />}>{t("גללו למטה ובחרו")} <b>"{t("הוסף למסך הבית")}"</b> (Add to Home Screen).</StepCard>
      <StepCard number={4} icon={null}>{t("לחצו")} <b>"{t("הוסף")}"</b> {t("בפינה — האייקון יופיע במסך הבית כמו אפליקציה רגילה.")}</StepCard>
    </div>
  );
}

function AndroidInstall({ onBack, t }) {
  const [status, setStatus] = useState("idle");

  async function install() {
    const promptEvent = window.__deferredPwaPrompt;
    if (!promptEvent) { setStatus("manual"); return; }
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.__deferredPwaPrompt = null;
    setStatus(choice.outcome === "accepted" ? "installed" : "manual");
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <button onClick={onBack} style={{ ...buttonGhost, marginBottom: 14 }}>← {t("חזרה")}</button>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>{t("התקנה באנדרואיד (Chrome)")}</div>

      <button onClick={install} style={{ ...buttonPrimary, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Download size={17} /> {t("התקן עכשיו")}
      </button>

      {status === "installed" && <div style={{ color: colors.accent, fontWeight: 700, marginBottom: 12 }}>{t("ההתקנה הושלמה! חפשו את האייקון במסך הבית.")}</div>}

      {status === "manual" && (
        <>
          <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 12 }}>
            {t("ההתקנה האוטומטית לא זמינה כרגע (ייתכן שכבר מותקן, או שהדפדפן לא תומך) — אפשר להתקין ידנית:")}
          </div>
          <StepCard number={1} icon={<MoreVertical size={20} color={colors.accent} />}>{t("לחצו על שלוש הנקודות בפינה הימנית העליונה של כרום.")}</StepCard>
          <StepCard number={2} icon={null}>{t("בחרו")} <b>"{t("התקן אפליקציה")}"</b> {t("או")} <b>"{t("הוסף למסך הבית")}"</b>.</StepCard>
          <StepCard number={3} icon={null}>{t("אשרו — האייקון יופיע במסך הבית.")}</StepCard>
        </>
      )}
    </div>
  );
}
