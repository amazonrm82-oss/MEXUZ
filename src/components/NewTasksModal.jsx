import React from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { colors, buttonPrimary } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { useLanguage } from "../lib/LanguageContext";

// Pops up right after login (or whenever a new manager-assigned task lands while the app is
// open) so the assignee can't miss it, per the "new task jumps at them" requirement.
export default function NewTasksModal({ tasks, profiles, onClose }) {
  const { t } = useLanguage();
  function repName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  async function dismiss() {
    const ids = tasks.map((task) => task.id);
    await supabase.from("tasks").update({ seen: true }).in("id", ids);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 420, maxWidth: "92%", background: "#fff", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <ClipboardList size={20} color={colors.accent} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {tasks.length === 1 ? t("משימה חדשה הוקצתה לך") : `${tasks.length} ${t("משימות חדשות הוקצו לך")}`}
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, maxHeight: 320, overflowY: "auto" }}>
          {tasks.map((task) => (
            <div key={task.id} style={{ background: colors.bg, borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
              {task.notes && <div style={{ fontSize: 12.5, color: colors.mutedText, marginTop: 3 }}>{task.notes}</div>}
              <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 5 }}>
                {t("יעד")}: {fmtDate(task.due_at)} · {t('הוקצה ע"י')} {repName(task.created_by)}
              </div>
            </div>
          ))}
        </div>
        <button onClick={dismiss} style={{ ...buttonPrimary, width: "100%", marginTop: 16 }}>{t("הבנתי")}</button>
      </div>
    </div>
  );
}
