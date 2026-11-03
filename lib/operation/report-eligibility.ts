/**
 * R233 — Fonte única de elegibilidade analítica.
 * Somente altera projeções/indicadores. NÃO reescreve pedidos, caixa ou estoque.
 * Um pedido real de perfil interno pode continuar contando no faturamento;
 * só um marcador explícito remove a amostra dos relatórios gerais.
 */
import type { Customer, Delivery, Motoboy } from '@/types';

export function excludedFromReports(
  delivery: Pick<Delivery, 'developer_test' | 'exclude_from_reports'>,
  customer?: Pick<Customer, 'exclude_from_analytics'> | null,
): boolean {
  return delivery.developer_test === true ||
    delivery.exclude_from_reports === true ||
    customer?.exclude_from_analytics === true;
}

export function excludedFromCustomerInsights(
  delivery: Pick<Delivery, 'developer_test' | 'exclude_from_reports' | 'exclude_customer_metrics'>,
  customer?: Pick<Customer, 'exclude_from_rankings' | 'exclude_from_analytics'> | null,
): boolean {
  return excludedFromReports(delivery, customer) ||
    delivery.exclude_customer_metrics === true ||
    customer?.exclude_from_rankings === true;
}

/** Ausente (legado) = acerto continua obrigatório. Não infere pelo nome ou valor zero. */
export function requiresMotoboySettlement(
  motoboy: Pick<Motoboy, 'settlement_required'>,
): boolean {
  return motoboy.settlement_required !== false;
}
