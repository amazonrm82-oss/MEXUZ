export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL") + " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function waPhoneFor(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

export function priceFor(product, qty) {
  if (!product || !product.tiers || !product.tiers.length) return null;
  const sorted = [...product.tiers].sort((a, b) => a.qty - b.qty);
  let chosen = sorted[0];
  for (const t of sorted) if (qty >= t.qty) chosen = t;
  return chosen.price;
}

export function money(n) {
  return "₪" + (Number(n) || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
