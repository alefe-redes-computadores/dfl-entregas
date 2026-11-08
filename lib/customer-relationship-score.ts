/**
 * R299 P5 — Score de relacionamento (NÃO é score de crédito, fraude ou risco).
 * Projeção local e explicável, sem persistência, chamadas de rede nem concessão automática de benefício.
 * Os limiares de recorrência 5/10 são preservados de lib/customer-recurrence.ts.
 */
import type { Delivery } from '@/types';

export type CustomerRelationshipTier = 'novo' | 'frequente' | 'vip' | 'inativo';
export type CustomerRelationshipScore = Readonly<{
  score: number;
  tier: CustomerRelationshipTier;
  completedOrders: number;
  activeMonths: number;
  daysSinceLastPurchase: number | null;
  scoreParts: Readonly<{ completions: number; months: number; recency: number; frequency: number }>;
}>;

const MS_DAY = 86_400_000;
const finiteDate = (raw: unknown): Date | null => {
  if (!raw || (typeof raw !== 'string' && !(raw instanceof Date))) return null;
  const parsed = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const isValidCompleted = (delivery: Delivery): boolean => {
  if (delivery.completed !== true || delivery.developer_test === true || delivery.exclude_from_reports === true || delivery.exclude_customer_metrics === true) return false;
  if (delivery.source_system === 'dfl_site' && /cancel(?:ad[oa]|led|ed)/i.test(String(delivery.site_order_status || ''))) return false;
  return true;
};

export function customerRelationshipScore(deliveries: readonly Delivery[], now: Date = new Date()): CustomerRelationshipScore {
  const seen = new Set<string>();
  const completed: Delivery[] = [];
  for (const delivery of deliveries) {
    if (!delivery.id || seen.has(delivery.id) || !isValidCompleted(delivery)) continue;
    seen.add(delivery.id);
    completed.push(delivery);
  }
  const months = new Set<string>();
  let latest: number | null = null;
  for (const delivery of completed) {
    // Nunca usar updated_at (edicao posterior não é uma compra nova).
    const date = finiteDate(delivery.created_at || delivery.createdAt);
    if (!date || date.getTime() > now.getTime()) continue;
    months.add(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
    if (latest === null || date.getTime() > latest) latest = date.getTime();
  }
  const completedOrders = completed.length;
  const activeMonths = months.size;
  const daysSinceLastPurchase = latest === null ? null : Math.max(0, Math.floor((now.getTime() - latest) / MS_DAY));
  const completions = Math.min(45, completedOrders * 4.5);
  const monthScore = Math.min(25, activeMonths * 6.25);
  const recency = daysSinceLastPurchase === null ? 0 : daysSinceLastPurchase <= 30 ? 20 : daysSinceLastPurchase <= 90 ? 12 : daysSinceLastPurchase <= 180 ? 6 : 0;
  const ordersPerMonth = activeMonths ? completedOrders / activeMonths : 0;
  const frequency = ordersPerMonth >= 3 ? 10 : ordersPerMonth >= 2 ? 7 : ordersPerMonth >= 1 ? 4 : 0;
  const tier: CustomerRelationshipTier = completedOrders === 0 ? 'novo' : daysSinceLastPurchase !== null && daysSinceLastPurchase > 180 ? 'inativo' : completedOrders >= 10 ? 'vip' : completedOrders >= 5 ? 'frequente' : 'novo';
  return {
    score: Math.min(100, Math.round(completions + monthScore + recency + frequency)),
    tier,
    completedOrders,
    activeMonths,
    daysSinceLastPurchase,
    scoreParts: { completions, months: monthScore, recency, frequency },
  };
}
