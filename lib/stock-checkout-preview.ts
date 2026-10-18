import type { StockProduct, StockSupplyItem } from '@/types';
import { projectedAverageCost } from '@/lib/stock-shopping';

/** Prévia somente leitura; a integração real permanece sob transação Firestore. */
export interface StockCheckoutPreview {
  lineCount: number;
  incomingQuantity: number;
  balanceAfter: number;
  purchaseUnitCost: number | null;
  averageCostAfter: number | null;
}

export function buildStockCheckoutPreview(
  items: readonly StockSupplyItem[],
  products: ReadonlyMap<string, StockProduct>,
): Map<string, StockCheckoutPreview> {
  const totals = new Map<string, { lines: number; quantity: number; costTotal: number; validCost: boolean }>();
  for (const item of items) {
    const id = item.stock_product_id;
    if (!id || !products.has(id)) continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const current = totals.get(id) ?? { lines: 0, quantity: 0, costTotal: 0, validCost: true };
    current.lines += 1;
    current.quantity += quantity;
    const unitCost = Number(item.unit_price);
    if (!(Number.isFinite(unitCost) && unitCost > 0)) current.validCost = false;
    else current.costTotal += quantity * unitCost;
    totals.set(id, current);
  }
  const result = new Map<string, StockCheckoutPreview>();
  for (const [id, state] of totals) {
    const product = products.get(id)!;
    const newCost = state.validCost ? state.costTotal / state.quantity : null;
    result.set(id, {
      lineCount: state.lines,
      incomingQuantity: state.quantity,
      balanceAfter: Number((product.current_quantity + state.quantity).toFixed(4)),
      purchaseUnitCost: newCost,
      averageCostAfter: newCost === null ? null : projectedAverageCost(product, state.quantity, newCost),
    });
  }
  return result;
}
