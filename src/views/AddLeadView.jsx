import React, { useState, useMemo } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CHANNELS, isUSCountryValue } from "../lib/constants";
import { COUNTRIES } from "../lib/countries";
import { inputStyle, buttonPrimary, panelStyle, colors } from "../lib/theme";
import PageHeader from "../components/PageHeader";

const EMPTY = { name: "", phone: "", email: "", businessName: "", contactRole: "", product: "", quantity: "", adName: "", channel: CHANNELS[0], address: "", city: "", country: "" };

export default function AddLeadView({ catalog, leads, showToast, setView, t, tStatus }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const productNames = useMemo(() => Array.from(new Set(catalog.products.map((p) => p.name))), [catalog.products]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const duplicate = useMemo(() => {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 7) return null;
    return (leads || []).find((l) => (l.phone || "").replace(/\D/g, "") === digits) || null;
  }, [form.phone, leads]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.businessName.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim() || !form.channel) {
      showToast(t("יש למלא את כל שדות החובה"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, business_name: form.businessName.trim(),
      contact_role: form.contactRole.trim(), product: form.product, quantity: Number(form.quantity) || 0,
      ad_name: form.adName.trim(), channel: form.channel, address: form.address.trim(), city: form.city.trim(),
      country: form.country.trim(), is_international: isUSCountryValue(form.country),
    });
    setSaving(false);
    if (error) { showToast(t("שגיאה בהוספת הליד")); return; }
    showToast(t("הליד נוסף בהצלחה"));
    setForm(EMPTY);
    setView("inbox");
  }

  return (
    <div>
      <PageHeader icon={UserPlus} title={t("הוספת ליד")} />
      <form onSubmit={handleSubmit} style={{ ...panelStyle, maxWidth: 480, display: "grid", gap: 10 }}>
        <Field label={t("שם *")}><input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label={t("טלפון *")}>
          <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          {duplicate && (
            <div style={{ fontSize: 11.5, color: colors.header, marginTop: 4 }}>
              ⚠️ {t("כבר קיים ליד עם הטלפון הזה")}: {duplicate.name}{duplicate.business_name ? ` · ${duplicate.business_name}` : ""} ({t("התקבל")} {new Date(duplicate.received_at).toLocaleDateString("he-IL")})
            </div>
          )}
        </Field>
        <Field label={t("אימייל")}><input type="email" style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label={t("שם עסק *")}><input style={inputStyle} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
        <Field label={t("תפקיד")}><input style={inputStyle} value={form.contactRole} onChange={(e) => set("contactRole", e.target.value)} /></Field>
        <Field label={t("מוצר")}>
          <input style={inputStyle} list="product-names" value={form.product} onChange={(e) => set("product", e.target.value)} />
          <datalist id="product-names">{productNames.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label={t("כמות")}><input type="number" style={inputStyle} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} /></Field>
        <Field label={t("שם מודעה")}><input style={inputStyle} value={form.adName} onChange={(e) => set("adName", e.target.value)} /></Field>
        <Field label={t("ערוץ *")}>
          <select style={inputStyle} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
            {CHANNELS.map((c) => <option key={c} value={c}>{tStatus(c)}</option>)}
          </select>
        </Field>
        <Field label={t("כתובת *")}><input style={inputStyle} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label={t("עיר *")}><input style={inputStyle} value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label={t("מדינה *")}>
          <select style={inputStyle} value={form.country} onChange={(e) => set("country", e.target.value)}>
            <option value="">{t("בחר מדינה…")}</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={saving} style={buttonPrimary}>{saving ? t("שומר…") : t("הוסף ליד")}</button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 3 }}>{label}</div>
      {children}
    </label>
  );
}
