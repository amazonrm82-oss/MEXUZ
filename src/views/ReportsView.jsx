import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { colors, buttonPrimary, buttonGhost, inputStyle } from "../lib/theme";
import { money } from "../lib/format";
import { commissionRateFor } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import { useOrderLines } from "../lib/useOrderLines";
import { useRealtimeList } from "../lib/useTable";
import { PERIOD_TYPES, periodLabelsFor, periodIndexFor, YEAR_COLORS } from "../lib/periodHelpers";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

const METRICS = [
  ["revenue", "הכנסות", true],
  ["deals", "עסקאות שנסגרו", false],
  ["newCustomers", "לקוחות חדשים", false],
  ["returningCustomers", "לקוחות חוזרים", false],
  ["newSuppliers", "ספקים חדשים", false],
  ["canceledLeads", "לידים שבוטלו", false],
];

function emptyMetrics() {
  return { revenue: 0, deals: 0, newCustomers: 0, returningCustomers: 0, newSuppliers: 0, canceledLeads: 0 };
}

export default function ReportsView({ leads, profiles, t }) {
  const { revenueFor } = useOrderLines();
  const { rows: supplierRows } = useRealtimeList("suppliers_master", { orderBy: "created_at", ascending: true });
  const [tab, setTab] = useState("trends"); // 'trends' | 'salaries' | 'channels'
  const [periodType, setPeriodType] = useState("month");
  const [metric, setMetric] = useState("revenue");

  const closedLeads = useMemo(() => leads.filter((l) => l.closed_at), [leads]);
  const canceledLeadsList = useMemo(() => leads.filter((l) => l.canceled && l.canceled_at), [leads]);

  // First closed deal per phone number = "new customer"; any later one = "returning".
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
      ...supplierRows.map((s) => new Date(s.created_at).getFullYear()),
    ]);
    return Array.from(set).sort((a, b) => a - b);
  }, [closedLeads, canceledLeadsList, supplierRows]);

  const [visibleYears, setVisibleYears] = useState(null); // null = all
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
      buckets[y][idx].revenue += revenueFor(l.id);
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

    supplierRows.forEach((s) => {
      const d = new Date(s.created_at);
      const y = d.getFullYear();
      const idx = periodIndexFor(periodType, d);
      if (!buckets[y]) return;
      buckets[y][idx].newSuppliers += 1;
    });

    const chart = labels.map((label, i) => {
      const row = { period: t(label) };
      activeYears.forEach((y) => { row[y] = Math.round((buckets[y]?.[i]?.[metric] || 0) * 100) / 100; });
      return row;
    });

    const totals = {};
    years.forEach((y) => { totals[y] = buckets[y].reduce((s, p) => s + p[metric], 0); });

    return { chartData: chart, tableRows: labels.map((label, i) => ({ label, i })), totalsByYear: totals };
  }, [periodType, metric, years, activeYears, closedLeads, canceledLeadsList, supplierRows, revenueFor, firstCloseIdByPhone, t]);

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
      <PageHeader icon={BarChart3} title={t("דוחות תקופתיים")} subtitle={t("השוואת ביצועים בין שנים")} />

      {years.length === 0 ? (
        <EmptyState icon={BarChart3} text={t("עדיין אין מספיק נתונים להצגת דוח")} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 2, background: colors.bg, borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 16 }}>
            {[["trends", "מגמות"], ["salaries", "משכורות חודשיות"], ["channels", "לפי ערוץ"]].map(([key, label]) => (
              <button
                key={key} onClick={() => setTab(key)}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5,
                  background: tab === key ? "#fff" : "transparent", fontWeight: tab === key ? 700 : 500,
                  color: colors.text, boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,.15)" : "none",
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {tab === "salaries" ? (
            <SalariesTable leads={leads} profiles={profiles} revenueFor={revenueFor} years={years} periodType={periodType} setPeriodType={setPeriodType} t={t} />
          ) : tab === "channels" ? (
            <ChannelsTable leads={leads} revenueFor={revenueFor} t={t} />
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
        </>
      )}
    </div>
  );
}

function SalariesTable({ leads, profiles, revenueFor, years, periodType, setPeriodType, t }) {
  const salaryReps = useMemo(() => (profiles || []).filter((p) => !p.is_super_admin && !canActLikeManager(p)), [profiles]);
  const [year, setYear] = useState(years[years.length - 1]);
  const activeYear = years.includes(year) ? year : years[years.length - 1];

  const closedLeads = useMemo(() => leads.filter((l) => l.closed_at), [leads]);
  const labels = periodLabelsFor(periodType);

  const table = useMemo(() => {
    const byRep = {};
    salaryReps.forEach((r) => { byRep[r.id] = labels.map(() => 0); });
    closedLeads.forEach((l) => {
      const d = new Date(l.closed_at);
      if (d.getFullYear() !== activeYear) return;
      if (!byRep[l.claimed_by]) return;
      const idx = periodIndexFor(periodType, d);
      const rep = salaryReps.find((r) => r.id === l.claimed_by);
      byRep[l.claimed_by][idx] += revenueFor(l.id) * commissionRateFor(rep.role);
    });
    return byRep;
  }, [closedLeads, salaryReps, activeYear, periodType, labels, revenueFor]);

  if (salaryReps.length === 0) return <EmptyState icon={BarChart3} text={t("אין נציגים עם עמלה להצגה")} />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIOD_TYPES.map(([key, label]) => (
            <button key={key} onClick={() => setPeriodType(key)} style={periodType === key ? buttonPrimary : buttonGhost}>{t(label)}</button>
          ))}
        </div>
        <select style={{ ...inputStyle, width: 100 }} value={activeYear} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t("נציג")}</th>
              {labels.map((l) => <th key={l} style={thStyle}>{t(l)}</th>)}
              <th style={thStyle}>{t('סה"כ')}</th>
            </tr>
          </thead>
          <tbody>
            {salaryReps.map((r) => {
              const row = table[r.id] || labels.map(() => 0);
              const total = row.reduce((s, v) => s + v, 0);
              return (
                <tr key={r.id}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{r.name}</td>
                  {row.map((v, i) => <td key={i} style={tdStyle}>{money(v)}</td>)}
                  <td style={{ ...tdStyle, fontWeight: 800 }}>{money(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Which channels/ads actually bring in closed deals — leads has no year-of-received-date
// selector elsewhere, so this tab keeps its own (based on received_at, not closed_at).
function ChannelsTable({ leads, revenueFor, t }) {
  const receivedYears = useMemo(() => {
    const set = new Set(leads.map((l) => new Date(l.received_at).getFullYear()));
    return Array.from(set).sort((a, b) => a - b);
  }, [leads]);
  const [year, setYear] = useState(receivedYears[receivedYears.length - 1]);
  const activeYear = receivedYears.includes(year) ? year : receivedYears[receivedYears.length - 1];
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => {
    const byChannel = {};
    leads.filter((l) => new Date(l.received_at).getFullYear() === activeYear).forEach((l) => {
      const key = l.channel || "—";
      if (!byChannel[key]) byChannel[key] = { channel: key, total: 0, closed: 0, revenue: 0, byAd: {} };
      const c = byChannel[key];
      c.total += 1;
      if (l.closed_at) { c.closed += 1; c.revenue += revenueFor(l.id); }
      const adKey = l.ad_name || "ללא שם מודעה";
      if (!c.byAd[adKey]) c.byAd[adKey] = { ad: adKey, total: 0, closed: 0, revenue: 0 };
      c.byAd[adKey].total += 1;
      if (l.closed_at) { c.byAd[adKey].closed += 1; c.byAd[adKey].revenue += revenueFor(l.id); }
    });
    return Object.values(byChannel).sort((a, b) => b.revenue - a.revenue);
  }, [leads, activeYear, revenueFor]);

  if (receivedYears.length === 0) return <EmptyState icon={BarChart3} text={t("עדיין אין לידים להצגת פילוח")} />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <select style={{ ...inputStyle, width: 100 }} value={activeYear} onChange={(e) => setYear(Number(e.target.value))}>
          {receivedYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", padding: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t("ערוץ")}</th>
              <th style={thStyle}>{t("לידים")}</th>
              <th style={thStyle}>{t("עסקאות סגורות")}</th>
              <th style={thStyle}>{t("אחוז המרה")}</th>
              <th style={thStyle}>{t("הכנסות")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const conv = r.total ? Math.round((r.closed / r.total) * 1000) / 10 : 0;
              const isOpen = expanded === r.channel;
              const ads = Object.values(r.byAd).sort((a, b) => b.revenue - a.revenue);
              return (
                <React.Fragment key={r.channel}>
                  <tr className="clickable-card" style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : r.channel)}>
                    <td style={{ ...tdStyle, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      {isOpen ? <ChevronUp size={13} color={colors.muted} /> : <ChevronDown size={13} color={colors.muted} />}
                      {r.channel}
                    </td>
                    <td style={tdStyle}>{r.total}</td>
                    <td style={tdStyle}>{r.closed}</td>
                    <td style={tdStyle}>{conv}%</td>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{money(r.revenue)}</td>
                  </tr>
                  {isOpen && ads.map((a) => {
                    const adConv = a.total ? Math.round((a.closed / a.total) * 1000) / 10 : 0;
                    return (
                      <tr key={a.ad} style={{ background: colors.bg }}>
                        <td style={{ ...tdStyle, paddingInlineStart: 28, color: colors.mutedText }}>{a.ad}</td>
                        <td style={{ ...tdStyle, color: colors.mutedText }}>{a.total}</td>
                        <td style={{ ...tdStyle, color: colors.mutedText }}>{a.closed}</td>
                        <td style={{ ...tdStyle, color: colors.mutedText }}>{adConv}%</td>
                        <td style={{ ...tdStyle, color: colors.mutedText }}>{money(a.revenue)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const thStyle = { textAlign: "right", padding: "8px 10px", color: colors.mutedText, fontWeight: 700, borderBottom: `1px solid ${colors.border}` };
const tdStyle = { padding: "7px 10px", borderBottom: `1px solid ${colors.bg}` };
