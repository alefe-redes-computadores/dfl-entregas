import type { Delivery, Motoboy, Route } from '@/types';
import { routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { activeRouteDeliveries } from '@/lib/route-closure-eligibility';
import { calculateMotoboyFee } from '@/lib/motoboy-analytics';

/** Relatório apenas operacional. A diária não pode ser arbitrariamente dividida por rotas. */
export type RoutePerformanceReport = {
  routeName: string;
  motoboyName: string;
  date: string;
  status: 'Finalizada' | 'Na rua' | 'Montando';
  orders: number;
  completedOrders: number;
  stops: number;
  completedStops: number;
  durationMinutes: number | null;
  durationLabel: string;
  fee: number | null;
  feeDetail: string;
  feeLabel: string;
};

export const formatRouteDuration = (minutes: number | null): string =>
  minutes === null ? 'Não confirmada' : minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes}min`;

export const moneyBR = (amount: number) => amount.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});

export function summarizeRoutePerformance(route: Route, deliveries: Delivery[], motoboy?: Motoboy): RoutePerformanceReport {
  const active = activeRouteDeliveries(deliveries);
  const groups = groupDeliveriesByStop(active);
  // Uma parada só é concluída quando todos os pedidos daquele endereço terminaram.
  const completedStops = groups.filter(group => group.deliveries.length > 0 && group.deliveries.every(item => item.completed)).length;
  const completedOrders = active.filter(item => item.completed).length;
  const started = firstValidTimestamp(routeStartedAt(route));
  const finished = route.status === 'fechada' ? firstValidTimestamp(route.end_time) : null;
  const elapsedMs = started && finished ? finished.getTime() - started.getTime() : -1;
  const durationMinutes = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.floor(elapsedMs / 60000) : null;
  const rule = motoboy?.payment_rule;
  const perStop = rule?.type === 'per_delivery';
  const calculated = perStop ? calculateMotoboyFee(rule, completedStops) : null;
  const fee = calculated && Number.isFinite(calculated.amount) ? Math.max(0, calculated.amount) : null;
  const feeDetail = perStop ? `${completedStops} paradas físicas concluídas × ${moneyBR(Math.max(0, rule?.delivery_fee || 0))}`
    : rule ? 'Regra diária/fixa: valor apurado no acerto do motoboy' : 'Regra de pagamento não encontrada';
  return {
    routeName: route.name || 'Rota', motoboyName: route.motoboy_name || 'Entregador',
    date: route.operational_date || (started ? started.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : ''),
    status: route.status === 'fechada' ? 'Finalizada' : started ? 'Na rua' : 'Montando',
    orders: active.length, completedOrders,
    stops: groups.length, completedStops,
    durationMinutes, durationLabel: formatRouteDuration(durationMinutes),
    fee, feeDetail, feeLabel: fee === null ? 'Conferir acerto diário' : moneyBR(fee),
  };
}

export function routePerformanceText(report: RoutePerformanceReport): string {
  return [
    `🏍️ *${report.routeName} · ${report.motoboyName}*`,
    `📅 ${report.date || 'Data não informada'} · ${report.status}`,
    `📦 ${report.completedOrders}/${report.orders} pedidos concluídos`,
    `📍 ${report.completedStops}/${report.stops} paradas concluídas`,
    `⏱️ ${report.durationLabel}`,
    `💰 ${report.fee === null ? report.feeLabel : `Ganho calculado: ${report.feeLabel}`}`,
    `_${report.feeDetail}_`,
    'DFL Entregas · Resumo operacional',
  ].join('\n');
}
