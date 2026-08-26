import React from "react";
import { Flag, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { colors, buttonPrimary } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useLanguage } from "../lib/LanguageContext";

// Pops up for every manager/deputy the moment they log in (and immediately if the app is already
// open when a note gets flagged) — stays up, reappearing on every login, until each flagged note
// is actually marked handled. Closing with the X only hides it for this session; it's driven by
// live unresolved data, so it comes back next login (or the moment a new one is flagged) until
// resolved for real.
export default function ManagerNotesModal({ notes, leads, profiles, profile, openLead, onClose }) {
  const { t } = useLanguage();

  function leadFor(leadId) { return leads.find((l) => l.id === leadId) || null; }
  function authorName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  async function resolve(note) {
    await supabase.from("lead_notes").update({
      resolved: true, resolved_by: profile.id, resolved_at: new Date().toISOString(),
    }).eq("id", note.id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 460, maxWidth: "92%", background: "#fff", borderRadius: 14, padding: 20, borderTop: "5px solid #dc2626" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flag size={20} color="#dc2626" fill="#dc2626" />
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {notes.length === 1 ? t("הערה אחת ממתינה לטיפולך") : `${notes.length} ${t("הערות ממתינות לטיפולך")}`}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "grid", gap: 10, maxHeight: 380, overflowY: "auto" }}>
          {notes.map((n) => {
            const lead = leadFor(n.lead_id);
            return (
              <div key={n.id} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>
                {lead && (
                  <button
                    onClick={() => { openLead(lead.id); onClose(); }}
                    style={{ border: "none", background: "none", cursor: "pointer", color: colors.text, fontWeight: 700, fontSize: 14, padding: 0, textAlign: "start" }}
                  >
                    {lead.name} {lead.business_name ? `· ${lead.business_name}` : ""}
                  </button>
                )}
                <div style={{ fontSize: 13, marginTop: 4 }}>{n.text}</div>
                <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 5 }}>
                  {authorName(n.author_id)} · {fmtDate(n.created_at)}
                </div>
                <button
                  onClick={() => resolve(n)}
                  style={{ marginTop: 8, border: "none", background: "#0ea5a5", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  ✓ {t("טופל")}
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ ...buttonPrimary, width: "100%", marginTop: 16 }}>{t("סגור לעכשיו")}</button>
      </div>
    </div>
  );
}
