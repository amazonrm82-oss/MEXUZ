import React, { useMemo } from "react";
import { Bell } from "lucide-react";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { useOrderLines } from "../lib/useOrderLines";
import { money, fmtDate } from "../lib/format";
import { TWO_WEEKS_MS, UNCLAIMED_ALERT_MS, STUCK_LEAD_MS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";

const RENEWAL_WARNING_DAYS = 30;
const STALE_TICKET_MS = 3 * 24 * 3600 * 1000;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - Date.now()) / 86400000);
}

export default function NotificationsView({ leads, profile, openLead, actions, setView, t, tStatus }) {
  const mgr = canActLikeManager(profile);
  const { rows: allNotes } = useRealtimeList("lead_notes", { orderBy: "follow_up", ascending: true });
  const { rows: systems } = useRealtimeList("company_systems", { orderBy: "sort_order", ascending: true });
  const { rows: tickets } = useRealtimeList("support_tickets", { orderBy: "created_at", ascending: true });
  const { rows: systemCharges } = useRealtimeList("system_charges", { orderBy: "due_date", ascending: true });
  const { linesFor } = useOrderLines();

  const systemName = (id) => systems.find((s) => s.id === id)?.name || "—";

  const renewalsSoon = useMemo(() => systems.filter((s) => {
    if (s.status !== "active") return false;
    const days = daysUntil(s.renewal_date);
    return days != null && days <= RENEWAL_WARNING_DAYS;
  }), [systems]);

  const overdueCharges = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return systemCharges.filter((c) => !c.paid && c.due_date <= today);
  }, [systemCharges]);

  const urgentTickets = useMemo(() => tickets.filter((tk) => tk.status !== "closed" && tk.priority === "urgent"), [tickets]);
  const staleTickets = useMemo(() => tickets.filter((tk) =>
    tk.status !== "closed" && tk.priority !== "urgent" && Date.now() - new Date(tk.created_at).getTime() > STALE_TICKET_MS
  ), [tickets]);

  const pending = useMemo(() => leads.filter((l) => l.pending_approval), [leads]);
  const late = useMemo(() => leads.filter((l) => l.owes_payment && l.unpaid_since && Date.now() - new Date(l.unpaid_since).getTime() > TWO_WEEKS_MS), [leads]);
  const unclaimed = useMemo(() => leads.filter((l) => !l.claimed_by && !l.canceled && !l.archived && !l.closed_at && Date.now() - new Date(l.received_at).getTime() > UNCLAIMED_ALERT_MS), [leads]);
  const stuck = useMemo(() => leads.filter((l) =>
    l.claimed_by && !l.canceled && !l.archived && !l.closed_at && l.process_status !== "לא מעוניין" &&
    l.status_changed_at && Date.now() - new Date(l.status_changed_at).getTime() > STUCK_LEAD_MS
  ), [leads]);
  const dueFollowUps = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allNotes.filter((n) => n.follow_up && n.follow_up <= today).map((n) => ({ note: n, lead: leads.find((l) => l.id === n.lead_id) })).filter((x) => x.lead);
  }, [allNotes, leads]);

  return (
    <div>
      <PageHeader icon={Bell} title={t("התראות")} />

      {urgentTickets.length > 0 && (
        <Block title={`${t("פניות תמיכה דחופות פתוחות")} (${urgentTickets.length})`}>
          {urgentTickets.map((tk) => (
            <div key={tk.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer", borderInlineStart: "4px solid #dc2626" }} onClick={() => setView("supportTickets")}>
              <div style={{ fontWeight: 700, color: colors.danger }}>{tk.title}</div>
              <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("נפתחה")} {fmtDate(tk.created_at)}</div>
            </div>
          ))}
        </Block>
      )}

      {staleTickets.length > 0 && (
        <Block title={`${t("פניות תמיכה פתוחות מעל 3 ימים")} (${staleTickets.length})`}>
          {staleTickets.map((tk) => (
            <div key={tk.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => setView("supportTickets")}>
              <div style={{ fontWeight: 700 }}>{tk.title}</div>
              <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("נפתחה")} {fmtDate(tk.created_at)}</div>
            </div>
          ))}
        </Block>
      )}

      {mgr && renewalsSoon.length > 0 && (
        <Block title={`${t("חוזים לקראת חידוש")} (${renewalsSoon.length})`}>
          {renewalsSoon.map((s) => {
            const days = daysUntil(s.renewal_date);
            return (
              <div key={s.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer", borderInlineStart: "4px solid #d97706" }} onClick={() => setView("ourSystems")}>
                <div style={{ fontWeight: 700 }}>{s.name} {s.client_name ? `· ${s.client_name}` : ""}</div>
                <div style={{ fontSize: 12.5, color: "#d97706" }}>
                  {days <= 0 ? t("החוזה פג!") : `${t("חידוש בעוד")} ${days} ${t("ימים")}`} · {money(s.monthly_fee)} {t("לחודש")}
                </div>
              </div>
            );
          })}
        </Block>
      )}

      {mgr && overdueCharges.length > 0 && (
        <Block title={`${t("חיובי מערכות שלא שולמו")} (${overdueCharges.length})`}>
          {overdueCharges.map((c) => (
            <div key={c.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer", borderInlineStart: `4px solid ${colors.danger}` }} onClick={() => setView("ourSystems")}>
              <div style={{ fontWeight: 700, color: colors.danger }}>{systemName(c.system_id)}</div>
              <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("לתאריך")} {c.due_date} · {money(c.amount)}</div>
            </div>
          ))}
        </Block>
      )}

      <Block title={`${t("עסקאות ממתינות לאישור")} (${pending.length})`}>
        {pending.map((l) => {
          const lines = linesFor(l.id);
          const hasMismatch = lines.some((o) => o.given_amount != null && Number(o.given_amount) !== Number(o.amount));
          return (
            <div key={l.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ cursor: "pointer" }} onClick={() => openLead(l.id)}>
                  <div style={{ fontWeight: 700 }}>{l.name} · {l.business_name}</div>
                  <div style={{ fontSize: 12.5, color: colors.mutedText }}>{money(lines.reduce((s, o) => s + Number(o.amount), 0))}</div>
                </div>
                {mgr ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => actions.approveDeal(l.id, false, lines)} style={buttonPrimary}>{t("אשר (מחיר מערכת)")}</button>
                    {hasMismatch && <button onClick={() => actions.approveDeal(l.id, true, lines)} style={buttonGhost}>{t("אשר (מחיר שניתן)")}</button>}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: colors.mutedText }}>{t("רק סגן או מנהל יכולים לאשר עסקה")}</div>
                )}
              </div>
            </div>
          );
        })}
        {pending.length === 0 && <Empty t={t} />}
      </Block>

      <Block title={`${t("חייבים באיחור מעל שבועיים")} (${late.length})`}>
        {late.map((l) => (
          <div key={l.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => openLead(l.id)}>
            <div style={{ fontWeight: 700, color: colors.danger }}>{l.name} · {l.business_name}</div>
            <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("ללא תשלום מאז")} {fmtDate(l.unpaid_since)}</div>
          </div>
        ))}
        {late.length === 0 && <Empty t={t} />}
      </Block>

      <Block title={`${t("לידים לא משויכים מעל 72 שעות")} (${unclaimed.length})`}>
        {unclaimed.map((l) => (
          <div key={l.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => openLead(l.id)}>
            <div style={{ fontWeight: 700, color: colors.danger }}>{l.name} · {l.business_name}</div>
            <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("התקבל")} {fmtDate(l.received_at)} · {tStatus(l.channel)}</div>
          </div>
        ))}
        {unclaimed.length === 0 && <Empty t={t} />}
      </Block>

      <Block title={`${t("לידים תקועים מעל שבוע")} (${stuck.length})`}>
        {stuck.map((l) => (
          <div key={l.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => openLead(l.id)}>
            <div style={{ fontWeight: 700 }}>{l.name} · {l.business_name}</div>
            <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("בסטטוס")} "{tStatus(l.process_status)}" {t("מאז")} {fmtDate(l.status_changed_at)}</div>
          </div>
        ))}
        {stuck.length === 0 && <Empty t={t} />}
      </Block>

      <Block title={`${t("תזכורות מעקב")} (${dueFollowUps.length})`}>
        {dueFollowUps.map(({ note, lead }) => (
          <div key={note.id} className="clickable-card" style={{ ...panelStyle, marginBottom: 8, cursor: "pointer" }} onClick={() => openLead(lead.id)}>
            <div style={{ fontWeight: 700 }}>{lead.name} · {lead.business_name}</div>
            <div style={{ fontSize: 12.5, color: colors.mutedText }}>{note.text} — {t("מעקב")}: {note.follow_up}</div>
          </div>
        ))}
        {dueFollowUps.length === 0 && <Empty t={t} />}
      </Block>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ t }) {
  return <div style={{ color: colors.muted, fontSize: 13 }}>{t("אין פריטים")}</div>;
}
