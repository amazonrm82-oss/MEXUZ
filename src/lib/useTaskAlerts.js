import { useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";

const CHECK_INTERVAL_MS = 30 * 1000;

// Polls the already-loaded tasks list (kept live via Realtime) once a minute-ish to fire
// in-app toasts for due/near-due items. Only works while this tab is open — there's no
// push-notification backend here, so a closed browser/tab won't get pinged.
export function useTaskAlerts(tasks, profile, showToast) {
  const myOpenTasks = useMemo(
    () => (tasks || []).filter((t) => t.owner_id === profile.id && !t.completed),
    [tasks, profile.id]
  );
  const firedRef = useRef(new Set());

  useEffect(() => {
    function tick() {
      const now = Date.now();
      myOpenTasks.forEach((t) => {
        const dueMs = new Date(t.due_at).getTime();
        const preMs = t.remind_before_minutes ? dueMs - t.remind_before_minutes * 60 * 1000 : null;

        if (preMs != null && !t.pre_notified_at && now >= preMs && !firedRef.current.has(t.id + ":pre")) {
          firedRef.current.add(t.id + ":pre");
          showToast(`⏰ מתקרב: ${t.title}`);
          supabase.from("tasks").update({ pre_notified_at: new Date().toISOString() }).eq("id", t.id).then(() => {});
        }
        if (!t.notified_at && now >= dueMs && !firedRef.current.has(t.id + ":due")) {
          firedRef.current.add(t.id + ":due");
          showToast(`🔔 הגיע הזמן: ${t.title}`);
          supabase.from("tasks").update({ notified_at: new Date().toISOString() }).eq("id", t.id).then(() => {});
        }
      });
    }
    tick();
    const id = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [myOpenTasks, showToast]);

  const newAssignedTasks = useMemo(
    () => (tasks || []).filter((t) => t.kind === "task" && t.owner_id === profile.id && t.created_by !== profile.id && !t.seen),
    [tasks, profile.id]
  );

  return { newAssignedTasks };
}
