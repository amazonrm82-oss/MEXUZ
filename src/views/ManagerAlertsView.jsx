import React, { useMemo } from "react";
import { Flag, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { colors } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import PageHeader from "../components/PageHeader";

// Manager/deputy-only tab collecting every note ever flagged for management, across every lead —
// the persistent counterpart to the popup that fires on login (App.jsx). Unresolved ones stay
// pinned above, and handled ones move to a history list below so nothing ever really disappears.
export default function ManagerAlertsView({ profile, profiles, allLeads, flaggedNotes, openLead, t }) {
  const mgr = canActLikeManager(profile);
  const notes = flaggedNotes || [];

  const unresolved = useMemo(
    () => [...notes].filter((n) => !n.resolved).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [notes]
  );
  const resolved = useMemo(
    () => [...notes].filter((n) => n.resolved).sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at)),
    [notes]
  );

  function leadFor(id) { return allLeads.find((l) => l.id === id) || null; }
  function nameOf(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  async function resolve(note) {
    await supabase.from("lead_notes").update({
      resolved: true, resolved_by: profile.id, resolved_at: new Date().toISOString(),
    }).eq("id", note.id);
  }

  if (!mgr) {
    return (
      <div>
        <PageHeader icon={Flag} title={t("התראות למנהל")} />
        <div style={{ color: colors.muted, fontSize: 13 }}>{t("רק סגן או מנהל יכולים לצפות בהתראות למנהל")}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={Flag} title={t("התראות למנהל")} subtitle={t("הערות שסומנו לתשומת לב ההנהלה, מכל הלידים")} />

      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          {t("ממתינות לטיפול")} ({unresolved.length})
        </div>
        {unresolved.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>{t("אין התראות ממתינות")}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {unresolved.map((n) => {
            const lead = leadFor(n.lead_id);
            return (
              <div
                key={n.id}
                style={{
                  borderRadius: 14, padding: "14px 16px",
                  background: "linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)",
                  border: "1.5px solid #fca5a5", boxShadow: "0 3px 12px rgba(220,38,38,.15)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Flag size={18} color="#dc2626" fill="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      {lead ? (
                        <button
                          onClick={() => openLead(lead.id)}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontWeight: 800, fontSize: 14.5, color: colors.text, textAlign: "start" }}
                        >
                          {lead.name} {lead.business_name ? `· ${lead.business_name}` : ""}
                        </button>
                      ) : (
                        <div style={{ fontWeight: 800, fontSize: 14.5 }}>{t("ליד לא זמין")}</div>
                      )}
                      <div style={{ fontSize: 13.5, color: colors.text, marginTop: 5, lineHeight: 1.4 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
                        {nameOf(n.author_id)} · {fmtDate(n.created_at)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => resolve(n)}
                    style={{ border: "none", background: "#dc2626", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                  >
                    ✓ {t("סמן כטופל")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          {t("היסטוריית התראות שטופלו")} ({resolved.length})
        </div>
        {resolved.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>{t("אין עדיין התראות שטופלו")}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {resolved.map((n) => {
            const lead = leadFor(n.lead_id);
            return (
              <div
                key={n.id}
                style={{
                  borderRadius: 12, padding: "11px 14px",
                  background: "linear-gradient(135deg, #ecfdf9 0%, #f0fdfa 100%)",
                  border: "1.5px solid #99e6d8", boxShadow: "0 2px 8px rgba(14,165,165,.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle2 size={16} color="#0ea5a5" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {lead ? (
                      <button
                        onClick={() => openLead(lead.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontWeight: 700, fontSize: 13.5, color: colors.text, textAlign: "start" }}
                      >
                        {lead.name} {lead.business_name ? `· ${lead.business_name}` : ""}
                      </button>
                    ) : (
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t("ליד לא זמין")}</div>
                    )}
                    <div style={{ fontSize: 13, color: colors.text, marginTop: 3 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 5, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span>{nameOf(n.author_id)} · {fmtDate(n.created_at)}</span>
                      <span style={{ color: "#0ea5a5", fontWeight: 700 }}>
                        ✓ {t('טופל ע"י')} {nameOf(n.resolved_by)} · {fmtDate(n.resolved_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
