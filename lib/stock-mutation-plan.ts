import type { StockMovement, StockProduct } from '@/types';
import { clampStockExit, roundStockQuantity, stockExitExceeds } from '@/lib/stock-precision';

/** Planejadores puros: sem Firestore, relógio interno ou efeitos colaterais. */
export type StockMovementDraft = Omit<StockMovement, 'balance_before' | 'balance_after' | 'created_at'> & {
  /** Saldo exibido ao operador. Impede gravar um cálculo feito sobre uma tela desatualizada. */
  expected_balance?: number;
};
export type StockCountInput = {
  product_id: string;
  quantity: number;
  /** Saldo visto ao começar a contagem — obrigatório para não perder alterações de outro aparelho. */
  expected_quantity: number;
};
export type StockMutationPlan = {
  before: StockProduct;
  changed: StockProduct;
  record: StockMovement;
};
export type StockCountPlan = {
  before: Map<string, StockProduct>;
  changed: StockProduct[];
  records: StockMovement[];
};

const finiteNonNegative = (value: number) => Number.isFinite(value) && value >= 0;

const ensureBalance = (product: StockProduct) => {
  if (!finiteNonNegative(product.current_quantity)) throw new Error(`Saldo inválido de ${product.name} no servidor.`);
  return roundStockQuantity(product.current_quantity);
};

const checkExpected = (product: StockProduct, actual: number, expected: number | undefined) => {
  if (expected === undefined) return;
  if (!finiteNonNegative(expected)) throw new Error('Saldo de referência inválido. Atualize o produto.');
  if (roundStockQuantity(expected) !== actual) {
    throw new Error(`O saldo de ${product.name} mudou em outro aparelho (${actual} ${product.unit}). Atualize a tela antes de confirmar.`);
  }
};

export function planStockMovement(
  original: StockProduct,
  draft: StockMovementDraft,
  now: string,
): StockMutationPlan {
  if (!draft.id?.trim() || !draft.product_id?.trim() || draft.product_id !== original.id) {
    throw new Error('Identificação da movimentação inválida.');
  }
  if (!['entrada', 'saida', 'perda', 'ajuste', 'contagem'].includes(draft.type)) {
    throw new Error('Tipo de movimentação inválido.');
  }
  if (!finiteNonNegative(draft.quantity) || (draft.type !== 'ajuste' && draft.type !== 'contagem' && draft.quantity <= 0)) {
    throw new Error('Quantidade inválida para movimentação.');
  }
  if (draft.unit_cost !== undefined && !finiteNonNegative(draft.unit_cost)) {
    throw new Error('Custo informado inválido.');
  }
  const before = ensureBalance(original);
  checkExpected(original, before, draft.expected_balance);
  const exit = draft.type === 'saida' || draft.type === 'perda';
  const quantity = roundStockQuantity(draft.quantity);
  if (exit && stockExitExceeds(quantity, before, original.unit)) {
    throw new Error(`Saldo insuficiente para ${original.name}. Disponível: ${before} ${original.unit}.`);
  }
  if (quantity <= 0 && draft.type !== 'contagem' && draft.type !== 'ajuste') {
    throw new Error('A quantidade é pequena demais para a precisão do estoque.');
  }
  const actualQuantity = exit ? clampStockExit(quantity, before, original.unit) : quantity;
  if (exit && actualQuantity <= 0) throw new Error('Não há saldo disponível para esta saída.');
  const after = roundStockQuantity(
    draft.type === 'ajuste' || draft.type === 'contagem'
      ? actualQuantity
      : draft.type === 'entrada' ? before + actualQuantity : before - actualQuantity,
  );
  if (!finiteNonNegative(after)) throw new Error('Saldo resultante inválido.');

  let averageCost = original.average_cost;
  if (draft.type === 'entrada' && draft.unit_cost !== undefined && draft.unit_cost > 0) {
    const previous = finiteNonNegative(averageCost as number) ? averageCost! : draft.unit_cost;
    averageCost = Number(((before * previous + actualQuantity * draft.unit_cost) / after).toFixed(4));
  }
  const changed: StockProduct = {
    ...original,
    current_quantity: after,
    average_cost: averageCost,
    last_counted_at: draft.type === 'contagem' ? draft.occurred_at : original.last_counted_at,
    updated_at: now,
  };
  // expected_balance é um pré-requisito de concorrência, NUNCA dado persistido.
  const { expected_balance: _expectedBalance, ...persisted } = draft;
  const record: StockMovement = {
    ...persisted,
    product_name: original.name,
    quantity: actualQuantity,
    balance_before: before,
    balance_after: after,
    created_at: now,
  };
  return { before: original, changed, record };
}

export function planStockCount(
  counts: StockCountInput[],
  products: ReadonlyMap<string, StockProduct>,
  operationId: string,
  now: string,
  responsible?: { id?: string; name?: string },
): StockCountPlan {
  if (!operationId.trim()) throw new Error('Operação de contagem sem identificação.');
  if (!counts.length || counts.length > 200) throw new Error('A contagem precisa ter entre 1 e 200 produtos.');
  const ids = new Set<string>();
  const changed: StockProduct[] = [];
  const before = new Map<string, StockProduct>();
  const records: StockMovement[] = [];
  for (const [index, count] of counts.entries()) {
    if (!count.product_id || ids.has(count.product_id)) throw new Error('Produto duplicado na contagem física.');
    ids.add(count.product_id);
    const original = products.get(count.product_id);
    if (!original) throw new Error('Produto da contagem não encontrado no servidor.');
    const oldBalance = ensureBalance(original);
    if (!finiteNonNegative(count.expected_quantity)) throw new Error('Saldo de referência inválido. Atualize o produto.');
    checkExpected(original, oldBalance, count.expected_quantity);
    if (!finiteNonNegative(count.quantity)) throw new Error(`Contagem inválida para ${original.name}.`);
    const quantity = roundStockQuantity(count.quantity);
    const product = { ...original, current_quantity: quantity, last_counted_at: now, updated_at: now };
    before.set(original.id, original);
    changed.push(product);
    records.push({
      id: `${operationId}-${index}-${original.id}`,
      product_id: original.id,
      product_name: original.name,
      type: 'contagem',
      quantity,
      balance_before: oldBalance,
      balance_after: quantity,
      reason: 'Contagem física em lote',
      team_member_id: responsible?.id,
      team_member_name: responsible?.name,
      occurred_at: now,
      created_at: now,
    });
  }
  return { before, changed, records };
}
