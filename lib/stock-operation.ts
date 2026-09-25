import type { StockProduct } from '@/types';
import type { StockRecommendation } from '@/lib/stock-intelligence';

export type StockOperationPriority = 'ruptura' | 'comprar_agora' | 'planejar' | 'ok';

export function stockOperationPriority(
  product: StockProduct,
  recommendation?: StockRecommendation,
): StockOperationPriority {
  if (product.current_quantity <= 0) return 'ruptura';
  if (!recommendation) {
    return product.current_quantity <= product.minimum_quantity ? 'comprar_agora' : 'ok';
  }
  if (recommendation.minimumReached || recommendation.reorderDue) return 'comprar_agora';

  if (
    recommendation.daysUntilMinimum !== null &&
    recommendation.daysUntilMinimum <=
      Math.max(recommendation.leadTimeDays * 2, recommendation.leadTimeDays + 2)
  ) {
    return 'planejar';
  }
  return 'ok';
}

export const stockOperationRank: Record<StockOperationPriority, number> = {
  ruptura: 0,
  comprar_agora: 1,
  planejar: 2,
  ok: 3,
};

const days = (value: number | null) =>
  value === null
    ? 'Sem previsão'
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dia${Math.abs(value - 1) < 0.001 ? '' : 's'}`;

export function stockOperationTiming(recommendation?: StockRecommendation) {
  if (!recommendation) {
    return { minimum: 'Sem histórico', zero: 'Sem histórico', lead: 'Não informado' };
  }
  return {
    minimum: recommendation.minimumReached
      ? 'Mínimo atingido'
      : days(recommendation.daysUntilMinimum),
    zero: days(recommendation.coverageDays),
    lead: days(recommendation.leadTimeDays),
  };
}

export function stockOperationLabel(priority: StockOperationPriority) {
  if (priority === 'ruptura') return 'Zerado';
  if (priority === 'comprar_agora') return 'Comprar agora';
  if (priority === 'planejar') return 'Planejar';
  return 'Em dia';
}
