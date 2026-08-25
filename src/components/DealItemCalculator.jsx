import React, { useState, useMemo } from "react";
import { inputStyle, buttonPrimary, buttonGhost, colors } from "../lib/theme";
import { computeQuote } from "../lib/pricing";
import { money } from "../lib/format";

const MODES = [
  { key: "catalog", label: "מוצר מהקטלוג" },
  { key: "customSize", label: "מוצר מהקטלוג, מידה מותאמת" },
  { key: "generic", label: "פריט כללי (לא מהקטלוג)" },
];

// Lets a rep build the multi-line item list for closing a deal. Each confirmed line is appended
// to `items` and handed to actions.closeLeadWithItems on submit.
export default function DealItemCalculator({ catalog, items, setItems, onSubmit, submitLabel, t = (s) => s }) {
  const [mode, setMode] = useState("catalog");
  const [productName, setProductName] = useState("");
  const [subProduct, setSubProduct] = useState("");
  const [qty, setQty] = useState(1000);
  const [finishId, setFinishId] = useState("");
  const [includeProductAddon, setIncludeProductAddon] = useState(false);
  const [selectedGlobalAddonIds, setSelectedGlobalAddonIds] = useState([]);
  const [includeShipping, setIncludeShipping] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [note, setNote] = useState("");
  const [givenAmount, setGivenAmount] = useState("");
  const [addError, setAddError] = useState("");

  const productNames = useMemo(() => Array.from(new Set(catalog.products.map((p) => p.name))), [catalog.products]);
  const subOptions = useMemo(() => catalog.products.filter((p) => p.name === productName), [catalog.products, productName]);
  const product = useMemo(() => subOptions.find((p) => p.sub_product === subProduct) || null, [subOptions, subProduct]);
  const finish = useMemo(() => catalog.finishes.find((f) => f.id === finishId) || null, [catalog.finishes, finishId]);
  const selectedGlobalAddons = useMemo(() => catalog.globalAddons.filter((a) => selectedGlobalAddonIds.includes(a.id)), [catalog.globalAddons, selectedGlobalAddonIds]);
  const shippingOption = catalog.shippingOptions[0] || null;

  const quote = useMemo(() => {
    if (mode !== "catalog" || !product || !qty) return null;
    return computeQuote({ product, qty: Number(qty), finish, includeProductAddon, selectedGlobalAddons, shippingOption, includeShipping });
  }, [mode, product, qty, finish, includeProductAddon, selectedGlobalAddons, shippingOption, includeShipping]);

  function toggleGlobalAddon(id) {
    setSelectedGlobalAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function resetForm() {
    setProductName(""); setSubProduct(""); setQty(1000); setFinishId(""); setIncludeProductAddon(false);
    setSelectedGlobalAddonIds([]); setIncludeShipping(false); setManualPrice(""); setCustomLabel(""); setNote(""); setGivenAmount("");
  }

  function addLine() {
    setAddError("");
    let productLabel, amount;
    if (mode === "catalog") {
      if (!product || !quote) return;
      productLabel = `${product.name} ${product.sub_product}`;
      amount = quote.total;
    } else if (mode === "customSize") {
      if (!productName || !customLabel.trim() || !manualPrice) return;
      productLabel = `${productName} ${customLabel.trim()} (${t("מותאם אישית")})`;
      amount = Number(manualPrice) || 0;
    } else {
      if (!customLabel.trim() || !manualPrice || !note.trim()) return;
      // order_lines has no separate notes column, so the required explanation is folded into
      // the product label itself rather than silently dropped.
      productLabel = `${customLabel.trim()} — ${note.trim()}`;
      amount = Number(manualPrice) || 0;
    }
    if (!amount || amount <= 0) {
      setAddError(t("המחיר חייב להיות גדול מ-0 — בדקי שהמוצר/כמות שנבחרו קיימים בקטלוג עם מחיר תקין"));
      return;
    }
    setItems((cur) => [...cur, {
      product: productLabel, qty: Number(qty) || 0, amount,
      givenAmount: givenAmount !== "" ? Number(givenAmount) : null,
    }]);
    resetForm();
  }

  function removeLine(idx) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {MODES.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} style={mode === m.key ? buttonPrimary : buttonGhost}>{t(m.label)}</button>
        ))}
      </div>

      {mode === "catalog" && (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <select style={inputStyle} value={productName} onChange={(e) => { setProductName(e.target.value); setSubProduct(""); }}>
            <option value="">{t("בחר מוצר…")}</option>
            {productNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select style={inputStyle} value={subProduct} onChange={(e) => setSubProduct(e.target.value)} disabled={!productName}>
            <option value="">{t("בחר גודל/סוג…")}</option>
            {subOptions.map((p) => <option key={p.id} value={p.sub_product}>{p.sub_product}</option>)}
          </select>
          <input type="number" style={inputStyle} placeholder={t("כמות")} value={qty} onChange={(e) => setQty(e.target.value)} />
          <select style={inputStyle} value={finishId} onChange={(e) => setFinishId(e.target.value)}>
            <option value="">{t("רמת שירות (ברירת מחדל: סטנדרט)")}</option>
            {catalog.finishes.map((f) => <option key={f.id} value={f.id}>{f.name} (x{f.mult})</option>)}
          </select>
          {product?.addon && (
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={includeProductAddon} onChange={(e) => setIncludeProductAddon(e.target.checked)} />
              {" "}{product.addon.name}
            </label>
          )}
          {catalog.globalAddons.map((a) => (
            <label key={a.id} style={{ fontSize: 13 }}>
              <input type="checkbox" checked={selectedGlobalAddonIds.includes(a.id)} onChange={() => toggleGlobalAddon(a.id)} />
              {" "}{a.name} ({money(a.price)})
            </label>
          ))}
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={includeShipping} onChange={(e) => setIncludeShipping(e.target.checked)} /> {t("כולל פריסה והטמעה")}
          </label>
          {quote && <div style={{ fontSize: 14, fontWeight: 700 }}>{t('סה"כ מחושב')}: {money(quote.total)}</div>}
        </div>
      )}

      {mode === "customSize" && (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <select style={inputStyle} value={productName} onChange={(e) => setProductName(e.target.value)}>
            <option value="">{t("בחר מוצר…")}</option>
            {productNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input style={inputStyle} placeholder={t("מידה מותאמת אישית")} value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
          <input type="number" style={inputStyle} placeholder={t("כמות")} value={qty} onChange={(e) => setQty(e.target.value)} />
          <input type="number" style={inputStyle} placeholder={t("מחיר סופי (₪)")} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
        </div>
      )}

      {mode === "generic" && (
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <input style={inputStyle} placeholder={t("שם הפריט")} value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
          <input type="number" style={inputStyle} placeholder={t("כמות")} value={qty} onChange={(e) => setQty(e.target.value)} />
          <input type="number" style={inputStyle} placeholder={t("מחיר (₪)")} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
          <input style={inputStyle} placeholder={t("הערה (חובה — מה זה הפריט)")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      <input type="number" style={{ ...inputStyle, marginBottom: 8 }} placeholder={t("מחיר שניתן ללקוח בפועל (אם שונה)")} value={givenAmount} onChange={(e) => setGivenAmount(e.target.value)} />
      {addError && <div style={{ color: colors.danger, fontSize: 12, marginBottom: 6 }}>{addError}</div>}
      <button onClick={addLine} style={{ ...buttonGhost, marginBottom: 14 }}>{t("הוסף שורה")}</button>

      {items.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {items.map((it, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13.5 }}>
              <div>{it.product} · {it.qty} {t("יח'")} {it.givenAmount != null && it.givenAmount !== it.amount ? `(${t("ניתן")}: ${money(it.givenAmount)})` : ""}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{money(it.amount)}</span>
                <button onClick={() => removeLine(idx)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("הסר")}</button>
              </div>
            </div>
          ))}
          <div style={{ textAlign: "left", fontWeight: 800, marginTop: 8 }}>
            {t('סה"כ')}: {money(items.reduce((s, i) => s + i.amount, 0))}
          </div>
        </div>
      )}

      <button onClick={onSubmit} disabled={items.length === 0} style={buttonPrimary}>{submitLabel}</button>
    </div>
  );
}
