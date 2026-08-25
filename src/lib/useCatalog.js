import { useMemo } from "react";
import { useRealtimeList } from "./useTable";

// Combines products + product_tiers + product_addons into the nested shape the calculator
// components expect: { id, name, sub_product, tiers: [{id,qty,price}], addon: {id,name,price,per_unit} | null }
export function useCatalog() {
  const products = useRealtimeList("products", { orderBy: "name", ascending: true });
  const tiers = useRealtimeList("product_tiers", { orderBy: "qty", ascending: true });
  const addons = useRealtimeList("product_addons", { orderBy: "name", ascending: true });
  const finishes = useRealtimeList("finishes", { orderBy: "mult", ascending: true });
  const globalAddons = useRealtimeList("global_addons", { orderBy: "name", ascending: true });
  const shippingOptions = useRealtimeList("shipping_options", { orderBy: "name", ascending: true });
  const shippingRanges = useRealtimeList("shipping_ranges", { orderBy: "from_qty", ascending: true });

  const combinedProducts = useMemo(() => {
    return products.rows.map((p) => ({
      ...p,
      tiers: tiers.rows.filter((t) => t.product_id === p.id),
      addon: addons.rows.find((a) => a.product_id === p.id) || null,
    }));
  }, [products.rows, tiers.rows, addons.rows]);

  const combinedShipping = useMemo(() => {
    return shippingOptions.rows.map((s) => ({
      ...s,
      ranges: shippingRanges.rows.filter((r) => r.shipping_option_id === s.id),
    }));
  }, [shippingOptions.rows, shippingRanges.rows]);

  const loading = products.loading || tiers.loading || addons.loading || finishes.loading || globalAddons.loading || shippingOptions.loading || shippingRanges.loading;

  return {
    loading,
    products: combinedProducts,
    finishes: finishes.rows,
    globalAddons: globalAddons.rows,
    shippingOptions: combinedShipping,
    refetchProducts: products.refetch,
    refetchTiers: tiers.refetch,
    refetchAddons: addons.refetch,
    refetchFinishes: finishes.refetch,
    refetchGlobalAddons: globalAddons.refetch,
    refetchShippingOptions: shippingOptions.refetch,
    refetchShippingRanges: shippingRanges.refetch,
  };
}
