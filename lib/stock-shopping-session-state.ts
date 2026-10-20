import type { StockSupplyItem } from '@/types';

export type ShoppingSessionDraft = {
  checked: Record<string, boolean>;
  prices: Record<string, string>;
  signatures: Record<string, string>;
};

/** IDs não bastam: editar quantidade/conversão invalida uma conferência antiga. */
export function shoppingItemSignature(item: StockSupplyItem): string {
  return JSON.stringify([
    item.id, item.stock_product_id || '', item.name,
    item.quantity, item.unit, item.purchase_quantity ?? null,
    item.conversion_quantity ?? null, item.presentation_id || '',
    item.purchase_unit || '',
  ]);
}

export function shoppingSupplySignature(items: readonly StockSupplyItem[]): string {
  return JSON.stringify(items.map(shoppingItemSignature));
}

export function reconcileShoppingDraft(
  items: readonly StockSupplyItem[],
  previous: Partial<ShoppingSessionDraft> | null | undefined,
  basePrices: Readonly<Record<string, string>>,
): ShoppingSessionDraft {
  const checked: Record<string, boolean> = {};
  const prices: Record<string, string> = {};
  const signatures: Record<string, string> = {};
  for (const item of items) {
    const id = item.id;
    const signature = shoppingItemSignature(item);
    const storedSignature = previous?.signatures?.[id];
    signatures[id] = signature;
    // Rascunhos antigos não têm fingerprint; continuam recuperáveis.
    checked[id] = previous?.checked?.[id] === true && (!storedSignature || storedSignature === signature);
    const price = previous?.prices?.[id];
    prices[id] = typeof price === 'string' && price.length <= 64 ? price : basePrices[id] || 'R$ 0,00';
  }
  return { checked, prices, signatures };
}
