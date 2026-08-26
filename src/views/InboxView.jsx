import React, { useState, useMemo } from "react";
import { Inbox, Flame, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { colors, buttonPrimary, buttonGhost, buttonDanger, inputStyle } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { PROCESS_STATUS_OPTIONS, UNCLAIMED_ALERT_MS } from "../lib/constants";
import { LEAD_STATUS_COLORS, PROCESS_STATUS_COLORS, colorFor } from "../lib/statusColors";
import { canActLikeManager, canResetSystem } from "../lib/permissions";
import { downloadCsv } from "../lib/exportCsv";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

// Statuses shown as sections, stacked top to bottom — "מספר שגוי" auto-deletes the lead
// (DB trigger) and "לא מעוניין" moves it to its own tab, so neither ever has leads sitting in it.
const BOARD_STATUSES = PROCESS_STATUS_OPTIONS.filter((s) => s !== "מספר שגוי" && s !== "לא מעוניין");
// Not a real process_status — deals sitting on pending_approval, shown as one more funnel
// section (same look as the others) so reps can see what's waiting on a manager, not just
// managers themselves (who already have this in Notifications, with the approve buttons).
const PENDING_APPROVAL_STATUS = "ממתין לאישור";
const ALL_SECTIONS = [...BOARD_STATUSES, PENDING_APPROVAL_STATUS];

export default function InboxView({ leads, profile, profiles, openLead, actions, showToast, t, tStatus }) {
  const mgr = canActLikeManager(profile);
  const canDelete = canResetSystem(profile);
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  function toggleSelected(id) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const count = selectedIds.size;
    if (!count) return;
    if (!window.confirm(`${t("למחוק")} ${count} ${t("לידים נבחרים")}? ${t("הפעולה בלתי הפיכה.")}`)) return;
    const { error } = await supabase.from("leads").delete().in("id", [...selectedIds]);
    if (error) { showToast(t("שגיאה במחיקת הלידים")); return; }
    showToast(`${count} ${t("לידים נמחקו")}`);
    setSelectedIds(new Set());
  }

  const open = useMemo(
    () => leads.filter((l) => !l.canceled && !l.archived && !l.closed_at && l.process_status !== "לא מעוניין"),
    [leads]
  );
  const filtered = useMemo(() => {
    if (filter === "new") return open.filter((l) => l.lead_status === "ליד חדש");
    if (filter === "mine") return open.filter((l) => l.claimed_by === profile.id);
    return open;
  }, [open, filter, profile.id]);

  const pendingApproval = useMemo(() => {
    const base = leads.filter((l) => l.pending_approval && !l.canceled && !l.archived);
    if (filter === "mine") return base.filter((l) => l.claimed_by === profile.id);
    if (filter === "new") return [];
    return base;
  }, [leads, filter, profile.id]);

  function repName(id) {
    return profiles.find((p) => p.id === id)?.name || "—";
  }

  async function changeProcessStatus(lead, next) {
    if (next === "מספר שגוי" && !window.confirm(`${t("למחוק את הליד")} "${lead.name}"? ${t("הפעולה בלתי הפיכה.")}`)) return;
    const { error } = await actions.updateLead(lead.id, { process_status: next });
    if (error) return;
    if (next === "מספר שגוי") showToast(t("הליד נמחק"));
    else if (next === "לא מעוניין") showToast(t('הליד הועבר ל"לא מעוניינים"'));
  }

  const statusesToShow = statusFilter === "all" ? ALL_SECTIONS : [statusFilter];

  function exportLeads() {
    const rows = filtered.map((l) => ({
      שם: l.name, "שם עסק": l.business_name || "", טלפון: l.phone || "", מוצר: l.product || "", כמות: l.quantity || 0,
      "סטטוס ליד": tStatus(l.lead_status), "סטטוס תהליך": tStatus(l.process_status), נציג: repName(l.claimed_by), "התקבל בתאריך": fmtDate(l.received_at),
    }));
    downloadCsv(`לידים_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        icon={Inbox} title={t("תיבת לידים")} subtitle={`${open.length} ${t("לידים פתוחים")}`}
        actions={[
          ...[["all", "הכל"], ["new", "חדש"], ["mine", "שלי"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={filter === key ? buttonPrimary : buttonGhost}>{t(label)}</button>
          )),
          <button key="export" onClick={exportLeads} style={buttonGhost}>{t("ייצוא לאקסל")}</button>,
          ...(canDelete && selectedIds.size > 0 ? [
            <button key="delete-selected" onClick={deleteSelected} style={{ ...buttonDanger, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={14} /> {t("מחק")} ({selectedIds.size})
            </button>,
          ] : []),
        ]}
      />

      <div style={{ marginBottom: 14 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...inputStyle, width: "auto", minWidth: 220, fontWeight: 700 }}
        >
          <option value="all">{t("הצג הכל")}</option>
          {ALL_SECTIONS.map((s) => <option key={s} value={s}>{t("רק")}: {tStatus(s)}</option>)}
        </select>
      </div>

      {filtered.length === 0 && pendingApproval.length === 0 ? (
        <EmptyState icon={Inbox} text={t("אין לידים להצגה")} />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {statusesToShow.map((status) => {
            const isPendingApproval = status === PENDING_APPROVAL_STATUS;
            const accent = colorFor(PROCESS_STATUS_COLORS, status);
            const columnLeads = (isPendingApproval ? pendingApproval : filtered.filter((l) => l.process_status === status))
              .sort((a, b) => (b.is_hot ? 1 : 0) - (a.is_hot ? 1 : 0));
            return (
              <div key={status} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.05)", overflow: "hidden" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px",
                  borderInlineStart: `4px solid ${accent}`, background: `${accent}0c`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 14, color: colors.text }}>{tStatus(status)}</span>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, background: "#fff", padding: "2px 10px", borderRadius: 20 }}>
                    {columnLeads.length}
                  </span>
                </div>

                {columnLeads.length === 0 ? (
                  <div style={{ padding: "10px 16px", fontSize: 12, color: colors.muted }}>{t("אין לידים בשלב הזה")}</div>
                ) : (
                  <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                    {columnLeads.map((l) => {
                      const staleUnclaimed = !l.claimed_by && Date.now() - new Date(l.received_at).getTime() > UNCLAIMED_ALERT_MS;
                      const leadStatusColor = colorFor(LEAD_STATUS_COLORS, l.lead_status);
                      const canEdit = mgr || !l.claimed_by || l.claimed_by === profile.id;
                      return (
                        <div
                          key={l.id}
                          style={{
                            background: staleUnclaimed ? `${colors.danger}12` : colors.bg, borderRadius: 9, padding: "9px 10px",
                            borderInlineStart: `3px solid ${staleUnclaimed ? colors.danger : accent}`,
                          }}
                        >
                          <div onClick={() => openLead(l.id)} style={{ cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {canDelete && (
                                <input
                                  type="checkbox" checked={selectedIds.has(l.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => toggleSelected(l.id)}
                                  style={{ flexShrink: 0, cursor: "pointer" }}
                                />
                              )}
                              {l.is_hot && (
                                <span title={t("ליד חם — מערכת CRM/ERP מעל 50 משתמשים")} style={{ display: "flex", flexShrink: 0 }}>
                                  <Flame size={13} color="#e6641f" fill="#e6641f" />
                                </span>
                              )}
                              <div style={{ fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                            </div>
                            <div style={{ fontSize: 11, color: colors.mutedText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.business_name}</div>
                            <span style={{
                              display: "inline-block", marginTop: 4, fontSize: 9.5, padding: "2px 7px", borderRadius: 20,
                              background: `${leadStatusColor}22`, color: leadStatusColor, fontWeight: 700,
                            }}>
                              {tStatus(l.lead_status)}
                            </span>
                            <div style={{ fontSize: 10, color: staleUnclaimed ? colors.danger : colors.muted, marginTop: 4, fontWeight: staleUnclaimed ? 700 : 500 }}>
                              {isPendingApproval
                                ? `${t("ממתין לאישור מאז")} ${fmtDate(l.closed_at)}`
                                : `${staleUnclaimed ? t("לא שויך מעל 72 שעות") + " · " : ""}${fmtDate(l.received_at)}`}
                            </div>
                            <div style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>
                              {l.claimed_by ? `${t("שויך ל")}${repName(l.claimed_by)}` : t("לא משויך")}
                            </div>
                          </div>

                          {isPendingApproval ? (
                            <div style={{ marginTop: 6, fontSize: 10, color: colors.muted, textAlign: "center" }}>
                              {mgr ? t("אישור מתבצע בלשונית התראות") : t("ממתין לאישור סגן/מנהל")}
                            </div>
                          ) : (
                            <>
                              {!l.claimed_by && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); actions.claimLead(l.id); }}
                                  style={{ ...buttonPrimary, width: "100%", marginTop: 6, padding: "4px 6px", fontSize: 11 }}
                                >
                                  {t("שייך אליי")}
                                </button>
                              )}

                              {canEdit ? (
                                <select
                                  value={l.process_status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => changeProcessStatus(l, e.target.value)}
                                  style={{ ...inputStyle, marginTop: 6, padding: "4px 6px", fontSize: 10.5 }}
                                >
                                  {PROCESS_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{tStatus(s)}</option>)}
                                </select>
                              ) : (
                                <div style={{ marginTop: 6, fontSize: 10, color: colors.muted, textAlign: "center" }}>
                                  {t("רק")} {repName(l.claimed_by)} {t("או מנהל יכולים לשנות סטטוס")}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
