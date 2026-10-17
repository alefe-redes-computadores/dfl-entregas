import type { StockMovement, StockProduct, StockSupply, StockSupplyItem } from '@/types';
import { clampStockExit, roundStockQuantity, stockExitExceeds } from '@/lib/stock-precision';

/**
 * Planejamento PURO do lançamento de uma compra. Todas as linhas do mesmo produto
 * compartilham um único saldo/custo progressivo, mas mantêm movimentos auditáveis.
 * O chamador deve ler os produtos uma única vez dentro da transação Firestore e
 * aplicar apenas UMA atualização de produto por id.
 */
export type StockSupplyLedgerMode = 'integrate' | 'reverse';
export type StockSupplyLedgerPlan = { changed: StockProduct[]; records: StockMovement[] };

export function groupStockSupplyItems(supply: Pick<StockSupply, 'items'>): Map<string, StockSupplyItem[]> {
  if (!supply.items.length) throw new Error('Uma compra sem itens não pode alterar o estoque.');
  const grouped = new Map<string, StockSupplyItem[]>();
  const lineIds = new Set<string>();
  for (const item of supply.items) {
    if (!item.id || lineIds.has(item.id)) throw new Error('Há itens com identificação duplicada ou ausente nesta compra.');
    lineIds.add(item.id);
    if (!item.stock_product_id) throw new Error(`Vincule o item ${item.name} a um produto do estoque.`);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || roundStockQuantity(item.quantity) <= 0) {
      throw new Error(`Quantidade inválida para ${item.name}.`);
    }
    if (item.unit_price !== undefined && (!Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      throw new Error(`Preço unitário inválido para ${item.name}.`);
    }
    if (item.total_price !== undefined && (!Number.isFinite(item.total_price) || item.total_price < 0)) {
      throw new Error(`Preço total inválido para ${item.name}.`);
    }
    const lines = grouped.get(item.stock_product_id) || [];
    lines.push(item);
    grouped.set(item.stock_product_id, lines);
  }
  return grouped;
}

function unitCost(item: StockSupplyItem): number | null {
  if (item.unit_price !== undefined && item.unit_price > 0) return item.unit_price;
  if (item.total_price !== undefined && item.total_price > 0) {
    return item.total_price / item.quantity;
  }
  return null;
}

export function planStockSupplyLedger(
  supply: StockSupply,
  products: ReadonlyMap<string, StockProduct>,
  mode: StockSupplyLedgerMode,
  now: string,
): StockSupplyLedgerPlan {
  const groups = groupStockSupplyItems(supply);
  const changed: StockProduct[] = [];
  const records: StockMovement[] = [];
  for (const [productId, entries] of groups) {
    const original = products.get(productId);
    if (!original) throw new Error(`Produto do estoque não encontrado: ${entries[0].name}.`);
    if (!Number.isFinite(original.current_quantity) || original.current_quantity < 0) {
      throw new Error(`Saldo inválido no estoque de ${original.name}.`);
    }
    // Estornos seguem a ordem inversa do lançamento: custos e saldos permanecem
    // sequenciais mesmo quando há duas embalagens/linhas do mesmo produto.
    const lines = mode === 'reverse' ? [...entries].reverse() : entries;
    let balance = roundStockQuantity(original.current_quantity);
    let averageCost = original.average_cost;
    for (const item of lines) {
      if (item.unit !== original.unit) throw new Error(`Unidade incompatível em ${item.name}.`);
      const quantity = roundStockQuantity(item.quantity);
      if (mode === 'reverse' && stockExitExceeds(quantity, balance, original.unit)) {
        throw new Error(`Estorno de ${original.name} ultrapassa o saldo disponível (${balance} ${original.unit}).`);
      }
      const effectiveQuantity = mode === 'reverse'
        ? clampStockExit(quantity, balance, original.unit)
        : quantity;
      const nextBalance = roundStockQuantity(balance + (mode === 'integrate' ? effectiveQuantity : -effectiveQuantity));
      const cost = unitCost(item);
      if (mode === 'integrate' && cost !== null) {
        // Custo histórico desconhecido não equivale a custo zero.
        const previousCost = typeof averageCost === 'number' && Number.isFinite(averageCost) && averageCost >= 0
          ? averageCost : cost;
        averageCost = Number(((balance * previousCost + effectiveQuantity * cost) / nextBalance).toFixed(4));
      }
      if (mode === 'reverse') {
        if (nextBalance <= 0) averageCost = undefined;
        else if (cost !== null && averageCost !== undefined && Number.isFinite(averageCost)) {
          averageCost = Number(Math.max(0, (balance * averageCost - effectiveQuantity * cost) / nextBalance).toFixed(4));
        }
      }
      records.push({
        id: `${mode === 'integrate' ? 'supply' : 'reversal'}-${supply.id}-${item.id}`,
        product_id: productId,
        product_name: original.name,
        type: mode === 'integrate' ? 'entrada' : 'saida',
        quantity: effectiveQuantity,
        balance_before: balance,
        balance_after: nextBalance,
        unit_cost: cost ?? item.unit_price,
        reason: mode === 'integrate'
          ? `Compra${supply.supplier ? ` em ${supply.supplier}` : ''}`
          : 'Estorno auditável de compra integrada',
        supply_id: supply.id,
        team_member_id: supply.purchaser_id,
        team_member_name: supply.purchaser_name,
        occurred_at: mode === 'integrate' ? supply.occurred_at : now,
        created_at: now,
      });
      balance = nextBalance;
    }
    changed.push({ ...original, current_quantity: balance, average_cost: averageCost, updated_at: now });
  }
  return { changed, records };
}
