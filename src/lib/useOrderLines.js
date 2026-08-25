import { useMemo } from "react";
import { useRealtimeList } from "./useTable";

// All order lines visible to the current user (RLS mirrors lead visibility). Small business,
// small table — fetching the whole thing is simpler than per-lead queries in every view that
// needs revenue totals (Dashboard, My Deals, History, Payment Dues).
export function useOrderLines() {
  const { rows } = useRealtimeList("order_lines", { orderBy: "created_at", ascending: true });
  const byLead = useMemo(() => {
    const map = new Map();
    for (const o of rows) {
      if (!map.has(o.lead_id)) map.set(o.lead_id, []);
      map.get(o.lead_id).push(o);
    }
    return map;
  }, [rows]);
  function linesFor(leadId) { return byLead.get(leadId) || []; }
  function revenueFor(leadId) { return linesFor(leadId).reduce((s, o) => s + Number(o.amount || 0), 0); }
  return { rows, linesFor, revenueFor };
}
