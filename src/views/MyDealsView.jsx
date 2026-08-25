import React, { useMemo } from "react";
import { Briefcase } from "lucide-react";
import { colors, panelStyle } from "../lib/theme";
import { money } from "../lib/format";
import { commissionRateFor } from "../lib/constants";
import { useOrderLines } from "../lib/useOrderLines";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function MyDealsView({ leads, profile, openLead, t }) {
  const { revenueFor } = useOrderLines();
  const rate = commissionRateFor(profile.role);
  const myDeals = useMemo(
    () => leads.filter((l) => l.claimed_by === profile.id && l.closed_at).sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)),
    [leads, profile.id]
  );
  const totalRevenue = myDeals.reduce((s, l) => s + revenueFor(l.id), 0);

  return (
    <div>
      <PageHeader icon={Briefcase} title={t("העסקאות שלי")} subtitle={`${myDeals.length} ${t("עסקאות")}`} />
      <div style={{ ...panelStyle, marginBottom: 14, display: "flex", gap: 24 }}>
        <Stat label={t("עסקאות")} value={myDeals.length} />
        <Stat label={t('סה"כ הכנסה')} value={money(totalRevenue)} />
        <Stat label={t("עמלה")} value={money(totalRevenue * rate)} />
      </div>
      {myDeals.length === 0 ? (
        <EmptyState icon={Briefcase} text={t("עדיין לא נסגרו עסקאות")} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {myDeals.map((l) => {
            const rev = revenueFor(l.id);
            return (
              <div key={l.id} className="clickable-card" style={{ ...panelStyle, cursor: "pointer" }} onClick={() => openLead(l.id)}>
                <div style={{ fontWeight: 700 }}>{l.name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 13 }}>· {l.business_name}</span></div>
                <div style={{ fontSize: 13, color: colors.mutedText, marginTop: 2 }}>
                  {money(rev)} · {t("עמלה")} {money(rev * rate)} {l.pending_approval && <span style={{ color: colors.header }}>· {t("ממתין לאישור")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: colors.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
