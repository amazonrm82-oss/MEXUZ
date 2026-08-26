import React from "react";
import { X } from "lucide-react";
import { colors } from "../lib/theme";
import { useLanguage } from "../lib/LanguageContext";
import CalendarView from "../views/CalendarView";

// Opens the exact same full calendar as the main "יומן" tab, scoped to this lead: appointments
// for it are highlighted, a new one created here is pre-linked to it, and both ways to schedule
// stay available — click an open slot on the grid, or the "פגישה חדשה" button at the top for
// manual date/time entry.
export default function AppointmentPickerModal({ lead, profile, profiles, leads, showToast, openLead, onClose }) {
  const { t } = useLanguage();

  function openLinkedLead(id) {
    onClose();
    openLead(id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ width: "min(1100px, 96vw)", height: "92vh", background: colors.bg, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t("קביעת פגישה עבור")} {lead.name}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <CalendarView
            profile={profile}
            profiles={profiles}
            leads={leads}
            showToast={showToast}
            openLead={openLinkedLead}
            presetLeadId={lead.id}
            presetTitle={`${t("פגישה עם")} ${lead.name}`}
            calendarHeight="100%"
          />
        </div>
      </div>
    </div>
  );
}
