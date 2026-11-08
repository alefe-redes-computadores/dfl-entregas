/** Projeção em memória, sem Firestore, GPS, credenciais, inferência de fraude ou mensagens. */
import type { Customer, Delivery } from '@/types';
import { customerRelationshipScore } from '@/lib/customer-relationship-score';
import { deliveryCustomerCharge } from '@/lib/delivery-finance';

export interface CustomerIntelligence {
  customerId: string;
  completed: number;
  score: number | null;
  tier: string;
  totalCharged: number;
  averageTicket: number;
  mostUsedPayment: string | null;
  mostCommonHour: number | null;
  lastCompletedAt: string | null;
  verifiedOrders: Delivery[];
}

const hourFormatter = new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});

const valid = (delivery: Delivery): boolean =>
  delivery.completed === true && delivery.developer_test !== true &&
  delivery.exclude_customer_metrics !== true && delivery.exclude_from_reports !== true &&
  !(delivery.source_system === 'dfl_site' && /cancel(?:ad[oa]|led|ed)/i.test(String(delivery.site_order_status || '')));

export function buildCustomerIntelligence(customer: Customer, source: readonly Delivery[], now = new Date()): CustomerIntelligence {
  const score = customerRelationshipScore(source, now);
  const orders = source.filter(valid).filter((d, i, arr) => arr.findIndex(v => v.id === d.id) === i);
  const totalCharged = orders.reduce((sum, d) => sum + Math.max(0, Number(deliveryCustomerCharge(d)) || 0), 0);
  const payments = new Map<string, number>();
  const hours = new Map<number, number>();
  let last: Date | null = null;
  for (const d of orders) {
    if (d.payment_method) payments.set(d.payment_method, (payments.get(d.payment_method) || 0) + 1);
    const raw = d.created_at || d.createdAt;
    const when = raw ? new Date(raw) : null;
    if (!when || !Number.isFinite(when.getTime()) || when.getTime() > now.getTime()) continue;
    const hour = Number(hourFormatter.format(when));
    if (Number.isFinite(hour)) hours.set(hour, (hours.get(hour) || 0) + 1);
    if (!last || when > last) last = when;
  }
  const top = <T,>(map: Map<T, number>): T | null => [...map].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null;
  const eligible = score.completedOrders > 0;
  return {
    customerId: customer.id, completed: orders.length, score: eligible ? score.score : null,
    tier: !eligible ? 'Em formação' : score.tier === 'vip' ? 'VIP por recorrência' : score.tier === 'frequente' ? 'Frequente' : score.tier === 'inativo' ? 'Histórico inativo' : 'Em descoberta',
    totalCharged, averageTicket: orders.length ? totalCharged / orders.length : 0,
    mostUsedPayment: top(payments), mostCommonHour: top(hours), lastCompletedAt: last ? (last as Date).toISOString() : null,
    verifiedOrders: orders,
  };
}
