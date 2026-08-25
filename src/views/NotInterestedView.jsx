import React, { useMemo } from "react";
import { ThumbsDown } from "lucide-react";
import { colors, panelStyle, buttonGhost } from "../lib/theme";
import { fmtDate } from "../lib/format";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

// Leads a rep marked "לא מעוניין" land here instead of staying in the Inbox board.
export default function NotInterestedView({ leads, profiles, openLead, actions, t, tStatus }) {
  const list = useMemo(
    () => leads.filter((l) => l.process_status === "לא מעוניין" && !l.closed_at && !l.canceled && !l.archived),
    [leads]
  );

  function repName(id) {
    return profiles.find((p) => p.id === id)?.name || "—";
  }

  async function restore(id) {
    await actions.updateLead(id, { process_status: "ליד ראשוני" });
  }

  return (
    <div>
      <PageHeader icon={ThumbsDown} title={t("לא מעוניינים")} subtitle={`${list.length} ${t("לידים")}`} />

      {list.length === 0 ? (
        <EmptyState icon={ThumbsDown} text={t("אין לידים לא מעוניינים כרגע")} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {list.map((l) => (
            <div key={l.id} className="clickable-card" style={{ ...panelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ cursor: "pointer" }} onClick={() => openLead(l.id)}>
                <div style={{ fontWeight: 700 }}>{l.name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 13 }}>· {l.business_name}</span></div>
                <div style={{ fontSize: 13, color: colors.mutedText, marginTop: 2 }}>{l.product} · {l.quantity} {t("יח'")} · {tStatus(l.channel)}</div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
                  {l.claimed_by ? `${t("שויך ל")}${repName(l.claimed_by)}` : t("לא משויך")} · {t("התקבל")} {fmtDate(l.received_at)}
                </div>
              </div>
              <button onClick={() => restore(l.id)} style={buttonGhost}>{t("החזר לתיבת הלידים")}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
