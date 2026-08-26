import React, { useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { he } from "date-fns/locale";
import { Plus } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendar-theme.css";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, inputStyle, buttonPrimary, buttonGhost, buttonDanger } from "../lib/theme";
import { MEETING_BUFFER_MS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import { useLanguage } from "../lib/LanguageContext";
import MiniMonthPicker from "../components/MiniMonthPicker";
import CalendarToolbar from "../components/CalendarToolbar";

const locales = { he };
const localizer = dateFnsLocalizer({
  format, parse, getDay, locales,
  startOfWeek: () => startOfWeek(new Date(), { locale: he }),
});
const DnDCalendar = withDragAndDrop(Calendar);
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function roundToNextHalfHour(d) {
  const ms = 30 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / ms) * ms);
}

function EventChip({ event }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
      <span style={{ fontWeight: 700, flexShrink: 0 }}>{format(event.start, "HH:mm")}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</span>
    </span>
  );
}

function calendarMessagesFor(t) {
  return {
    date: t("תאריך"), time: t("שעה"), event: t("אירוע"), allDay: t("כל היום"), week: t("שבוע"), work_week: t("שבוע עבודה"),
    day: t("יום"), month: t("חודש"), previous: t("הקודם"), next: t("הבא"), yesterday: t("אתמול"), tomorrow: t("מחר"),
    today: t("היום"), agenda: t("רשימה"), noEventsInRange: t("אין פגישות בטווח הזה"), showMore: (n) => `+${n} ${t("נוספות")}`,
  };
}

export default function CalendarView({
  profile, profiles, leads, showToast, openLead, googleCalendarEmbedUrl,
  presetLeadId = null, presetTitle = "", calendarHeight = 720,
}) {
  const { t, lang } = useLanguage();
  const { rows: appointments } = useRealtimeList("appointments", { orderBy: "date_time", ascending: true });
  const mgr = canActLikeManager(profile);
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', start, appt }
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState("system"); // 'system' | 'google'

  function canEdit(appt) { return !!appt && (appt.created_by === profile.id || mgr); }
  function repName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

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
    setModal({ mode: "create", start, appt: null });
  }
  function onSelectEvent(event) {
    setModal({ mode: "edit", start: event.start, appt: event.resource });
  }

  function eventPropGetter(event) {
    const appt = event.resource;
    const isThisLead = !!presetLeadId && appt.lead_id === presetLeadId;
    const mine = appt.created_by === profile.id;
    const editable = canEdit(appt);
    return {
      style: {
        backgroundColor: isThisLead ? "#d97706" : mine ? colors.accent : editable ? "#7c3aed" : "#a89a82",
        border: isThisLead ? "2px solid #b45309" : "none", borderRadius: 6, opacity: editable ? 1 : 0.75,
        cursor: editable ? "grab" : "pointer",
      },
    };
  }

  const calendarComponents = useMemo(() => ({ toolbar: CalendarToolbar, event: EventChip }), []);
  const calendarMessages = useMemo(() => calendarMessagesFor(t), [t]);
  const fillHeight = calendarHeight === "100%";

  return (
    <div style={fillHeight ? { height: "100%", display: "flex", flexDirection: "column" } : undefined}>
      {googleCalendarEmbedUrl && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexShrink: 0 }}>
          <button onClick={() => setMode("system")} style={mode === "system" ? buttonPrimary : buttonGhost}>{t("יומן המערכת")}</button>
          <button onClick={() => setMode("google")} style={mode === "google" ? buttonPrimary : buttonGhost}>{t("יומן Google")}</button>
        </div>
      )}

      {mode === "google" && googleCalendarEmbedUrl ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 8, boxShadow: "0 2px 10px rgba(0,0,0,.06)", height: 720 }}>
          <iframe
            src={googleCalendarEmbedUrl}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 10 }}
            title="Google Calendar"
          />
        </div>
      ) : (
    <div className="two-col-responsive" style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: fillHeight ? 1 : undefined, minHeight: fillHeight ? 0 : undefined }}>
      <div style={{ width: 230, flexShrink: 0, display: "grid", gap: 14 }}>
        <button
          onClick={() => setModal({ mode: "create", start: roundToNextHalfHour(new Date()), appt: null })}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 24,
            border: "none", cursor: "pointer", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.12)",
            fontWeight: 700, fontSize: 14, color: colors.text, width: "100%", justifyContent: "flex-start",
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: colors.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Plus size={16} />
          </span>
          {t("פגישה חדשה")}
        </button>

        <MiniMonthPicker date={date} onSelect={setDate} />

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 12, fontSize: 11.5, color: colors.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colors.accent, flexShrink: 0 }} /> {t("שלי")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#7c3aed", flexShrink: 0 }} /> {t("ניתן לעריכה")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: presetLeadId ? 6 : 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#a89a82", flexShrink: 0 }} /> {t("לצפייה בלבד")}
          </div>
          {presetLeadId && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#d97706", flexShrink: 0 }} /> {t("פגישות של ליד זה")}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,.06)", height: calendarHeight }}>
        <DnDCalendar
          localizer={localizer}
          culture={lang === "en" ? "en-US" : "he"}
          rtl={lang !== "en"}
          messages={calendarMessages}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={["month", "week", "day", "agenda"]}
          selectable
          resizable={false}
          draggableAccessor={(event) => canEdit(event.resource)}
          onEventDrop={onEventDrop}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent}
          eventPropGetter={eventPropGetter}
          components={calendarComponents}
          style={{ height: "100%" }}
        />
      </div>

      {modal && (
        <AppointmentModal
          modal={modal}
          profile={profile}
          leads={leads}
          repName={repName}
          canEdit={modal.appt ? canEdit(modal.appt) : true}
          checkConflict={checkConflict}
          showToast={showToast}
          openLead={openLead}
          onClose={() => setModal(null)}
          presetLeadId={presetLeadId}
          presetTitle={presetTitle}
          t={t}
          lang={lang}
        />
      )}
    </div>
      )}
    </div>
  );
}

function AppointmentModal({ modal, profile, leads, repName, canEdit, checkConflict, showToast, openLead, onClose, presetLeadId, presetTitle, t, lang }) {
  const { mode, start, appt } = modal;
  const [title, setTitle] = useState(appt?.title || presetTitle || "");
  const [dateTime, setDateTime] = useState(toLocalInput(appt ? new Date(appt.date_time) : start));
  const [notes, setNotes] = useState(appt?.notes || "");
  const [leadId, setLeadId] = useState(appt?.lead_id || presetLeadId || "");
  const [busy, setBusy] = useState(false);

  function toLocalInput(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function save() {
    if (!dateTime) { showToast(t("יש לבחור תאריך ושעה")); return; }
    setBusy(true);
    const iso = new Date(dateTime).toISOString();
    if (await checkConflict(iso, appt?.id)) {
      setBusy(false);
      showToast(t("יש כבר פגישה בטווח של שעה מהזמן הזה"));
      return;
    }
    const lead = leads.find((l) => l.id === leadId);
    const payload = {
      title: title.trim() || "פגישה", date_time: iso, notes: notes.trim() || null,
      lead_id: leadId || null, lead_name: lead ? lead.name : null,
    };
    let error;
    if (mode === "create") {
      ({ error } = await supabase.from("appointments").insert({ ...payload, created_by: profile.id }));
    } else {
      ({ error } = await supabase.from("appointments").update(payload).eq("id", appt.id));
    }
    setBusy(false);
    if (error) { showToast(t("שגיאה בשמירת הפגישה")); return; }
    showToast(mode === "create" ? t("הפגישה נקבעה") : t("הפגישה עודכנה"));
    onClose();
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: 380, maxWidth: "92%", background: "#fff", borderRadius: 14, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
          {mode === "create" ? t("פגישה חדשה") : canEdit ? t("עריכת פגישה") : t("פרטי פגישה")}
        </div>

        {!canEdit && appt ? (
          <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
            <div><b>{appt.title}</b></div>
            <div style={{ color: colors.mutedText }}>{new Date(appt.date_time).toLocaleString(lang === "en" ? "en-US" : "he-IL")}</div>
            {appt.notes && <div style={{ color: colors.mutedText }}>{appt.notes}</div>}
            <div style={{ color: colors.muted, fontSize: 12 }}>{t('נקבע ע"י')} {repName(appt.created_by)}</div>
            {appt.lead_id && <button onClick={() => { openLead(appt.lead_id); onClose(); }} style={buttonGhost}>{t("פתח ליד מקושר")}</button>}
            <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>{t("אפשר להזיז/לערוך רק פגישה שקבעת בעצמך.")}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input style={inputStyle} placeholder={t("כותרת")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input type="datetime-local" style={inputStyle} value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
            <select style={inputStyle} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">{t("קישור לליד (אופציונלי)")}</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.business_name}</option>)}
            </select>
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
