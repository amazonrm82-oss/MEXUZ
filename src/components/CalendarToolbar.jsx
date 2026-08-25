import React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { colors } from "../lib/theme";
import { useLanguage } from "../lib/LanguageContext";

const VIEW_LABELS = { month: "חודש", week: "שבוע", day: "יום", agenda: "רשימה" };

// Replaces react-big-calendar's default toolbar with something closer to Google Calendar's:
// a "Today" pill, prev/next arrows, a large label, and a segmented view switcher.
export default function CalendarToolbar({ label, onNavigate, onView, view, views }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onNavigate("TODAY")} style={pillStyle}>{t("היום")}</button>
        <button onClick={() => onNavigate("PREV")} style={iconBtnStyle}><ChevronRight size={16} /></button>
        <button onClick={() => onNavigate("NEXT")} style={iconBtnStyle}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 17, fontWeight: 800, marginInlineStart: 6 }}>{label}</span>
      </div>
      <div style={{ display: "flex", gap: 2, background: colors.bg, borderRadius: 10, padding: 3 }}>
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5,
              background: view === v ? "#fff" : "transparent", fontWeight: view === v ? 700 : 500,
              color: colors.text, boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.15)" : "none",
            }}
          >
            {t(VIEW_LABELS[v]) || v}
          </button>
        ))}
      </div>
    </div>
  );
}

const pillStyle = {
  padding: "7px 16px", borderRadius: 20, border: `1px solid ${colors.border}`, background: "#fff",
  cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: colors.text,
};
const iconBtnStyle = {
  border: "none", background: "none", cursor: "pointer", color: colors.mutedText,
  display: "flex", padding: 6, borderRadius: "50%",
};
