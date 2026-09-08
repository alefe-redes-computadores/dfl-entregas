// lib/stock-supply.ts
import type { StockSupply, StockSupplyStatus, StockSupplyUnit } from '@/types';

export const SUPPLY_STATUS_LABELS: Record<StockSupplyStatus, string> = {
  solicitado: 'Solicitado',
  em_compra: 'Em compra',
  recebido: 'Recebido',
  conferido: 'Conferido',
};

export const SUPPLY_UNIT_LABELS: Record<StockSupplyUnit, string> = {
  un: 'Unidade', kg: 'Quilo', g: 'Grama', l: 'Litro', ml: 'Mililitro',
  cx: 'Caixa', pct: 'Pacote', fardo: 'Fardo',
};

export const supplyDate = (item: Pick<StockSupply, 'occurred_at' | 'created_at'>) => {
  const date = new Date(item.occurred_at || item.created_at);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

export const supplyTotal = (item: Pick<StockSupply, 'items' | 'total_amount'>) => {
  const itemTotal = item.items.reduce((sum, current) => sum + (current.total_price || 0), 0);
  return Number((item.total_amount || itemTotal).toFixed(2));
};

export const money = (value = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function buildStockSupplyMetrics(items: StockSupply[]) {
  return {
    count: items.length,
    totalAmount: Number(items.reduce((sum, item) => sum + supplyTotal(item), 0).toFixed(2)),
    itemCount: items.reduce((sum, item) => sum + item.items.length, 0),
    pendingCount: items.filter((item) => item.status === 'solicitado' || item.status === 'em_compra').length,
    uncheckedCount: items.filter((item) => item.status === 'recebido').length,
  };
}
