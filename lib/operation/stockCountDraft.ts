/** Contagem fisica: digitacao humana nao e alteracao remota de saldo. */
import { parseStockQuantityInput } from '@/lib/stock-quantity';

type CountProduct = Readonly<{ id: string; current_quantity: number }>;
export type StockDraftState = Readonly<{
  quantity: number;
  expectedQuantity: number;
  display: string;
  touched: boolean;
  changed: boolean;
  conflict: boolean;
}>;

export function stockCountDraftState(
  current: number,
  raw?: string,
  expected?: number,
): StockDraftState {
  const validReference = typeof expected === 'number' && Number.isFinite(expected) && expected >= 0;
  const reference = validReference ? expected! : current;
  const quantity = raw === undefined ? current : parseStockQuantityInput(raw);
  const touched = raw !== undefined && quantity !== reference;
  // Entrada nao editada acompanha o saldo mais recente. Nao vira movimento ficticio.
  const expectedQuantity = touched ? reference : current;
  return {
    quantity: touched ? quantity : current,
    expectedQuantity,
    display: touched ? raw! : String(current),
    touched,
    changed: touched && quantity !== current,
    conflict: touched && (!validReference || current !== reference),
  };
}

export function reviewStockCountDraft<T extends CountProduct>(
  products: readonly T[],
  values: Readonly<Record<string, string>>,
  baseline: Readonly<Record<string, number>>,
) {
  const changed: T[] = [];
  const conflicts: T[] = [];
  for (const product of products) {
    const state = stockCountDraftState(product.current_quantity, values[product.id], baseline[product.id]);
    if (state.changed) changed.push(product);
    if (state.conflict) conflicts.push(product);
  }
  return { changed, conflicts };
}
