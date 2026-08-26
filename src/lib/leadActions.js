import { useCallback } from "react";
import { supabase } from "./supabaseClient";
import { OPS_STATUS_OPTIONS } from "./constants";

// All the lead-lifecycle mutations, centralized so every view (Inbox, Drawer, Ops, Payment
// Dues, Notifications, Canceled...) shares the same behavior. Real permission enforcement is
// the RLS policies + trigger in supabase/migrations/0001_init.sql — these functions just call
// Postgres and surface whatever it decides via a toast.
export function useLeadActions(showToast, profile) {
  const claimLead = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("leads")
      .update({ claimed_by: profile.id, claimed_at: new Date().toISOString() })
      .eq("id", id)
      .is("claimed_by", null)
      .select();
    if (error) { showToast("שגיאה בשיוך הליד"); return; }
    if (!data || !data.length) { showToast("מישהו הקדים אותך — הליד כבר שויך"); return; }
    showToast("הליד שויך אליך");
  }, [profile, showToast]);

  const reassignLead = useCallback(async (id, repId, repName) => {
    const { error } = await supabase.from("leads").update({ claimed_by: repId, claimed_at: new Date().toISOString() }).eq("id", id);
    if (error) { showToast("אין הרשאה להעביר ליד זה"); return; }
    showToast(`הליד הועבר ל${repName}`);
  }, [showToast]);

  const updateLead = useCallback(async (id, patch) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) showToast("שגיאה בעדכון: " + error.message);
    return { error };
  }, [showToast]);

  const addNote = useCallback(async (leadId, text, followUp, flaggedForManager) => {
    if (!text.trim()) return;
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: leadId, author_id: profile.id, text: text.trim(), follow_up: followUp || null,
      flagged_for_manager: !!flaggedForManager,
    });
    if (error) showToast("שגיאה בהוספת הערה");
  }, [profile, showToast]);

  const addMessage = useCallback(async (leadId, text) => {
    if (!text.trim()) return;
    const { error } = await supabase.from("lead_messages").insert({ lead_id: leadId, sender: "rep", text: text.trim() });
    if (error) showToast("שגיאה בהוספת הודעה");
  }, [showToast]);

  const closeLeadWithItems = useCallback(async (lead, repId, repName, items) => {
    if (!items || !items.length) { showToast("יש להוסיף לפחות פריט אחד עם מחיר לפני סגירת העסקה"); return; }
    const lines = items;
    const { error: insertErr } = await supabase.from("order_lines").insert(
      lines.map((it) => ({
        lead_id: lead.id, product: it.product, qty: Number(it.qty) || 0,
        amount: Number(it.amount) || 0, given_amount: it.givenAmount != null ? Number(it.givenAmount) : null,
      }))
    );
    if (insertErr) { showToast("שגיאה בשמירת שורות ההזמנה"); return; }
    const { error } = await supabase.from("leads").update({
      lead_status: `לקוח נסגר ע"י ${repName}`, claimed_by: repId, closed_at: lead.closed_at || new Date().toISOString(),
      ops_status: null, pending_approval: true,
    }).eq("id", lead.id);
    if (error) { showToast("שגיאה בסגירת העסקה"); return; }
    showToast("העסקה נשלחה לאישור ההנהלה");
  }, [showToast]);

  const approveDeal = useCallback(async (leadId, useGivenPrice, orderLines) => {
    if (useGivenPrice) {
      const toUpdate = (orderLines || []).filter((o) => o.given_amount != null);
      for (const line of toUpdate) {
        await supabase.from("order_lines").update({ amount: line.given_amount }).eq("id", line.id);
      }
    }
    const { error } = await supabase.from("leads").update({
      pending_approval: false, approved_at: new Date().toISOString(), ops_status: "באפיון",
    }).eq("id", leadId);
    if (error) { showToast("אין הרשאה לאשר עסקה"); return; }
    showToast(useGivenPrice ? "העסקה אושרה לפי המחיר שניתן ללקוח" : "העסקה אושרה לפי מחיר המערכת");
  }, [showToast]);

  const addOrderLine = useCallback(async (leadId, product, qty, amount) => {
    const { error } = await supabase.from("order_lines").insert({ lead_id: leadId, product, qty: Number(qty) || 0, amount: Number(amount) || 0 });
    if (error) { showToast("אין הרשאה להוסיף שורת הזמנה"); return; }
    showToast("שורת ההזמנה נוספה");
  }, [showToast]);

  const removeOrderLine = useCallback(async (lineId) => {
    const { error } = await supabase.from("order_lines").delete().eq("id", lineId);
    if (error) showToast("אין הרשאה למחוק שורת הזמנה");
  }, [showToast]);

  const advanceOps = useCallback(async (lead) => {
    const idx = OPS_STATUS_OPTIONS.indexOf(lead.ops_status);
    if (idx < 0 || idx >= OPS_STATUS_OPTIONS.length - 1) return;
    const next = OPS_STATUS_OPTIONS[idx + 1];
    const patch = { ops_status: next };
    if (next === "נמסר ללקוח") patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) { showToast(error.message.includes("נמסר ללקוח") ? error.message : "שגיאה בעדכון סטטוס"); return; }
    showToast(next === "נמסר ללקוח" ? "הפרויקט נמסר ללקוח — יועבר אוטומטית להיסטוריה תוך 24 שעות" : "הסטטוס עודכן ל: " + next);
  }, [showToast]);

  const cancelLead = useCallback(async (id) => {
    const { error } = await supabase.from("leads").update({ canceled: true, canceled_at: new Date().toISOString() }).eq("id", id);
    if (error) { showToast("שגיאה בביטול הליד"); return; }
    showToast("הליד בוטל");
  }, [showToast]);

  const restoreLead = useCallback(async (id) => {
    const { error } = await supabase.from("leads").update({ canceled: false, canceled_at: null }).eq("id", id);
    if (error) { showToast("שגיאה בשחזור הליד"); return; }
    showToast("הליד שוחזר");
  }, [showToast]);

  const releaseLead = useCallback(async (id) => {
    const { error } = await supabase.from("leads").update({ claimed_by: null, claimed_at: null }).eq("id", id);
    if (error) { showToast("שגיאה בשחרור הליד"); return; }
    showToast("הליד שוחרר וחזר לתיבת הלידים הפתוחה");
  }, [showToast]);

  const markDealPaid = useCallback(async (id) => {
    const { error } = await supabase.from("leads").update({ archived: true, owes_payment: false }).eq("id", id);
    if (error) { showToast("שגיאה בעדכון תשלום"); return; }
    showToast("סומן כשולם — העסקה עברה להיסטוריה");
  }, [showToast]);

  const markDealUnpaid = useCallback(async (lead) => {
    const { error } = await supabase.from("leads").update({
      owes_payment: true, unpaid_since: lead.unpaid_since || new Date().toISOString(), paid_amount: lead.paid_amount || 0,
    }).eq("id", lead.id);
    if (error) { showToast("שגיאה בעדכון תשלום"); return; }
    showToast('העסקה הועברה ל"חייבים בתשלום"');
  }, [showToast]);

  const updateExpense = useCallback(async (id, value) => {
    await supabase.from("leads").update({ expense: Math.max(0, Number(value) || 0) }).eq("id", id);
  }, []);

  const addPayment = useCallback(async (lead, amountStr, revenue) => {
    const amount = Number(amountStr);
    if (!amount || amount <= 0) { showToast("יש להזין סכום תשלום"); return; }
    const newPaid = (lead.paid_amount || 0) + amount;
    if (newPaid >= revenue) {
      const { error } = await supabase.from("leads").update({ paid_amount: newPaid, owes_payment: false, archived: true }).eq("id", lead.id);
      if (error) { showToast("שגיאה ברישום תשלום"); return; }
      showToast("שולם במלואו — העסקה עברה להיסטוריה");
    } else {
      const { error } = await supabase.from("leads").update({ paid_amount: newPaid }).eq("id", lead.id);
      if (error) { showToast("שגיאה ברישום תשלום"); return; }
      showToast("התשלום נרשם");
    }
  }, [showToast]);

  return {
    claimLead, reassignLead, updateLead, addNote, addMessage, closeLeadWithItems, approveDeal,
    addOrderLine, removeOrderLine, advanceOps, cancelLead, restoreLead, releaseLead, markDealPaid, markDealUnpaid,
    updateExpense, addPayment,
  };
}
