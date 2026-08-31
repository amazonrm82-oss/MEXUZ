import React, { useMemo, useState } from "react";
import { ListTodo, BellRing, ClipboardList, Users, Trash2, Check, Repeat, LayoutList } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { inputStyle, buttonPrimary, buttonGhost, colors, panelStyle } from "../lib/theme";
import { REMIND_BEFORE_OPTIONS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import { fmtDate } from "../lib/format";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const TABS = [
  ["myTasks", "המשימות שלי", ListTodo],
  ["reminders", "תזכורות שלי", BellRing],
  ["fromManager", "משימות מהמנהל", ClipboardList],
];

const REPEAT_OPTIONS = [
  ["", "ללא חזרה"],
  ["daily", "כל יום"],
  ["weekly", "כל שבוע"],
  ["monthly", "כל חודש"],
];

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDueInput() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

export default function TasksView({ profile, profiles, tasks, showToast, openLead, t }) {
  const mgr = canActLikeManager(profile);
  const [tab, setTab] = useState("myTasks");
  const tabs = mgr ? [...TABS, ["assign", "הקצאת משימות", Users], ["team", "כל המשימות של הצוות", LayoutList]] : TABS;

  const myTasks = useMemo(() => tasks.filter((task) => task.kind === "task" && task.owner_id === profile.id && task.created_by === profile.id), [tasks, profile.id]);
  const myReminders = useMemo(() => tasks.filter((task) => task.kind === "reminder" && task.owner_id === profile.id), [tasks, profile.id]);
  const fromManager = useMemo(() => tasks.filter((task) => task.kind === "task" && task.owner_id === profile.id && task.created_by !== profile.id), [tasks, profile.id]);
  const assignedByMe = useMemo(() => tasks.filter((task) => task.created_by === profile.id && task.owner_id !== profile.id), [tasks, profile.id]);

  async function toggleComplete(task) {
    const { error } = await supabase.from("tasks").update({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }).eq("id", task.id);
    if (error) showToast(t("שגיאה בעדכון"));
  }
  async function remove(task) {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) showToast(t("שגיאה במחיקה"));
  }

  return (
    <div>
      <PageHeader icon={ListTodo} title={t("משימות ותזכורות")} subtitle={t("ניהול אישי של משימות ותזכורות, וגם מה שהמנהל הקצה לך")} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              ...(tab === key ? buttonPrimary : buttonGhost),
            }}
          >
            <Icon size={15} /> {t(label)}
          </button>
        ))}
      </div>

      {tab === "myTasks" && (
        <TaskList
          items={myTasks} kind="task" profile={profile} showToast={showToast}
          onToggle={toggleComplete} onRemove={remove} openLead={openLead}
          emptyText={t("אין לך משימות אישיות עדיין")} t={t}
        />
      )}
      {tab === "reminders" && (
        <TaskList
          items={myReminders} kind="reminder" profile={profile} showToast={showToast}
          onToggle={toggleComplete} onRemove={remove} openLead={openLead}
          emptyText={t("אין לך תזכורות עדיין")} t={t}
        />
      )}
      {tab === "fromManager" && (
        <TaskList
          items={fromManager} kind="task" profile={profile} showToast={showToast}
          onToggle={toggleComplete} onRemove={null} openLead={openLead}
          readOnlyCreate
          emptyText={t("לא הוקצו לך משימות ע״י מנהל")}
          repName={(id) => profiles.find((p) => p.id === id)?.name || "—"}
          showAssignedBy t={t}
        />
      )}
      {tab === "assign" && mgr && (
        <AssignTab profiles={profiles} profile={profile} assignedByMe={assignedByMe} showToast={showToast} onToggle={toggleComplete} onRemove={remove} openLead={openLead} t={t} />
      )}
      {tab === "team" && mgr && (
        <TeamOverviewTab tasks={tasks} profiles={profiles} openLead={openLead} t={t} />
      )}
    </div>
  );
}

// Manager/deputy-only: every rep's own tasks and reminders (self-made or automated — see
// migration 0013) grouped by rep, so a manager can actually see whether the team is keeping up
// with follow-ups and stuck-lead nudges instead of only what they personally assigned.
function TeamOverviewTab({ tasks, profiles, openLead, t }) {
  const grouped = useMemo(() => {
    const map = {};
    tasks.filter((task) => !task.completed).forEach((task) => {
      (map[task.owner_id] = map[task.owner_id] || []).push(task);
    });
    return map;
  }, [tasks]);

  const repIds = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  if (repIds.length === 0) return <EmptyState icon={LayoutList} text={t("אין כרגע משימות או תזכורות פתוחות בצוות")} />;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {repIds.map((repId) => {
        const items = grouped[repId].sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
        const overdueCount = items.filter((task) => new Date(task.due_at).getTime() < Date.now()).length;
        return (
          <div key={repId}>
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              {profiles.find((p) => p.id === repId)?.name || "—"}
              <span style={{ fontWeight: 500, color: colors.muted, fontSize: 11.5 }}>({items.length} {t("פתוחות")})</span>
              {overdueCount > 0 && (
                <span style={{ background: colors.danger, color: "#fff", borderRadius: 8, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>
                  {overdueCount} {t("באיחור")}
                </span>
              )}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {items.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={() => {}} onRemove={null} canToggle={false} openLead={openLead} t={t} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskList({ items, kind, profile, showToast, onToggle, onRemove, emptyText, readOnlyCreate, repName, showAssignedBy, ownerId, extraInsert, hideList, onAdded, openLead, t }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState(defaultDueInput());
  const [remindBefore, setRemindBefore] = useState(60);
  const [repeatInterval, setRepeatInterval] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim() || !due) { showToast(t("יש למלא כותרת ותאריך")); return; }
    setSaving(true);
    const payload = {
      owner_id: ownerId || profile.id, created_by: profile.id, kind,
      title: title.trim(), notes: notes.trim() || null,
      due_at: new Date(due).toISOString(), remind_before_minutes: Number(remindBefore),
      repeat_interval: repeatInterval || null,
      ...extraInsert,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    setSaving(false);
    if (error) { showToast(t("שגיאה בהוספה")); return; }
    setTitle(""); setNotes(""); setDue(defaultDueInput()); setRemindBefore(60); setRepeatInterval("");
    showToast(kind === "reminder" ? t("התזכורת נוספה") : t("המשימה נוספה"));
    if (onAdded) onAdded();
  }

  const pending = items.filter((task) => !task.completed).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const done = items.filter((task) => task.completed).sort((a, b) => new Date(b.due_at) - new Date(a.due_at));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!readOnlyCreate && (
        <div style={{ ...panelStyle, display: "grid", gap: 8, maxWidth: 480 }}>
          <input style={inputStyle} placeholder={kind === "reminder" ? t("כותרת התזכורת") : t("כותרת המשימה")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea style={{ ...inputStyle, minHeight: 50 }} placeholder={t("הערות (אופציונלי)")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="datetime-local" style={{ ...inputStyle, flex: 1, minWidth: 180 }} value={due} onChange={(e) => setDue(e.target.value)} />
            <select style={{ ...inputStyle, flex: 1, minWidth: 150 }} value={remindBefore} onChange={(e) => setRemindBefore(e.target.value)}>
              {REMIND_BEFORE_OPTIONS.map(([mins, label]) => <option key={mins} value={mins}>{t(label)}</option>)}
            </select>
            <select style={{ ...inputStyle, flex: 1, minWidth: 150 }} value={repeatInterval} onChange={(e) => setRepeatInterval(e.target.value)}>
              {REPEAT_OPTIONS.map(([val, label]) => <option key={val} value={val}>{t(label)}</option>)}
            </select>
          </div>
          <button onClick={add} disabled={saving} style={buttonPrimary}>{saving ? t("שומר…") : kind === "reminder" ? t("הוסף תזכורת") : t("הוסף משימה")}</button>
        </div>
      )}

      {!hideList && (
        items.length === 0 ? (
          <EmptyState icon={kind === "reminder" ? BellRing : ListTodo} text={emptyText} />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {pending.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} repName={repName} showAssignedBy={showAssignedBy} canToggle={task.owner_id === profile.id} openLead={openLead} t={t} />
            ))}
            {done.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: colors.muted, fontWeight: 700, marginBottom: 6 }}>{t("הושלמו")}</div>
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} repName={repName} showAssignedBy={showAssignedBy} canToggle={task.owner_id === profile.id} openLead={openLead} t={t} />
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove, repName, showAssignedBy, canToggle, openLead, t }) {
  const overdue = !task.completed && new Date(task.due_at).getTime() < Date.now();
  return (
    <div style={{
      ...panelStyle, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10,
      opacity: task.completed ? 0.6 : 1, borderInlineStart: overdue ? `3px solid ${colors.danger}` : "3px solid transparent",
    }}>
      {canToggle && (
        <button
          onClick={() => onToggle(task)}
          title={task.completed ? t("סמן כלא הושלם") : t("סמן כהושלם")}
          style={{
            width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${task.completed ? colors.accent : colors.border}`,
            background: task.completed ? colors.accent : "#fff", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}
        >
          {task.completed && <Check size={14} />}
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, textDecoration: task.completed ? "line-through" : "none", display: "flex", alignItems: "center", gap: 5 }}>
          {task.title}
          {task.repeat_interval && (
            <span title={t("חוזר")} style={{ display: "inline-flex" }}><Repeat size={12} color={colors.muted} /></span>
          )}
        </div>
        {task.notes && <div style={{ fontSize: 12.5, color: colors.mutedText, marginTop: 2 }}>{task.notes}</div>}
        <div style={{ fontSize: 11.5, color: overdue ? colors.danger : colors.muted, marginTop: 4, fontWeight: overdue ? 700 : 500 }}>
          {overdue ? `${t("באיחור")} · ` : ""}{fmtDate(task.due_at)}
          {showAssignedBy && repName && <span> · {t("הוקצה ע״י")} {repName(task.created_by)}</span>}
        </div>
        {task.lead_id && openLead && (
          <button onClick={() => openLead(task.lead_id)} style={{ border: "none", background: "none", color: colors.accent, cursor: "pointer", fontSize: 11.5, padding: 0, marginTop: 4, textDecoration: "underline" }}>
            {t("פתח ליד")}: {task.lead_name || "—"}
          </button>
        )}
      </div>
      {onRemove && (
        <button onClick={() => onRemove(task)} title={t("מחק")} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, flexShrink: 0 }}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function AssignTab({ profiles, profile, assignedByMe, showToast, onToggle, onRemove, openLead, t }) {
  const employees = useMemo(() => profiles.filter((p) => p.id !== profile.id), [profiles, profile.id]);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");

  const grouped = useMemo(() => {
    const map = {};
    assignedByMe.forEach((task) => {
      (map[task.owner_id] = map[task.owner_id] || []).push(task);
    });
    return map;
  }, [assignedByMe]);

  if (employees.length === 0) return <EmptyState icon={Users} text={t("אין עובדים נוספים במערכת")} />;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ ...panelStyle, maxWidth: 480 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("הקצאת משימה חדשה")}</div>
        <select style={{ ...inputStyle, marginBottom: 8 }} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <TaskList
          items={[]} kind="task" profile={profile} showToast={showToast}
          onToggle={() => {}} onRemove={null} hideList ownerId={employeeId} t={t}
        />
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{t("משימות שהקצית")}</div>
        {assignedByMe.length === 0 ? (
          <EmptyState icon={ClipboardList} text={t("עדיין לא הקצית משימות לאף אחד")} />
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {Object.entries(grouped).map(([empId, items]) => (
              <div key={empId}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.mutedText, marginBottom: 6 }}>
                  {profiles.find((p) => p.id === empId)?.name || "—"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {items.sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={onToggle} onRemove={onRemove} canToggle={false} openLead={openLead} t={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
