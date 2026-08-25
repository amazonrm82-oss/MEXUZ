import React, { useMemo } from "react";
import { XCircle } from "lucide-react";
import { colors, panelStyle, buttonGhost } from "../lib/theme";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function CanceledView({ leads, profile, openLead, actions, t }) {
  const mgr = canActLikeManager(profile);
  const canceled = useMemo(() => leads.filter((l) => l.canceled), [leads]);
  return (
    <div>
      <PageHeader icon={XCircle} title={t("לידים שבוטלו")} subtitle={`${canceled.length} ${t("לידים")}`} />
      {canceled.length === 0 ? (
        <EmptyState icon={XCircle} text={t("אין לידים שבוטלו")} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {canceled.map((l) => {
            const canEdit = mgr || l.claimed_by === profile.id;
            return (
              <div key={l.id} className="clickable-card" style={{ ...panelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ cursor: "pointer" }} onClick={() => openLead(l.id)}>
                  <div style={{ fontWeight: 700 }}>{l.name} · {l.business_name}</div>
                  <div style={{ fontSize: 12.5, color: "#4b5566" }}>{l.product}</div>
                </div>
                {canEdit ? (
                  <button onClick={() => actions.restoreLead(l.id)} style={buttonGhost}>{t("שחזור")}</button>
                ) : (
                  <div style={{ fontSize: 11, color: colors.mutedText }}>{t("רק הנציג המשויך או מנהל יכולים לשחזר")}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
