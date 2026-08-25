import React, { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { he } from "date-fns/locale";
import { X } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../views/calendar-theme.css";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { MEETING_BUFFER_MS } from "../lib/constants";
import { useLanguage } from "../lib/LanguageContext";
import CalendarToolbar from "./CalendarToolbar";

const calendarComponents = { toolbar: CalendarToolbar };

const locales = { he };
const localizer = dateFnsLocalizer({
  format, parse, getDay, locales,
  startOfWeek: () => startOfWeek(new Date(), { locale: he }),
});
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function calendarMessagesFor(t) {
  return {
    date: t("תאריך"), time: t("שעה"), event: t("אירוע"), allDay: t("כל היום"), week: t("שבוע"), work_week: t("שבוע עבודה"),
    day: t("יום"), month: t("חודש"), previous: t("הקודם"), next: t("הבא"), yesterday: t("אתמול"), tomorrow: t("מחר"),
    today: t("היום"), agenda: t("רשימה"), noEventsInRange: t("אין פגישות בטווח הזה"), showMore: (n) => `+${n} ${t("נוספות")}`,
  };
}

// A full calendar (all existing appointments, clearly laid out per day) so a rep can see the
// team's schedule before picking a time for this lead — instead of blindly typing a date/time.
export default function AppointmentPickerModal({ lead, profile, onClose, showToast }) {
  const { t, lang } = useLanguage();
  const { rows: appointments } = useRealtimeList("appointments", { orderBy: "date_time", ascending: true });
  const [view, setView] = useState("week");
  const [date, setDate] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState(null);
  const [title, setTitle] = useState(`${t("פגישה עם")} ${lead.name}`);
  const [busy, setBusy] = useState(false);

  const calendarMessages = useMemo(() => calendarMessagesFor(t), [t]);

  const events = useMemo(() => appointments.map((a) => ({
    id: a.id,
    title: a.title || (a.lead_name ? `${t("פגישה")}: ${a.lead_name}` : t("פגישה")),
    start: new Date(a.date_time),
    end: new Date(new Date(a.date_time).getTime() + DEFAULT_DURATION_MS),
    resource: a,
  })), [appointments, t]);

  function onSelectSlot({ start }) {
    setSelectedStart(start);
  }
  function onSelectEvent(event) {
    setSelectedStart(event.start);
  }

  function eventPropGetter(event) {
    const isThisLead = event.resource.lead_id === lead.id;
    return { style: { backgroundColor: isThisLead ? colors.accent : "#a89a82", border: "none", borderRadius: 6 } };
  }

  async function confirm() {
    if (!selectedStart) { showToast(t("יש לבחור זמן בלוח השנה")); return; }
    setBusy(true);
    const targetMs = selectedStart.getTime();
    const { data: nearby } = await supabase.from("appointments").select("id")
      .gte("date_time", new Date(targetMs - MEETING_BUFFER_MS).toISOString())
      .lte("date_time", new Date(targetMs + MEETING_BUFFER_MS).toISOString());
    if (nearby && nearby.length) { setBusy(false); showToast(t("יש כבר פגישה בטווח של שעה מהזמן הזה")); return; }
    const { error } = await supabase.from("appointments").insert({
      lead_id: lead.id, lead_name: lead.name, date_time: selectedStart.toISOString(),
      title: title.trim() || `פגישה עם ${lead.name}`, created_by: profile.id,
    });
    setBusy(false);
    if (error) { showToast(t("שגיאה בקביעת פגישה")); return; }
    showToast(t("הפגישה נקבעה"));
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div style={{ width: 900, maxWidth: "100%", height: "88vh", background: "#fff", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t("קביעת פגישה עבור")} {lead.name}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 8 }}>
          {t('לחץ על משבצת פנויה בלוח כדי לבחור זמן, או על פגישה קיימת כדי לראות מתי היא — כך רואים את כל הלו"ז לפני שקובעים.')}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <Calendar
            localizer={localizer} culture={lang === "en" ? "en-US" : "he"} rtl={lang !== "en"} messages={calendarMessages}
            events={events} view={view} onView={setView} date={date} onNavigate={setDate}
            views={["month", "week", "day"]} selectable
            onSelectSlot={onSelectSlot} onSelectEvent={onSelectEvent}
            eventPropGetter={eventPropGetter} components={calendarComponents} style={{ height: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder={t("כותרת")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ fontSize: 12.5, color: colors.mutedText, whiteSpace: "nowrap" }}>
            {selectedStart ? `${t("נבחר")}: ${selectedStart.toLocaleString(lang === "en" ? "en-US" : "he-IL")}` : t("לא נבחר זמן")}
          </div>
          <button onClick={onClose} style={buttonGhost}>{t("ביטול")}</button>
          <button onClick={confirm} disabled={busy || !selectedStart} style={buttonPrimary}>{busy ? t("קובע…") : t("קבע פגישה")}</button>
        </div>
      </div>
    </div>
  );
}
