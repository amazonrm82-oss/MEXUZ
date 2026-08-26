import React, { useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { he } from "date-fns/locale";
import { X } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "../views/calendar-theme.css";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, inputStyle, buttonPrimary, buttonGhost, buttonDanger } from "../lib/theme";
import { MEETING_BUFFER_MS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import { useLanguage } from "../lib/LanguageContext";
import CalendarToolbar from "./CalendarToolbar";

const DnDCalendar = withDragAndDrop(Calendar);
const calendarComponents = { toolbar: CalendarToolbar };

const locales = { he };
const localizer = dateFnsLocalizer({
  format, parse, getDay, locales,
  startOfWeek: () => startOfWeek(new Date(), { locale: he }),
});
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calendarMessagesFor(t) {
  return {
    date: t("תאריך"), time: t("שעה"), event: t("אירוע"), allDay: t("כל היום"), week: t("שבוע"), work_week: t("שבוע עבודה"),
    day: t("יום"), month: t("חודש"), previous: t("הקודם"), next: t("הבא"), yesterday: t("אתמול"), tomorrow: t("מחר"),
    today: t("היום"), agenda: t("רשימה"), noEventsInRange: t("אין פגישות בטווח הזה"), showMore: (n) => `+${n} ${t("נוספות")}`,
  };
}

// A full calendar (all existing appointments, clearly laid out per day) so a rep can see the
// team's schedule before picking a time for this lead. Same drag-to-reschedule and manual
// date/time entry as the main Calendar tab, so a meeting can be created or moved either way
// without leaving the lead's drawer.
export default function AppointmentPickerModal({ lead, profile, onClose, showToast }) {
  const { t, lang } = useLanguage();
  const { rows: appointments } = useRealtimeList("appointments", { orderBy: "date_time", ascending: true });
  const mgr = canActLikeManager(profile);
  const [view, setView] = useState("week");
  const [date, setDate] = useState(new Date());
  const [editor, setEditor] = useState(null); // { mode: 'create'|'edit', start, appt }

  const calendarMessages = useMemo(() => calendarMessagesFor(t), [t]);

  function canEdit(appt) { return !!appt && (appt.created_by === profile.id || mgr); }

  const events = useMemo(() => appointments.map((a) => ({
    id: a.id,
    title: a.title || (a.lead_name ? `${t("פגישה")}: ${a.lead_name}` : t("פגישה")),
    start: new Date(a.date_time),
    end: new Date(new Date(a.date_time).getTime() + DEFAULT_DURATION_MS),
    resource: a,
  })), [appointments, t]);

  const checkConflict = useCallback(async (targetIso, excludeId) => {
    const targetMs = new Date(targetIso).getTime();
    let q = supabase.from("appointments").select("id")
      .gte("date_time", new Date(targetMs - MEETING_BUFFER_MS).toISOString())
      .lte("date_time", new Date(targetMs + MEETING_BUFFER_MS).toISOString());
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    return !!(data && data.length);
  }, []);

  const onEventDrop = useCallback(async ({ event, start }) => {
    const appt = event.resource;
    if (!canEdit(appt)) { showToast(t("אפשר להזיז רק פגישות שקבעת בעצמך")); return; }
    if (await checkConflict(start.toISOString(), appt.id)) { showToast(t("יש כבר פגישה בטווח של שעה מהזמן הזה")); return; }
    const { error } = await supabase.from("appointments").update({ date_time: start.toISOString() }).eq("id", appt.id);
    if (error) showToast(t("שגיאה בהזזת הפגישה")); else showToast(t("הפגישה הועברה"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, mgr, checkConflict, showToast, t]);

  function onSelectSlot({ start }) {
    setEditor({ mode: "create", start, appt: null });
  }
  function onSelectEvent(event) {
    setEditor({ mode: "edit", start: event.start, appt: event.resource });
  }

  function eventPropGetter(event) {
    const appt = event.resource;
    const isThisLead = appt.lead_id === lead.id;
    const editable = canEdit(appt);
    return {
      style: {
        backgroundColor: isThisLead ? colors.accent : editable ? "#7c3aed" : "#a89a82",
        border: "none", borderRadius: 6, opacity: editable ? 1 : 0.75,
        cursor: editable ? "grab" : "pointer",
      },
    };
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div style={{ width: 900, maxWidth: "100%", height: "88vh", background: "#fff", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t("קביעת פגישה עבור")} {lead.name}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 8 }}>
          {t("לחץ על משבצת פנויה כדי לקבוע פגישה חדשה, גרור פגישה קיימת שלך כדי להזיז אותה, או פתח אותה ללחיצה כדי לערוך תאריך/שעה ידנית.")}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <DnDCalendar
            localizer={localizer} culture={lang === "en" ? "en-US" : "he"} rtl={lang !== "en"} messages={calendarMessages}
            events={events} view={view} onView={setView} date={date} onNavigate={setDate}
            views={["month", "week", "day"]} selectable resizable={false}
            draggableAccessor={(event) => canEdit(event.resource)}
            onEventDrop={onEventDrop}
            onSelectSlot={onSelectSlot} onSelectEvent={onSelectEvent}
            eventPropGetter={eventPropGetter} components={calendarComponents} style={{ height: "100%" }}
          />
        </div>
      </div>

      {editor && (
        <LeadAppointmentEditor
          editor={editor} lead={lead} profile={profile}
          canEdit={editor.appt ? canEdit(editor.appt) : true}
          checkConflict={checkConflict} showToast={showToast}
          onClose={() => setEditor(null)} onDone={onClose}
          t={t} lang={lang}
        />
      )}
    </div>
  );
}

function LeadAppointmentEditor({ editor, lead, profile, canEdit, checkConflict, showToast, onClose, onDone, t, lang }) {
  const { mode, start, appt } = editor;
  const [title, setTitle] = useState(appt?.title || `${t("פגישה עם")} ${lead.name}`);
  const [dateTime, setDateTime] = useState(toLocalInput(appt ? new Date(appt.date_time) : start));
  const [notes, setNotes] = useState(appt?.notes || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!dateTime) { showToast(t("יש לבחור תאריך ושעה")); return; }
    setBusy(true);
    const iso = new Date(dateTime).toISOString();
    if (await checkConflict(iso, appt?.id)) {
      setBusy(false);
      showToast(t("יש כבר פגישה בטווח של שעה מהזמן הזה"));
      return;
    }
    const payload = { title: title.trim() || t("פגישה"), date_time: iso, notes: notes.trim() || null };
    let error;
    if (mode === "create") {
      ({ error } = await supabase.from("appointments").insert({
        ...payload, lead_id: lead.id, lead_name: lead.name, created_by: profile.id,
      }));
    } else {
      ({ error } = await supabase.from("appointments").update(payload).eq("id", appt.id));
    }
    setBusy(false);
    if (error) { showToast(t("שגיאה בשמירת הפגישה")); return; }
    showToast(mode === "create" ? t("הפגישה נקבעה") : t("הפגישה עודכנה"));
    onClose();
    if (mode === "create") onDone();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("appointments").delete().eq("id", appt.id);
    setBusy(false);
    if (error) { showToast(t("שגיאה במחיקת הפגישה")); return; }
    showToast(t("הפגישה נמחקה"));
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 970, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: 380, maxWidth: "92%", background: "#fff", borderRadius: 14, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
          {mode === "create" ? t("פגישה חדשה") : canEdit ? t("עריכת פגישה") : t("פרטי פגישה")}
        </div>

        {!canEdit && appt ? (
          <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
            <div><b>{appt.title}</b></div>
            <div style={{ color: colors.mutedText }}>{new Date(appt.date_time).toLocaleString(lang === "en" ? "en-US" : "he-IL")}</div>
            {appt.notes && <div style={{ color: colors.mutedText }}>{appt.notes}</div>}
            <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>{t("אפשר להזיז/לערוך רק פגישה שקבעת בעצמך.")}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} placeholder={t("כותרת")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input type="datetime-local" style={inputStyle} value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
            <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder={t("הערות")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={buttonGhost}>{t("סגור")}</button>
          {canEdit && mode === "edit" && <button onClick={remove} disabled={busy} style={buttonDanger}>{t("מחק")}</button>}
          {canEdit && <button onClick={save} disabled={busy} style={buttonPrimary}>{busy ? t("שומר…") : t("שמור")}</button>}
        </div>
      </div>
    </div>
  );
}
