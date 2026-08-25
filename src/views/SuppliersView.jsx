import React, { useState } from "react";
import { Truck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { money } from "../lib/format";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function SuppliersView({ leads, showToast, t }) {
  const { rows: supplierNames } = useRealtimeList("suppliers_master", { orderBy: "name", ascending: true });
  const { rows: charges } = useRealtimeList("supplier_charges", { orderBy: "created_at", ascending: false });
  const [newSupplierName, setNewSupplierName] = useState("");
  const [form, setForm] = useState({ supplierId: "", amount: "", dueDate: "", leadId: "" });

  async function addSupplierName() {
    const name = newSupplierName.trim();
    if (!name) return;
    const { error } = await supabase.from("suppliers_master").insert({ name });
    if (error) { showToast(error.code === "23505" ? t("הספק כבר קיים") : t("שגיאה בהוספת ספק")); return; }
    setNewSupplierName("");
    showToast(t("הספק נוסף לרשימה"));
  }
  async function removeSupplierName(id) {
    await supabase.from("suppliers_master").delete().eq("id", id);
  }

  async function addCharge(e) {
    e.preventDefault();
    if (!form.supplierId || !form.amount) { showToast(t("יש לבחור ספק ולהזין סכום")); return; }
    const { error } = await supabase.from("supplier_charges").insert({
      supplier_id: form.supplierId, amount: Number(form.amount), due_date: form.dueDate || null, lead_id: form.leadId || null,
    });
    if (error) { showToast(t("שגיאה בהוספת חיוב")); return; }
    setForm({ supplierId: "", amount: "", dueDate: "", leadId: "" });
    showToast(t("החיוב נוסף"));
  }
  async function togglePaid(c) { await supabase.from("supplier_charges").update({ paid: !c.paid }).eq("id", c.id); }
  async function deleteCharge(id) { await supabase.from("supplier_charges").delete().eq("id", id); }

  function supplierName(id) { return supplierNames.find((s) => s.id === id)?.name || "—"; }
  function leadLabel(id) { const l = leads.find((x) => x.id === id); return l ? `${l.name} · ${l.business_name}` : "—"; }

  const unpaidCharges = charges.filter((c) => !c.paid);

  return (
    <div>
      <PageHeader icon={Truck} title={t("ספקים")} subtitle={`${unpaidCharges.length} ${t("חיובים פתוחים")}`} />

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13.5 }}>{t("רשימת ספקים")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {supplierNames.map((s) => (
            <span key={s.id} style={{ background: colors.bg, borderRadius: 20, padding: "4px 10px", fontSize: 12.5 }}>
              {s.name} <button onClick={() => removeSupplierName(s.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={inputStyle} placeholder={t("שם ספק חדש")} value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
          <button onClick={addSupplierName} style={buttonGhost}>{t("הוסף")}</button>
        </div>
      </div>

      <form onSubmit={addCharge} style={{ ...panelStyle, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select style={{ ...inputStyle, width: 140 }} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
          <option value="">{t("בחר ספק…")}</option>
          {supplierNames.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" style={{ ...inputStyle, width: 120 }} placeholder={t("סכום")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input type="date" style={{ ...inputStyle, width: 150 }} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <select style={{ ...inputStyle, width: 180 }} value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
          <option value="">{t("קישור לליד (אופציונלי)")}</option>
          {leads.filter((l) => l.closed_at).map((l) => <option key={l.id} value={l.id}>{l.name} · {l.business_name}</option>)}
        </select>
        <button type="submit" style={buttonPrimary}>{t("הוסף חיוב")}</button>
      </form>

      {unpaidCharges.length === 0 ? (
        <EmptyState icon={Truck} text={t("אין חיובי ספקים פתוחים")} />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {unpaidCharges.map((c) => {
            const linkedLead = leads.find((l) => l.id === c.lead_id);
            const dealAlreadyDone = !!linkedLead?.archived;
            return (
              <div
                key={c.id} className="clickable-card"
                style={{
                  ...panelStyle, display: "flex", justifyContent: "space-between", alignItems: "center",
                  border: dealAlreadyDone ? `1.5px solid ${colors.danger}` : "none",
                  background: dealAlreadyDone ? "#fbe9e7" : panelStyle.background,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{supplierName(c.supplier_id)} · {money(c.amount)}</div>
                  <div style={{ fontSize: 12, color: colors.mutedText }}>
                    {c.due_date || "—"} {c.lead_id ? `· ${leadLabel(c.lead_id)}` : ""}
                    {dealAlreadyDone && <span style={{ color: colors.danger, fontWeight: 700 }}> · {t("העסקה כבר בהיסטוריה, טרם שולם")}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => togglePaid(c)} style={buttonPrimary}>{t("סמן כשולם")}</button>
                  <button onClick={() => deleteCharge(c.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 14 }}>
        {t('חיובים ששולמו לא מוצגים כאן יותר — הם נשארים מוצמדים לעסקה עצמה (בכרטיס הליד, תחת "פרטי עסקה").')}
      </div>
    </div>
  );
}
