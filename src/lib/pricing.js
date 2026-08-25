import { priceFor } from "./format";

// Shared by the Quick Calculator and the deal-line calculator in the Lead Drawer.
export function computeQuote({ product, qty, finish, includeProductAddon, selectedGlobalAddons, shippingOption, includeShipping }) {
  const unit = priceFor(product, qty);
  if (unit == null) return null;
  const mult = finish ? finish.mult : 1;
  const base = unit * qty * mult;

  let productAddonCost = 0;
  if (includeProductAddon && product && product.addon) {
    productAddonCost = product.addon.per_unit ? product.addon.price * qty : product.addon.price;
  }

  const globalAddonsCost = (selectedGlobalAddons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);

  let shippingCost = 0;
  if (includeShipping && shippingOption) {
    const range = (shippingOption.ranges || []).find((r) => qty >= r.from_qty && qty <= r.to_qty);
    if (range) shippingCost = range.price;
  }

  const total = base + productAddonCost + globalAddonsCost + shippingCost;
  return {
    unit, base, productAddonCost, globalAddonsCost, shippingCost,
    total: Math.round(total * 100) / 100,
  };
}
