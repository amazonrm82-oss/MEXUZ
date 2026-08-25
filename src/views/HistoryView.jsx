import React, { useMemo } from "react";
import { Archive } from "lucide-react";
import { useRealtimeList } from "../lib/useTable";
import { useOrderLines } from "../lib/useOrderLines";
import { colors, panelStyle, buttonGhost } from "../lib/theme";
import { money, fmtDate } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import { downloadCsv } from "../lib/exportCsv";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function HistoryView({ leads, profiles, profile, openLead, t }) {
  const { revenueFor } = useOrderLines();
  const mgr = canActLikeManager(profile);
  const { rows: charges } = useRealtimeList("supplier_charges", { orderBy: "created_at", ascending: false });
  const { rows: supplierNames } = useRealtimeList("suppliers_master", { orderBy: "name", ascending: true });
  const archived = useMemo(() => leads.filter((l) => l.archived).sort((a, b) => new Date(b.closed_at || 0) - new Date(a.closed_at || 0)), [leads]);

  function repName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }
  function supplierName(id) { return supplierNames.find((s) => s.id === id)?.name || "—"; }
  function supplierCostFor(leadId) {
    return charges.filter((c) => c.lead_id === leadId).reduce((s, c) => s + Number(c.amount || 0), 0);
  }

  function exportHistory() {
    const rows = archived.map((l) => {
      const revenue = revenueFor(l.id);
      const row = {
        שם: l.name, "שם עסק": l.business_name || "", נציג: repName(l.claimed_by), "נסגר בתאריך": fmtDate(l.closed_at), הכנסה: revenue,
      };
      if (mgr) row["רווח גולמי"] = revenue - (l.expense || 0) - supplierCostFor(l.id);
      return row;
    });
    downloadCsv(`היסטוריית_עסקאות_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        icon={Archive} title={t("היסטוריה")} subtitle={`${archived.length} ${t("עסקאות בארכיון")}`}
        actions={[<button key="export" onClick={exportHistory} style={buttonGhost}>{t("ייצוא לאקסל")}</button>]}
      />
      {archived.length === 0 ? (
        <EmptyState icon={Archive} text={t("אין עסקאות בהיסטוריה")} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {archived.map((l) => {
            const linked = charges.filter((c) => c.lead_id === l.id);
            const revenue = revenueFor(l.id);
            const grossProfit = revenue - (l.expense || 0) - supplierCostFor(l.id);
            return (
              <div key={l.id} className="clickable-card" style={{ ...panelStyle, cursor: "pointer" }} onClick={() => openLead(l.id)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{l.name} · {l.business_name}</div>
                    <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("נציג")}: {repName(l.claimed_by)} · {t("נסגר")}: {fmtDate(l.closed_at)}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800 }}>{money(revenue)}</div>
                    {mgr && <div style={{ fontSize: 11.5, color: colors.mutedText, marginTop: 2 }}>{t("רווח גולמי")}: {money(grossProfit)}</div>}
                  </div>
                </div>
                {linked.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: colors.mutedText }}>
                    {linked.map((c) => (
                      <div key={c.id}>{supplierName(c.supplier_id)}: {money(c.amount)} {c.paid ? `(${t("שולם")})` : `(${t("לא שולם")})`}</div>
                    ))}
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
