import React, { useMemo, useState } from "react";
import { LifeBuoy, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const PRIORITY_LABELS = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" };
const PRIORITY_COLORS = { low: "#6b7280", medium: "#3548c7", high: "#d97706", urgent: "#dc2626" };
const STATUS_LABELS = { open: "פתוח", in_progress: "בטיפול", closed: "נסגר" };

const EMPTY = { title: "", description: "", systemId: "", priority: "medium", reporterName: "", reporterContact: "" };

// Support requests/bugs against a system MEXUZ maintains (company_systems). Clients don't have
// logins here, so a team member logs the ticket on their behalf and tracks it through to closed.
export default function SupportTicketsView({ profile, profiles, t }) {
  const mgr = canActLikeManager(profile);
  const { rows: tickets } = useRealtimeList("support_tickets", { orderBy: "created_at", ascending: false });
  const { rows: systems } = useRealtimeList("company_systems", { orderBy: "sort_order", ascending: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const systemName = (id) => systems.find((s) => s.id === id)?.name || t("כללי");
  const personName = (id) => profiles.find((p) => p.id === id)?.name || "—";

  const openTickets = useMemo(() => tickets.filter((tk) => tk.status !== "closed"), [tickets]);
  const closedTickets = useMemo(() => tickets.filter((tk) => tk.status === "closed"), [tickets]);
  const urgentCount = useMemo(() => openTickets.filter((tk) => tk.priority === "urgent").length, [openTickets]);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function addTicket() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("support_tickets").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      system_id: form.systemId || null,
      priority: form.priority,
      reporter_name: form.reporterName.trim() || null,
      reporter_contact: form.reporterContact.trim() || null,
      created_by: profile.id,
    });
    setSaving(false);
    if (!error) { setForm(EMPTY); setOpen(false); }
  }

  async function updateTicket(id, patch) {
    await supabase.from("support_tickets").update(patch).eq("id", id);
  }
  async function closeTicket(id) {
    await updateTicket(id, { status: "closed", closed_at: new Date().toISOString() });
  }
  async function removeTicket(id) {
    await supabase.from("support_tickets").delete().eq("id", id);
  }

  return (
    <div>
      <PageHeader
        icon={LifeBuoy} title={t("פניות תמיכה")}
        subtitle={`${openTickets.length} ${t("פתוחות")}${urgentCount > 0 ? ` · ${urgentCount} ${t("דחוף")}` : ""}`}
      />

      <div style={{ ...panelStyle, marginBottom: 20 }}>
        {!open ? (
          <button onClick={() => setOpen(true)} style={{ ...buttonPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> {t("פנייה חדשה")}
          </button>
        ) : (
          <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <input style={inputStyle} placeholder={t("כותרת הפנייה")} value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
            <select style={inputStyle} value={form.systemId} onChange={(e) => set("systemId", e.target.value)}>
              <option value="">{t("כללי / לא משויך למערכת")}</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select style={inputStyle} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              <option value="low">{t("עדיפות נמוכה")}</option>
              <option value="medium">{t("עדיפות בינונית")}</option>
              <option value="high">{t("עדיפות גבוהה")}</option>
              <option value="urgent">{t("דחוף")}</option>
            </select>
            <input style={inputStyle} placeholder={t("שם הפונה")} value={form.reporterName} onChange={(e) => set("reporterName", e.target.value)} />
            <input style={inputStyle} placeholder={t("טלפון/אימייל הפונה")} value={form.reporterContact} onChange={(e) => set("reporterContact", e.target.value)} />
            <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder={t("תיאור הבעיה/הבקשה")} value={form.description} onChange={(e) => set("description", e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addTicket} disabled={saving || !form.title.trim()} style={buttonPrimary}>{saving ? t("שומר…") : t("שמור")}</button>
              <button onClick={() => { setOpen(false); setForm(EMPTY); }} style={buttonGhost}>{t("ביטול")}</button>
            </div>
          </div>
        )}
      </div>

      {openTickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} text={t("אין פניות פתוחות")} />
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {openTickets.map((tk) => (
            <TicketCard
              key={tk.id} tk={tk} mgr={mgr} profiles={profiles} systemName={systemName} personName={personName}
              onUpdate={updateTicket} onClose={closeTicket} onRemove={removeTicket} t={t}
            />
          ))}
        </div>
      )}

      {closedTickets.length > 0 && (
        <div>
          <button onClick={() => setShowClosed((v) => !v)} style={{ ...buttonGhost, marginBottom: 10 }}>
            {showClosed ? t("הסתר פניות סגורות") : `${t("הצג פניות סגורות")} (${closedTickets.length})`}
          </button>
          {showClosed && (
            <div style={{ display: "grid", gap: 10 }}>
              {closedTickets.map((tk) => (
                <div key={tk.id} style={{ ...panelStyle, opacity: .65 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, textDecoration: "line-through" }}>{tk.title}</div>
                      <div style={{ fontSize: 11.5, color: colors.muted }}>{systemName(tk.system_id)} · {t("נסגר")} {fmtDate(tk.closed_at)}</div>
                    </div>
                    {mgr && (
                      <button onClick={() => removeTicket(tk.id)} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ tk, mgr, profiles, systemName, personName, onUpdate, onClose, onRemove, t }) {
  return (
    <div style={{ ...panelStyle, borderInlineStart: `4px solid ${PRIORITY_COLORS[tk.priority] || colors.muted}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{tk.title}</div>
          <div style={{ fontSize: 11.5, color: colors.mutedText, marginTop: 2 }}>
            {systemName(tk.system_id)} · {fmtDate(tk.created_at)}
            {tk.reporter_name && ` · ${tk.reporter_name}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onClose(tk.id)} title={t("סגור פנייה")} style={{ border: "none", background: "none", cursor: "pointer", color: "#0ea5a5" }}>
            <CheckCircle2 size={17} />
          </button>
          {mgr && (
            <button onClick={() => onRemove(tk.id)} title={t("מחק")} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted }}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {tk.description && <div style={{ fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 1.5 }}>{tk.description}</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <select
          value={tk.priority} onChange={(e) => onUpdate(tk.id, { priority: e.target.value })}
          style={{
            fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "none", cursor: "pointer",
            background: `${PRIORITY_COLORS[tk.priority] || colors.muted}22`, color: PRIORITY_COLORS[tk.priority] || colors.muted,
          }}
        >
          <option value="low">{t(PRIORITY_LABELS.low)}</option>
          <option value="medium">{t(PRIORITY_LABELS.medium)}</option>
          <option value="high">{t(PRIORITY_LABELS.high)}</option>
          <option value="urgent">{t(PRIORITY_LABELS.urgent)}</option>
        </select>
        <select
          value={tk.status} onChange={(e) => onUpdate(tk.id, { status: e.target.value })}
          style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: `1px solid ${colors.border}`, cursor: "pointer", background: "#fff", color: colors.text }}
        >
          <option value="open">{t(STATUS_LABELS.open)}</option>
          <option value="in_progress">{t(STATUS_LABELS.in_progress)}</option>
          <option value="closed">{t(STATUS_LABELS.closed)}</option>
        </select>
        <select
          value={tk.assigned_to || ""} onChange={(e) => onUpdate(tk.id, { assigned_to: e.target.value || null })}
          style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 20, border: `1px solid ${colors.border}`, cursor: "pointer", background: "#fff", color: colors.text }}
        >
          <option value="">{t("לא משויך")}</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}
