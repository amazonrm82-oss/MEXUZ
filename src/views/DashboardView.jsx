import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, CheckCircle2, Crown } from "lucide-react";
import { colors, buttonPrimary, buttonGhost } from "../lib/theme";
import { money, fmtDate } from "../lib/format";
import { commissionRateFor } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import { useOrderLines } from "../lib/useOrderLines";

const PERIODS = [["day", "יום"], ["week", "שבוע"], ["month", "חודש"], ["all", "הכל"]];
const PERIOD_MS = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };

export default function DashboardView({ leads, profile, profiles, openLead, t, tStatus }) {
  const { revenueFor } = useOrderLines();
  const [period, setPeriod] = useState("month");
  const mgr = canActLikeManager(profile);

  const inPeriod = useMemo(() => {
    if (period === "all") return leads;
    const cutoff = Date.now() - PERIOD_MS[period];
    return leads.filter((l) => new Date(l.closed_at || l.received_at).getTime() >= cutoff);
  }, [leads, period]);

  const visibleReps = mgr ? profiles.filter((p) => !p.is_super_admin) : [profile];

  const stats = useMemo(() => visibleReps.map((rep) => {
    const repLeads = inPeriod.filter((l) => l.claimed_by === rep.id);
    const closed = repLeads.filter((l) => l.closed_at).sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    const revenue = closed.reduce((s, l) => s + revenueFor(l.id), 0);
    const rate = commissionRateFor(rep.role);
    const commission = canActLikeManager(rep) ? null : revenue * rate;
    const withClaim = repLeads.filter((l) => l.claimed_at);
    const avgResponseMs = withClaim.length
      ? withClaim.reduce((s, l) => s + (new Date(l.claimed_at).getTime() - new Date(l.received_at).getTime()), 0) / withClaim.length
      : null;
    return { rep, leadsCount: repLeads.length, closedCount: closed.length, revenue, commission, closed, avgResponseMs };
  }).sort((a, b) => b.revenue - a.revenue), [visibleReps, inPeriod, revenueFor]);

  const chartData = stats.filter((s) => s.revenue > 0).map((s) => ({ name: s.rep.name, revenue: s.revenue }));
  const totalRevenue = stats.reduce((s, x) => s + x.revenue, 0);
  const totalClosed = stats.reduce((s, x) => s + x.closedCount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{t("ביצועים")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIODS.map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)} style={period === key ? buttonPrimary : buttonGhost}>{t(label)}</button>
          ))}
        </div>
      </div>

      {mgr && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SummaryTile icon={<TrendingUp size={18} />} label={t('סה"כ הכנסה')} value={money(totalRevenue)} />
          <SummaryTile icon={<CheckCircle2 size={18} />} label={t("עסקאות שנסגרו")} value={totalClosed} />
          <SummaryTile icon={<Users size={18} />} label={t("נציגים פעילים")} value={stats.filter((s) => s.leadsCount > 0).length} />
        </div>
      )}

      {mgr && chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 16, height: 260, marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <Bar dataKey="revenue" fill={colors.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {stats.map((s, i) => (
          <RepCard key={s.rep.id} stat={s} openLead={openLead} revenueFor={revenueFor} isTop={i === 0 && s.revenue > 0} t={t} tStatus={tStatus} />
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ icon, label, value }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: colors.bg, color: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11.5, color: colors.muted }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function formatResponseTime(ms, t) {
  if (ms == null) return null;
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.round(ms / 60000)} ${t("דק'")}`;
  if (hours < 48) return `${hours.toFixed(1)} ${t("שעות")}`;
  return `${(hours / 24).toFixed(1)} ${t("ימים")}`;
}

function RepCard({ stat, openLead, revenueFor, isTop, t, tStatus }) {
  const { rep, leadsCount, closedCount, revenue, commission, closed, avgResponseMs } = stat;
  return (
    <div style={{
      background: "#fff", borderRadius: 14, boxShadow: isTop ? "0 4px 16px rgba(198,113,57,.18)" : "0 2px 10px rgba(0,0,0,.06)",
      overflow: "hidden", display: "flex", flexDirection: "column",
      border: isTop ? `1.5px solid ${colors.header}` : "1.5px solid transparent",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}`, position: "relative" }}>
        {isTop && (
          <Crown
            size={20} color={colors.header} fill={colors.header}
            style={{ position: "absolute", top: -12, insetInlineStart: 16, transform: "rotate(-18deg)" }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>{rep.name}</div>
            <div style={{ fontSize: 11.5, color: colors.muted }}>{tStatus(rep.role)}</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: colors.accent }}>{money(revenue)}</div>
            {commission != null && <div style={{ fontSize: 11, color: colors.muted }}>{t("עמלה")}: {money(commission)}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11.5, color: colors.mutedText, flexWrap: "wrap" }}>
          <span>{leadsCount} {t("לידים")}</span>
          <span>·</span>
          <span>{closedCount} {t("עסקאות")}</span>
          {avgResponseMs != null && (
            <>
              <span>·</span>
              <span>{t("זמן תגובה ממוצע")}: {formatResponseTime(avgResponseMs, t)}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {closed.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12.5, color: colors.muted, textAlign: "center" }}>{t("אין עסקאות בתקופה זו")}</div>
        ) : (
          closed.map((l) => {
            const rev = revenueFor(l.id);
            return (
              <div
                key={l.id}
                onClick={() => openLead(l.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px",
                  borderBottom: `1px solid ${colors.bg}`, cursor: "pointer", fontSize: 12.5,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: colors.muted }}>{l.business_name} · {fmtDate(l.closed_at)}</div>
                </div>
                <div style={{ fontWeight: 700, flexShrink: 0, marginInlineStart: 8 }}>{money(rev)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
