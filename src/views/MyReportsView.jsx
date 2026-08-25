import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { colors, buttonPrimary, buttonGhost } from "../lib/theme";
import { money } from "../lib/format";
import { commissionRateFor } from "../lib/constants";
import { useOrderLines } from "../lib/useOrderLines";
import { PERIOD_TYPES, periodLabelsFor, periodIndexFor, YEAR_COLORS } from "../lib/periodHelpers";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const METRICS = [
  ["revenue", "הכנסות", true],
  ["commission", "רווח (עמלה)", true],
  ["deals", "עסקאות שנסגרו", false],
  ["newCustomers", "לקוחות חדשים", false],
  ["returningCustomers", "לקוחות חוזרים", false],
  ["canceledLeads", "לידים שבוטלו", false],
];

function emptyMetrics() {
  return { revenue: 0, commission: 0, deals: 0, newCustomers: 0, returningCustomers: 0, canceledLeads: 0 };
}

// Same shape as the manager-only ReportsView, but scoped to the current rep's own leads —
// available to everyone so each employee can track their own trend, not just company-wide.
export default function MyReportsView({ leads, profile, t }) {
  const { revenueFor } = useOrderLines();
  const [periodType, setPeriodType] = useState("month");
  const [metric, setMetric] = useState("revenue");
  const rate = commissionRateFor(profile.role);

  const myLeads = useMemo(() => leads.filter((l) => l.claimed_by === profile.id), [leads, profile.id]);
  const closedLeads = useMemo(() => myLeads.filter((l) => l.closed_at), [myLeads]);
  const canceledLeadsList = useMemo(() => myLeads.filter((l) => l.canceled && l.canceled_at), [myLeads]);

  const firstCloseIdByPhone = useMemo(() => {
    const map = new Map();
    const sorted = [...closedLeads].sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at));
    for (const l of sorted) {
      const key = l.phone || l.id;
      if (!map.has(key)) map.set(key, l.id);
    }
    return map;
  }, [closedLeads]);

  const years = useMemo(() => {
    const set = new Set([
      ...closedLeads.map((l) => new Date(l.closed_at).getFullYear()),
      ...canceledLeadsList.map((l) => new Date(l.canceled_at).getFullYear()),
    ]);
    return Array.from(set).sort((a, b) => a - b);
  }, [closedLeads, canceledLeadsList]);

  const [visibleYears, setVisibleYears] = useState(null);
  const activeYears = visibleYears || years;

  const { chartData, tableRows, totalsByYear } = useMemo(() => {
    const labels = periodLabelsFor(periodType);
    const buckets = {};
    years.forEach((y) => { buckets[y] = labels.map(() => emptyMetrics()); });

    closedLeads.forEach((l) => {
      const d = new Date(l.closed_at);
      const y = d.getFullYear();
      const idx = periodIndexFor(periodType, d);
      if (!buckets[y]) return;
      const rev = revenueFor(l.id);
      buckets[y][idx].revenue += rev;
      buckets[y][idx].commission += rev * rate;
      buckets[y][idx].deals += 1;
      if (firstCloseIdByPhone.get(l.phone || l.id) === l.id) buckets[y][idx].newCustomers += 1;
      else buckets[y][idx].returningCustomers += 1;
    });

    canceledLeadsList.forEach((l) => {
      const d = new Date(l.canceled_at);
      const y = d.getFullYear();
      const idx = periodIndexFor(periodType, d);
      if (!buckets[y]) return;
      buckets[y][idx].canceledLeads += 1;
    });

    const chart = labels.map((label, i) => {
      const row = { period: t(label) };
      activeYears.forEach((y) => { row[y] = Math.round((buckets[y]?.[i]?.[metric] || 0) * 100) / 100; });
      return row;
    });

    const totals = {};
    years.forEach((y) => { totals[y] = buckets[y].reduce((s, p) => s + p[metric], 0); });

    return { chartData: chart, tableRows: labels.map((label, i) => ({ label, i })), totalsByYear: totals };
  }, [periodType, metric, years, activeYears, closedLeads, canceledLeadsList, revenueFor, rate, firstCloseIdByPhone, t]);

  function toggleYear(y) {
    setVisibleYears((cur) => {
      const base = cur || years;
      const next = base.includes(y) ? base.filter((x) => x !== y) : [...base, y];
      return next.length ? next : years;
    });
  }

  const isMoney = METRICS.find((m) => m[0] === metric)?.[2];
  const fmt = (v) => (isMoney ? money(v) : String(v));

  return (
    <div>
      <PageHeader icon={LineChartIcon} title={t("הדוח שלי")} subtitle={t("הביצועים האישיים שלך לאורך זמן")} />

      {years.length === 0 ? (
        <EmptyState icon={LineChartIcon} text={t("עדיין אין לך מספיק עסקאות סגורות להצגת דוח")} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {METRICS.map(([key, label]) => (
              <button key={key} onClick={() => setMetric(key)} style={metric === key ? buttonPrimary : buttonGhost}>{t(label)}</button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {PERIOD_TYPES.map(([key, label]) => (
                <button key={key} onClick={() => setPeriodType(key)} style={periodType === key ? buttonPrimary : buttonGhost}>{t(label)}</button>
              ))}
            </div>
            {years.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {years.map((y, i) => {
                  const on = activeYears.includes(y);
                  return (
                    <button
                      key={y} onClick={() => toggleYear(y)}
                      style={{
                        padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${YEAR_COLORS[i % YEAR_COLORS.length]}`,
                        background: on ? YEAR_COLORS[i % YEAR_COLORS.length] : "#fff",
                        color: on ? "#fff" : YEAR_COLORS[i % YEAR_COLORS.length], fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                      }}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 16, height: 320, marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="period" tick={{ fontSize: 11.5 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}` }} />
                <Legend />
                {activeYears.map((y) => (
                  <Line key={y} type="monotone" dataKey={y} name={String(y)} stroke={YEAR_COLORS[years.indexOf(y) % YEAR_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 16, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("תקופה")}</th>
                  {activeYears.map((y) => <th key={y} style={thStyle}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ label, i }) => (
                  <tr key={label}>
                    <td style={tdStyle}>{t(label)}</td>
                    {activeYears.map((y) => (
                      <td key={y} style={tdStyle}>{fmt(chartData[i]?.[y] || 0)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 800, borderTop: `2px solid ${colors.border}` }}>{t('סה"כ שנתי')}</td>
                  {activeYears.map((y) => (
                    <td key={y} style={{ ...tdStyle, fontWeight: 800, borderTop: `2px solid ${colors.border}` }}>{fmt(totalsByYear[y] || 0)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = { textAlign: "right", padding: "8px 10px", color: colors.mutedText, fontWeight: 700, borderBottom: `1px solid ${colors.border}` };
const tdStyle = { padding: "7px 10px", borderBottom: `1px solid ${colors.bg}` };
