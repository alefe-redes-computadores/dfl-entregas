import type { StockProduct, StockSupplyUnit } from '@/types';
import { normalizeTypedPurchaseQuantity } from './stock-commercial';
import { parseStockQuantityInput } from './stock-quantity';

// Uma compra nunca deve omitir silenciosamente um item marcado por estar
// vazio, zerado, inválido ou por arredondar a quantidade para zero.
export function validateStockPurchaseQuantity(raw: string | undefined, unit: StockSupplyUnit) {
  if (!raw?.trim() || !/^(?:[0-9]+(?:[.,][0-9]+)?|[0-9]{1,3}(?:\.[0-9]{3})+,[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+\.[0-9]+|[.,][0-9]+)$/.test(raw.trim())) {
    return { valid: false, value: 0 } as const;
  }
  const parsed = parseStockQuantityInput(raw);
  const normalized = normalizeTypedPurchaseQuantity(parsed, unit);
  return { valid: Number.isFinite(parsed) && parsed > 0 && normalized > 0, value: normalized } as const;
}

export function invalidStockPurchaseSelections(
  products: StockProduct[],
  selected: Record<string, boolean>,
  quantities: Record<string, string>,
  unitFor: (product: StockProduct) => StockSupplyUnit,
) {
  return products.filter((product) => selected[product.id] &&
    !validateStockPurchaseQuantity(quantities[product.id], unitFor(product)).valid);
}
