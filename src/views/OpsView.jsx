import React, { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { colors } from "../lib/theme";
import { OPS_STATUS_OPTIONS } from "../lib/constants";
import { canActLikeManager } from "../lib/permissions";

const STAGE_ACCENTS = ["#3548c7", "#4a5fd6", "#5a76e0", "#0ea5a5", "#14b8a6", "#0d9488", "#4f8f5e"];

export default function OpsView({ leads, profile, actions, openLead, t, tStatus }) {
  const mgr = canActLikeManager(profile);
  const inOps = useMemo(() => leads.filter((l) => l.ops_status && !l.archived && !l.canceled), [leads]);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t("תפעול")}</div>
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${OPS_STATUS_OPTIONS.length}, minmax(0, 1fr))`, gap: 10,
      }}>
        {OPS_STATUS_OPTIONS.map((stage, i) => {
          const stageLeads = inOps.filter((l) => l.ops_status === stage);
          const accent = STAGE_ACCENTS[i];
          return (
            <div key={stage} style={{
              background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.05)",
              display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden",
            }}>
              <div style={{ padding: "10px 10px 8px", borderBottom: `2px solid ${accent}` }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.text, lineHeight: 1.3, minHeight: 28 }}>{tStatus(stage)}</div>
                <div style={{ fontSize: 10.5, color: colors.muted, marginTop: 2 }}>{stageLeads.length} {t("עסקאות")}</div>
              </div>
              <div style={{ padding: 6, display: "grid", gap: 6, flex: 1 }}>
                {stageLeads.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => openLead(l.id)}
                    style={{
                      background: colors.bg, borderRadius: 9, padding: "7px 8px", cursor: "pointer",
                      borderInlineStart: `3px solid ${accent}`, transition: "transform .1s",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                    <div style={{ fontSize: 10, color: colors.mutedText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.business_name}</div>

                    {stage !== "נמסר ללקוח" && (i < OPS_STATUS_OPTIONS.length - 2 || mgr) && (mgr || l.claimed_by === profile.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); actions.advanceOps(l); }}
                        title={t("קדם שלב")}
                        style={{
                          marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                          width: "100%", fontSize: 9.5, padding: "3px 4px", borderRadius: 6, border: "none",
                          background: "#fff", color: accent, cursor: "pointer", fontWeight: 700,
                        }}
                      >
                        {t("קדם")} <ChevronLeft size={11} />
                      </button>
                    )}
                    {stage === "נמסר ללקוח" && mgr && (
                      <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
                        <button onClick={(e) => { e.stopPropagation(); actions.markDealPaid(l.id); }} style={{ flex: 1, fontSize: 9.5, padding: "3px 2px", borderRadius: 6, border: "none", background: "#fff", color: "#4f8f5e", cursor: "pointer", fontWeight: 700 }}>{t("שילם")}</button>
                        <button onClick={(e) => { e.stopPropagation(); actions.markDealUnpaid(l); }} style={{ flex: 1, fontSize: 9.5, padding: "3px 2px", borderRadius: 6, border: "none", background: "#fff", color: colors.danger, cursor: "pointer", fontWeight: 700 }}>{t("לא שילם")}</button>
                      </div>
                    )}
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div style={{ fontSize: 10.5, color: colors.muted, textAlign: "center", padding: "10px 0" }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
