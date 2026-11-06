/** R286 — apresentação de ajustes já autorizados, sem alterar liquidação, caixa ou diária. */
import type { MotoboySettlementAdjustment } from '@/types';

type AdjustmentView = Pick<MotoboySettlementAdjustment, 'kind' | 'direction' | 'description' | 'category_label' | 'amount'>;
export type SettlementVisualLine = { label: string; amount: number };

const kindLabels: Record<MotoboySettlementAdjustment['kind'], string> = {
  meal: 'Consumo / lanche', consumption: 'Consumo / lanche', advance: 'Adiantamento',
  fuel: 'Combustível', tip: 'Gorjeta', extra_fee: 'Taxa extra',
  gratification: 'Gratificação', extra_service: 'Serviço extra',
  bread_pickup: 'Busca de pães', addition: 'Acréscimo', other: 'Outro ajuste', custom: 'Ajuste',
};

/** A mesma lista alimenta o canvas, evitando repetições de categoria no motivo. */
export function settlementVisualLines(items: readonly AdjustmentView[]) {
  const deductions: SettlementVisualLine[] = [];
  const additions: SettlementVisualLine[] = [];
  for (const item of items) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const category = (item.category_label || kindLabels[item.kind] || 'Ajuste').trim();
    const reason = (item.description || '').trim();
    const label = reason && reason.toLocaleLowerCase('pt-BR') !== category.toLocaleLowerCase('pt-BR')
      ? reason
      : category || 'Motivo não informado';
    (item.direction === 'addition' ? additions : deductions).push({ label, amount });
  }
  return { deductions, additions };
}
