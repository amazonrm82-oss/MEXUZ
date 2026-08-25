import React, { useMemo, useState } from "react";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { useOrderLines } from "../lib/useOrderLines";
import { money, fmtDate } from "../lib/format";
import { downloadCsv } from "../lib/exportCsv";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

export default function CustomersView({ leads, openLead, showToast, t }) {
  const { rows: manualCustomers } = useRealtimeList("manual_customers", { orderBy: "created_at", ascending: false });
  const { revenueFor } = useOrderLines();
  const closedLeads = useMemo(() => leads.filter((l) => l.closed_at), [leads]);

  // Group closed deals by phone (fallback to the lead id when there's no phone) so a repeat
  // customer shows as one card with their full history, instead of one row per deal.
  const customers = useMemo(() => {
    const map = new Map();
    [...closedLeads].sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at)).forEach((l) => {
      const key = l.phone || l.id;
      if (!map.has(key)) map.set(key, { key, deals: [] });
      map.get(key).deals.push(l);
    });
    return Array.from(map.values()).map((c) => {
      const latest = c.deals[c.deals.length - 1];
      const total = c.deals.reduce((s, l) => s + revenueFor(l.id), 0);
      return { ...c, name: latest.name, businessName: latest.business_name, phone: latest.phone, total };
    }).sort((a, b) => b.total - a.total);
  }, [closedLeads, revenueFor]);

  const [form, setForm] = useState({ name: "", phone: "", businessName: "", lastDeal: "" });

  function exportCustomers() {
    const rows = [
      ...customers.map((c) => ({ שם: c.name, "שם עסק": c.businessName || "", טלפון: c.phone || "", עסקאות: c.deals.length, 'סה"כ': c.total })),
      ...manualCustomers.map((c) => ({ שם: c.name, "שם עסק": c.business_name || "", טלפון: c.phone || "", עסקאות: "—", 'סה"כ': c.last_deal || "" })),
    ];
    downloadCsv(`לקוחות_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  async function addCustomer(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast(t("יש להזין שם")); return; }
    const { error } = await supabase.from("manual_customers").insert({
      name: form.name.trim(), phone: form.phone.trim(), business_name: form.businessName.trim(), last_deal: form.lastDeal.trim(),
    });
    if (error) { showToast(t("שגיאה בהוספת לקוח")); return; }
    showToast(t("הלקוח נוסף"));
    setForm({ name: "", phone: "", businessName: "", lastDeal: "" });
  }

  return (
    <div>
      <PageHeader
        icon={Users} title={t("לקוחות")} subtitle={`${customers.length + manualCustomers.length} ${t("לקוחות")}`}
        actions={[<button key="export" onClick={exportCustomers} style={buttonGhost}>{t("ייצוא לאקסל")}</button>]}
      />

      <form onSubmit={addCustomer} style={{ ...panelStyle, marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, width: 150 }} placeholder={t("שם")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={{ ...inputStyle, width: 130 }} placeholder={t("טלפון")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input style={{ ...inputStyle, width: 150 }} placeholder={t("שם עסק")} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        <input style={{ ...inputStyle, width: 150 }} placeholder={t("עסקה אחרונה")} value={form.lastDeal} onChange={(e) => setForm({ ...form, lastDeal: e.target.value })} />
        <button type="submit" style={buttonPrimary}>{t("הוסף לקוח")}</button>
      </form>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.mutedText }}>{t("לקוחות מעסקאות שנסגרו")}</div>
      {customers.length === 0 ? (
        <EmptyState icon={Users} text={t("אין עדיין לקוחות מעסקאות שנסגרו")} />
      ) : (
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {customers.map((c) => (
            <CustomerCard key={c.key} customer={c} openLead={openLead} revenueFor={revenueFor} t={t} />
          ))}
        </div>
      )}

      {manualCustomers.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.mutedText }}>{t("לקוחות שנוספו ידנית")}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {manualCustomers.map((c) => (
              <div key={c.id} style={panelStyle}>
                <div style={{ fontWeight: 700 }}>{c.name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 13 }}>· {c.business_name}</span></div>
                <div style={{ fontSize: 12.5, color: colors.mutedText }}>{c.phone} {c.last_deal ? `· ${c.last_deal}` : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerCard({ customer, openLead, revenueFor, t }) {
  const [open, setOpen] = useState(false);
  const { name, businessName, phone, deals, total } = customer;

  return (
    <div style={panelStyle}>
      <div
        className="clickable-card"
        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {open ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>
              {name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 13 }}>· {businessName}</span>
            </div>
            <div style={{ fontSize: 12.5, color: colors.mutedText }}>
              {phone} · {deals.length > 1 ? `${deals.length} ${t("עסקאות")}` : t("עסקה אחת")}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 800, flexShrink: 0 }}>{money(total)}</div>
      </div>

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}`, display: "grid", gap: 6 }}>
          {[...deals].reverse().map((l) => (
            <div
              key={l.id}
              className="clickable-card"
              style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, cursor: "pointer", padding: "4px 2px", borderRadius: 6 }}
              onClick={() => openLead(l.id)}
            >
              <span style={{ color: colors.mutedText }}>{fmtDate(l.closed_at)} · {l.product || "—"}</span>
              <span style={{ fontWeight: 700 }}>{money(revenueFor(l.id))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
