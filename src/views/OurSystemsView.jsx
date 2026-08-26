import React, { useMemo, useState } from "react";
import { Layers, ExternalLink, Trash2, Plus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const STATUS_LABELS = { active: "פעיל", maintenance: "בתחזוקה", inactive: "לא פעיל" };
const STATUS_COLORS = { active: "#0ea5a5", maintenance: "#d97706", inactive: "#6b7280" };

const EMPTY = { name: "", clientName: "", description: "", url: "", status: "active" };

// Portfolio of systems MEXUZ has built and maintains for clients (plus MEXUZ itself). Manager-only
// to add/remove; everyone with a login can see what's live and how many systems are running.
export default function OurSystemsView({ profile, t }) {
  const mgr = canActLikeManager(profile);
  const { rows: systems } = useRealtimeList("company_systems", { orderBy: "sort_order", ascending: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => systems.filter((s) => s.status === "active").length, [systems]);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function addSystem() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("company_systems").insert({
      name: form.name.trim(),
      client_name: form.clientName.trim() || null,
      description: form.description.trim() || null,
      url: form.url.trim() || null,
      status: form.status,
      sort_order: systems.length,
    });
    setSaving(false);
    if (!error) { setForm(EMPTY); setOpen(false); }
  }

  async function removeSystem(id) {
    await supabase.from("company_systems").delete().eq("id", id);
  }

  async function setStatus(id, status) {
    await supabase.from("company_systems").update({ status }).eq("id", id);
  }

  return (
    <div>
      <PageHeader icon={Layers} title={t("המערכות שלנו")} subtitle={`${activeCount} ${t("מערכות פעילות")} · ${systems.length} ${t("סה\"כ")}`} />

      {mgr && (
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          {!open ? (
            <button onClick={() => setOpen(true)} style={{ ...buttonPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> {t("מערכת חדשה")}
            </button>
          ) : (
            <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
              <input style={inputStyle} placeholder={t("שם המערכת")} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              <input style={inputStyle} placeholder={t("שם הלקוח")} value={form.clientName} onChange={(e) => set("clientName", e.target.value)} />
              <input style={inputStyle} placeholder={t("קישור (אופציונלי)")} value={form.url} onChange={(e) => set("url", e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder={t("תיאור קצר")} value={form.description} onChange={(e) => set("description", e.target.value)} />
              <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">{t("פעיל")}</option>
                <option value="maintenance">{t("בתחזוקה")}</option>
                <option value="inactive">{t("לא פעיל")}</option>
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addSystem} disabled={saving || !form.name.trim()} style={buttonPrimary}>{saving ? t("שומר…") : t("שמור")}</button>
                <button onClick={() => { setOpen(false); setForm(EMPTY); }} style={buttonGhost}>{t("ביטול")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {systems.length === 0 ? (
        <EmptyState icon={Layers} text={t("אין עדיין מערכות ברשימה")} />
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {systems.map((s) => (
            <div key={s.id} style={{ ...panelStyle, borderInlineStart: `4px solid ${STATUS_COLORS[s.status] || colors.muted}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{s.name}</div>
                  {s.client_name && <div style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>{s.client_name}</div>}
                </div>
                {mgr && (
                  <button onClick={() => removeSystem(s.id)} title={t("מחק")} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {s.description && <div style={{ fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 1.5 }}>{s.description}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                {mgr ? (
                  <select
                    value={s.status}
                    onChange={(e) => setStatus(s.id, e.target.value)}
                    style={{
                      fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "none",
                      background: `${STATUS_COLORS[s.status] || colors.muted}22`, color: STATUS_COLORS[s.status] || colors.muted, cursor: "pointer",
                    }}
                  >
                    <option value="active">{t("פעיל")}</option>
                    <option value="maintenance">{t("בתחזוקה")}</option>
                    <option value="inactive">{t("לא פעיל")}</option>
                  </select>
                ) : (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: `${STATUS_COLORS[s.status] || colors.muted}22`, color: STATUS_COLORS[s.status] || colors.muted,
                  }}>
                    {t(STATUS_LABELS[s.status] || s.status)}
                  </span>
                )}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: colors.accent, fontWeight: 600, textDecoration: "none" }}>
                    {t("פתיחה")} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
