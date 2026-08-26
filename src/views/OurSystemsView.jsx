import React, { useMemo, useState } from "react";
import { Layers, ExternalLink, Trash2, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { money } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const STATUS_LABELS = { active: "פעיל", maintenance: "בתחזוקה", inactive: "לא פעיל" };
const STATUS_COLORS = { active: "#0ea5a5", maintenance: "#d97706", inactive: "#6b7280" };
const RENEWAL_WARNING_DAYS = 30;

const EMPTY = { name: "", clientName: "", description: "", url: "", status: "active", monthlyFee: "", contractStart: "", renewalDate: "" };

function fmtDateOnly(d) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("he-IL");
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00").getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

// Portfolio of systems MEXUZ has built and maintains for clients (plus MEXUZ itself), doubling as
// a recurring-revenue tracker: each system can carry a monthly maintenance/hosting fee and a
// contract renewal date, so managers can see total MRR and which contracts need attention soon.
export default function OurSystemsView({ profile, t }) {
  const mgr = canActLikeManager(profile);
  const { rows: systems } = useRealtimeList("company_systems", { orderBy: "sort_order", ascending: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const activeSystems = useMemo(() => systems.filter((s) => s.status === "active"), [systems]);
  const mrr = useMemo(() => activeSystems.reduce((sum, s) => sum + (Number(s.monthly_fee) || 0), 0), [activeSystems]);
  const upcomingRenewals = useMemo(
    () => activeSystems.filter((s) => {
      const days = daysUntil(s.renewal_date);
      return days != null && days <= RENEWAL_WARNING_DAYS;
    }),
    [activeSystems]
  );

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
      monthly_fee: Number(form.monthlyFee) || 0,
      contract_start: form.contractStart || null,
      renewal_date: form.renewalDate || null,
      sort_order: systems.length,
    });
    setSaving(false);
    if (!error) { setForm(EMPTY); setOpen(false); }
  }

  async function removeSystem(id) {
    await supabase.from("company_systems").delete().eq("id", id);
  }

  async function updateField(id, patch) {
    await supabase.from("company_systems").update(patch).eq("id", id);
  }

  return (
    <div>
      <PageHeader icon={Layers} title={t("המערכות שלנו")} subtitle={`${activeSystems.length} ${t("מערכות פעילות")} · ${systems.length} ${t('סה"כ')}`} />

      {mgr && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: colors.bg, color: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: colors.muted }}>{t("הכנסה חוזרת חודשית")}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{money(mrr)}</div>
            </div>
          </div>
          {upcomingRenewals.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 14, display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #d97706" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#d9770622", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: colors.muted }}>{t("חוזים לקראת חידוש")}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#d97706" }}>{upcomingRenewals.length}</div>
              </div>
            </div>
          )}
        </div>
      )}

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
              <input type="number" style={inputStyle} placeholder={t("דמי תחזוקה חודשיים (₪)")} value={form.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} />
              <label style={{ fontSize: 12, color: colors.mutedText }}>
                {t("תחילת חוזה")}
                <input type="date" style={{ ...inputStyle, marginTop: 4 }} value={form.contractStart} onChange={(e) => set("contractStart", e.target.value)} />
              </label>
              <label style={{ fontSize: 12, color: colors.mutedText }}>
                {t("תאריך חידוש הבא")}
                <input type="date" style={{ ...inputStyle, marginTop: 4 }} value={form.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
              </label>
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
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {systems.map((s) => (
            <SystemCard key={s.id} s={s} mgr={mgr} onRemove={removeSystem} onUpdate={updateField} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function SystemCard({ s, mgr, onRemove, onUpdate, t }) {
  const days = daysUntil(s.renewal_date);
  const renewalSoon = days != null && days <= RENEWAL_WARNING_DAYS;

  return (
    <div style={{ ...panelStyle, borderInlineStart: `4px solid ${STATUS_COLORS[s.status] || colors.muted}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>{s.name}</div>
          {s.client_name && <div style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>{s.client_name}</div>}
        </div>
        {mgr && (
          <button onClick={() => onRemove(s.id)} title={t("מחק")} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, flexShrink: 0 }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {s.description && <div style={{ fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 1.5 }}>{s.description}</div>}

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}`, display: "grid", gap: 4, fontSize: 12.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: colors.muted }}>{t("דמי תחזוקה חודשיים")}</span>
          {mgr ? (
            <input
              type="number" value={s.monthly_fee ?? 0} onChange={(e) => onUpdate(s.id, { monthly_fee: Number(e.target.value) || 0 })}
              style={{ width: 90, padding: "2px 6px", borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 12, textAlign: "left" }}
            />
          ) : (
            <span style={{ fontWeight: 700 }}>{money(s.monthly_fee)}</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: colors.muted }}>{t("תאריך חידוש הבא")}</span>
          {mgr ? (
            <input
              type="date" value={s.renewal_date || ""} onChange={(e) => onUpdate(s.id, { renewal_date: e.target.value || null })}
              style={{ padding: "2px 6px", borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 12 }}
            />
          ) : (
            <span style={{ fontWeight: 700, color: renewalSoon ? "#d97706" : colors.text }}>{fmtDateOnly(s.renewal_date) || "—"}</span>
          )}
        </div>
        {renewalSoon && (
          <div style={{ fontSize: 11.5, color: "#d97706", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} />
            {days <= 0 ? t("החוזה פג!") : `${t("חידוש בעוד")} ${days} ${t("ימים")}`}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        {mgr ? (
          <select
            value={s.status}
            onChange={(e) => onUpdate(s.id, { status: e.target.value })}
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
  );
}
