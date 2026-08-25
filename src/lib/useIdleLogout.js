import { useEffect, useRef } from "react";

const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "wheel"];

// Logs the user out after 30 minutes with no mouse/keyboard/touch/scroll activity in this tab.
// Push notifications are unaffected — the service worker's subscription is independent of the
// app session, so reminders keep arriving even after this fires.
export function useIdleLogout(logout) {
  const timerRef = useRef(null);

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => logout(), IDLE_MS);
    }

    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [logout]);
}
