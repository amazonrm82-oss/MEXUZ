import React, { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import { inputStyle, buttonPrimary, buttonGhost, panelStyle, colors } from "../lib/theme";
import { computeQuote } from "../lib/pricing";
import { money } from "../lib/format";
import { useLanguage } from "../lib/LanguageContext";
import PageHeader from "../components/PageHeader";

export default function CalcView({ catalog, profile }) {
  const { t, lang } = useLanguage();
  const productNames = useMemo(() => Array.from(new Set(catalog.products.map((p) => p.name))), [catalog.products]);
  const [productName, setProductName] = useState("");
  const [subProduct, setSubProduct] = useState("");
  const [qty, setQty] = useState(1000);
  const [finishId, setFinishId] = useState("");
  const [includeProductAddon, setIncludeProductAddon] = useState(false);
  const [selectedGlobalAddonIds, setSelectedGlobalAddonIds] = useState([]);
  const [includeShipping, setIncludeShipping] = useState(false);

  const subOptions = useMemo(() => catalog.products.filter((p) => p.name === productName), [catalog.products, productName]);
  const product = useMemo(() => subOptions.find((p) => p.sub_product === subProduct) || null, [subOptions, subProduct]);
  const finish = useMemo(() => catalog.finishes.find((f) => f.id === finishId) || null, [catalog.finishes, finishId]);
  const selectedGlobalAddons = useMemo(() => catalog.globalAddons.filter((a) => selectedGlobalAddonIds.includes(a.id)), [catalog.globalAddons, selectedGlobalAddonIds]);
  const shippingOption = catalog.shippingOptions[0] || null;

  const quote = useMemo(() => {
    if (!product || !qty) return null;
    return computeQuote({ product, qty: Number(qty), finish, includeProductAddon, selectedGlobalAddons, shippingOption, includeShipping });
  }, [product, qty, finish, includeProductAddon, selectedGlobalAddons, shippingOption, includeShipping]);

  function toggleGlobalAddon(id) {
    setSelectedGlobalAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function sendQuote() {
    const text = product && quote
      ? `${t("הצעת מחיר")}: ${product.name} ${product.sub_product}, ${t("כמות")} ${qty}, ${t('סה"כ')} ${money(quote.total)}`
      : t("הצעת מחיר");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function printQuote() {
    window.print();
  }

  async function downloadPdf() {
    if (!product || !quote) return;
    const { downloadQuotePdf } = await import("../lib/pdfQuote");
    const rows = [
      [t("מוצר"), `${product.name} · ${product.sub_product}`],
      [t("כמות"), `${qty} ${t("יח'")}`],
    ];
    if (finish) rows.push([t("רמת שירות"), finish.name]);
    rows.push([t("מחיר יחידה"), money(quote.unit)]);
    rows.push([t('סה"כ בסיס'), money(quote.base)]);
    if (quote.productAddonCost > 0) rows.push([t("תוספת למערכת"), money(quote.productAddonCost)]);
    if (quote.globalAddonsCost > 0) rows.push([t("תוספות"), money(quote.globalAddonsCost)]);
    if (quote.shippingCost > 0) rows.push([t("פריסה והטמעה"), money(quote.shippingCost)]);
    rows.push([t('סה"כ'), money(quote.total), true]);
    downloadQuotePdf({
      filename: `${lang === "en" ? "quote" : "הצעת_מחיר"}_${product.name}_${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "MEXUZ",
      subtitle: `${t("הצעת מחיר")} · ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}`,
      rows,
      footer: profile?.name ? `${t('הוכן ע"י')} ${profile.name}` : null,
    });
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-print-area, #quote-print-area * { visibility: visible; }
          #quote-print-area { display: block !important; position: absolute; top: 0; right: 0; left: 0; padding: 24px; }
        }
      `}</style>
      <PageHeader icon={Calculator} title={t("מחשבון מחיר")} />
      <div style={{ ...panelStyle, maxWidth: 460, display: "grid", gap: 10 }}>
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
            {" "}{product.addon.name} ({product.addon.per_unit ? `${product.addon.price}₪/${t("יח'")}` : `${product.addon.price}₪`})
          </label>
        )}
        <div>
          <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 4 }}>{t("תוספות")}</div>
          {catalog.globalAddons.map((a) => (
            <label key={a.id} style={{ display: "block", fontSize: 13, marginBottom: 3 }}>
              <input type="checkbox" checked={selectedGlobalAddonIds.includes(a.id)} onChange={() => toggleGlobalAddon(a.id)} />
              {" "}{a.name} ({money(a.price)})
            </label>
          ))}
        </div>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={includeShipping} onChange={(e) => setIncludeShipping(e.target.checked)} /> {t("כולל פריסה והטמעה")}
        </label>

        {quote && (
          <div style={{ background: colors.bg, borderRadius: 8, padding: 12, fontSize: 13.5 }}>
            <div>{t("מחיר יחידה")}: {money(quote.unit)}</div>
            <div>{t('סה"כ בסיס')}: {money(quote.base)}</div>
            {quote.productAddonCost > 0 && <div>{t("תוספת למערכת")}: {money(quote.productAddonCost)}</div>}
            {quote.globalAddonsCost > 0 && <div>{t("תוספות")}: {money(quote.globalAddonsCost)}</div>}
            {quote.shippingCost > 0 && <div>{t("פריסה והטמעה")}: {money(quote.shippingCost)}</div>}
            <div style={{ fontWeight: 800, marginTop: 6, fontSize: 16 }}>{t('סה"כ')}: {money(quote.total)}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={sendQuote} style={buttonPrimary}>{t("שליחת הצעה בוואטסאפ")}</button>
          {quote && <button onClick={downloadPdf} style={buttonGhost}>{t("שמירה כ-PDF")}</button>}
          {quote && <button onClick={printQuote} style={buttonGhost}>{t("הדפסה")}</button>}
        </div>
      </div>

      {quote && product && (
        <div id="quote-print-area" style={{ display: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>MEXUZ</div>
          <div style={{ fontSize: 13, color: colors.mutedText, marginBottom: 20 }}>{t("הצעת מחיר")} · {new Date().toLocaleDateString(lang === "en" ? "en-US" : "he-IL")}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              <tr><td style={{ padding: "6px 0" }}>{t("מוצר")}</td><td style={{ padding: "6px 0", fontWeight: 700 }}>{product.name} · {product.sub_product}</td></tr>
              <tr><td style={{ padding: "6px 0" }}>{t("כמות")}</td><td style={{ padding: "6px 0", fontWeight: 700 }}>{qty} {t("יח'")}</td></tr>
              {finish && <tr><td style={{ padding: "6px 0" }}>{t("רמת שירות")}</td><td style={{ padding: "6px 0" }}>{finish.name}</td></tr>}
              <tr><td style={{ padding: "6px 0" }}>{t("מחיר יחידה")}</td><td style={{ padding: "6px 0" }}>{money(quote.unit)}</td></tr>
              <tr><td style={{ padding: "6px 0" }}>{t('סה"כ בסיס')}</td><td style={{ padding: "6px 0" }}>{money(quote.base)}</td></tr>
              {quote.productAddonCost > 0 && <tr><td style={{ padding: "6px 0" }}>{t("תוספת למערכת")}</td><td style={{ padding: "6px 0" }}>{money(quote.productAddonCost)}</td></tr>}
              {quote.globalAddonsCost > 0 && <tr><td style={{ padding: "6px 0" }}>{t("תוספות")}</td><td style={{ padding: "6px 0" }}>{money(quote.globalAddonsCost)}</td></tr>}
              {quote.shippingCost > 0 && <tr><td style={{ padding: "6px 0" }}>{t("פריסה והטמעה")}</td><td style={{ padding: "6px 0" }}>{money(quote.shippingCost)}</td></tr>}
              <tr><td style={{ padding: "10px 0", fontWeight: 800, fontSize: 18, borderTop: `2px solid ${colors.text}` }}>{t('סה"כ')}</td><td style={{ padding: "10px 0", fontWeight: 800, fontSize: 18, borderTop: `2px solid ${colors.text}` }}>{money(quote.total)}</td></tr>
            </tbody>
          </table>
          {profile?.name && <div style={{ fontSize: 12, color: colors.mutedText, marginTop: 30 }}>{t('הוכן ע"י')} {profile.name}</div>}
        </div>
      )}
    </div>
  );
}
