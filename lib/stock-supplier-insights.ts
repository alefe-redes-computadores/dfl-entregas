import type { StockSupply, StockSupplyItem } from '@/types';
import { normalizeStockSearch } from '@/lib/stock-search';

export type SupplierPriceSuggestion = { price: number; date: string };
export type SupplierPurchaseInsights = {
  preferredProductIds: string[];
  latestPrices: ReadonlyMap<string, SupplierPriceSuggestion>;
};

/** Comparação conservadora: mesma unidade comercial, apresentação e fator. */
export function supplierPriceKey(item: Pick<StockSupplyItem, 'stock_product_id' | 'presentation_id' | 'purchase_unit' | 'unit' | 'conversion_quantity'>) {
  const factor = Number(item.conversion_quantity ?? 1);
  if (!item.stock_product_id || !Number.isFinite(factor) || factor <= 0) return null;
  return JSON.stringify([
    item.stock_product_id,
    item.presentation_id || '',
    item.purchase_unit || item.unit,
    Number(factor.toFixed(6)),
  ]);
}

export function supplierPurchaseInsights(
  supplies: readonly StockSupply[],
  supplierId: string,
  supplierName: string,
  excludeSupplyId?: string,
): SupplierPurchaseInsights {
  const name = normalizeStockSearch(supplierName);
  const counts = new Map<string, number>();
  const latestPrices = new Map<string, SupplierPriceSuggestion>();
  const timestamps = new Map<string, number>();
  if (!supplierId && !name) return { preferredProductIds: [], latestPrices };

  for (const supply of supplies) {
    if (supply.id === excludeSupplyId || (supply.status !== 'recebido' && supply.status !== 'conferido')) continue;
    // Se existe ID de fornecedor, não misturar fornecedores pelo nome parecido.
    if (supplierId ? supply.supplier_id !== supplierId : normalizeStockSearch(supply.supplier || '') !== name) continue;
    const time = Date.parse(supply.occurred_at);
    if (!Number.isFinite(time)) continue;
    for (const item of supply.items) {
      if (!item.stock_product_id) continue;
      counts.set(item.stock_product_id, (counts.get(item.stock_product_id) || 0) + 1);
      const key = supplierPriceKey(item);
      if (!key || (timestamps.get(key) ?? -Infinity) > time) continue;
      const quantity = Number(item.purchase_quantity ?? (Number(item.quantity) / Number(item.conversion_quantity || 1)));
      const directPrice = Number(item.purchase_unit_price);
      const totalPrice = Number(item.total_price);
      const price = Number.isFinite(directPrice) && directPrice > 0
        ? directPrice : Number.isFinite(quantity) && quantity > 0 && Number.isFinite(totalPrice) && totalPrice > 0
          ? totalPrice / quantity : 0;
      if (!Number.isFinite(price) || price <= 0) continue;
      timestamps.set(key, time);
      latestPrices.set(key, { price, date: supply.occurred_at });
    }
  }
  return {
    preferredProductIds: [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([id]) => id),
    latestPrices,
  };
}
