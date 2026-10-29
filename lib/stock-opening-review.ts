import type { StockProduct, StockSupply } from '@/types';

export type OpeningStockIssue = { id: string; name: string; reason: 'zerado' | 'abaixo_minimo' | 'embalagem'; detail: string };

/** Auditoria de leitura somente: não altera estoque nem confunde compras abertas com saldo físico. */
export function stockOpeningReview(products: readonly StockProduct[], supplies: readonly StockSupply[]) {
  const issues: OpeningStockIssue[] = [];
  let zeros = 0, belowMinimum = 0, unitReviews = 0;
  for (const product of products) {
    if (!product.active) continue;
    const quantity = Number(product.current_quantity);
    const min = Number(product.minimum_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      zeros++;
      issues.push({ id: product.id, name: product.name, reason: 'zerado', detail: 'Sem saldo físico confirmado' });
    } else if (Number.isFinite(min) && min > 0 && quantity <= min) {
      belowMinimum++;
      issues.push({ id: product.id, name: product.name, reason: 'abaixo_minimo', detail: 'No mínimo ou abaixo dele' });
    }
    const unitRisk = ['pct', 'cx', 'fardo'].includes(product.unit) &&
      (product.presentations || []).some(p => p.active && p.purchase_unit !== product.unit && Number(p.conversion_quantity) > 1);
    if (unitRisk) {
      unitReviews++;
      issues.push({ id: product.id, name: product.name, reason: 'embalagem', detail: 'Conferir equivalência entre embalagem e unidade-base' });
    }
  }
  const openPurchases = supplies.filter(s => s.status === 'solicitado' || s.status === 'em_compra').length;
  return { zeros, belowMinimum, unitReviews, openPurchases, issues: issues.slice(0, 12), issueTotal: issues.length };
}
