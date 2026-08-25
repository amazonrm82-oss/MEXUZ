import React, { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { useRealtimeList } from "../lib/useTable";
import { useOrderLines } from "../lib/useOrderLines";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { money } from "../lib/format";
import { TWO_WEEKS_MS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function PaymentDuesView({ leads, profile, openLead, actions, t }) {
  const { revenueFor } = useOrderLines();
  const mgr = canActLikeManager(profile);
  const { rows: supplierCharges } = useRealtimeList("supplier_charges", { orderBy: "created_at", ascending: false });
  const dues = useMemo(() => leads.filter((l) => l.owes_payment), [leads]);
  const [payInputs, setPayInputs] = useState({});

  function supplierCostFor(leadId) {
    return supplierCharges.filter((s) => s.lead_id === leadId).reduce((s, c) => s + Number(c.amount || 0), 0);
  }

  return (
    <div>
      <PageHeader icon={CreditCard} title={t("חייבים בתשלום")} subtitle={`${dues.length} ${t("עסקאות")}`} />
      {dues.length === 0 && <EmptyState icon={CreditCard} text={t("אין חייבים בתשלום")} />}
      <div style={{ display: "grid", gap: 10 }}>
        {dues.map((l) => {
          const revenue = revenueFor(l.id);
          const remaining = revenue - (l.paid_amount || 0);
          const late = l.unpaid_since && Date.now() - new Date(l.unpaid_since).getTime() > TWO_WEEKS_MS;
          const grossProfit = revenue - (l.expense || 0) - supplierCostFor(l.id);
          const canEdit = mgr || l.claimed_by === profile.id;
          return (
            <div key={l.id} style={{
              ...panelStyle,
              border: late ? `1.5px solid ${colors.danger}` : "none",
              background: late ? "#fbe9e7" : panelStyle.background,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => openLead(l.id)}>
                <div>
                  <div style={{ fontWeight: 700 }}>{l.name} · {l.business_name}</div>
                  <div style={{ fontSize: 12.5, color: colors.mutedText }}>{t("שולם")} {money(l.paid_amount || 0)} {t("מתוך")} {money(revenue)}</div>
                </div>
                <div style={{ fontWeight: 800, color: late ? colors.danger : colors.text }}>{t("נותר")} {money(remaining)}</div>
              </div>
              {mgr && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, fontSize: 12.5 }}>
                  <span>{t("רווח גולמי")}: {money(grossProfit)}</span>
                  <input
                    type="number" style={{ ...inputStyle, width: 100 }} placeholder={t("הוצאה נוספת")}
                    defaultValue={l.expense || ""} onBlur={(e) => actions.updateExpense(l.id, e.target.value)}
                  />
                </div>
              )}
              {canEdit ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    type="number" style={{ ...inputStyle, width: 120 }} placeholder={t("סכום תשלום")}
                    value={payInputs[l.id] || ""} onChange={(e) => setPayInputs((s) => ({ ...s, [l.id]: e.target.value }))}
                  />
                  <button onClick={() => { actions.addPayment(l, payInputs[l.id], revenue); setPayInputs((s) => ({ ...s, [l.id]: "" })); }} style={buttonPrimary}>{t("רשום תשלום")}</button>
                  {mgr && <button onClick={() => actions.markDealPaid(l.id)} style={buttonGhost}>{t("סמן כשולם במלואו")}</button>}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: colors.mutedText, marginTop: 8 }}>{t("רק הנציג המשויך או מנהל יכולים לרשום תשלום")}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
