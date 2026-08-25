import React from "react";
import { Repeat } from "lucide-react";
import { colors, buttonPrimary } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useLanguage } from "../lib/LanguageContext";

// Pops up once per login when the user has leads sitting in "פולואפ" assigned to them, so a
// follow-up backlog can't quietly go stale between sessions.
export default function FollowUpPopup({ leads, onOpenLead, onClose }) {
  const { t } = useLanguage();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 440, maxWidth: "92%", background: "#fff", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Repeat size={20} color="#8a6fae" />
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {leads.length === 1 ? t("יש לך ליד אחד בפולואפ") : `${t("יש לך")} ${leads.length} ${t("לידים בפולואפ")}`}
          </div>
        </div>
        <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto" }}>
          {leads.map((l) => (
            <div
              key={l.id}
              onClick={() => { onOpenLead(l.id); onClose(); }}
              style={{ background: colors.bg, borderRadius: 10, padding: 12, cursor: "pointer" }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 12.5 }}>· {l.business_name}</span></div>
              <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>{l.phone} · {t("התקבל")} {fmtDate(l.received_at)}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ ...buttonPrimary, width: "100%", marginTop: 16 }}>{t("הבנתי")}</button>
      </div>
    </div>
  );
}
