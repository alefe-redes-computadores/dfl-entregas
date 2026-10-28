import type { Delivery } from '@/types';
import { groupDeliveriesByStop } from '@/lib/route-stops';

export type StopBrief = {
  key: string;
  title: string;
  address: string;
  orderIds: string[];
  deliveryIds: string[];
  pending: number;
  completed: number;
  urgent: boolean;
  needsAddress: boolean;
  needsLocation: boolean;
  missingIfoodCode: number;
};

/** Operacao local, somente leitura. Nunca agrupa valores comerciais ou confirmacoes. */
export function routeStopBriefing(deliveries: Delivery[]): StopBrief[] {
  return groupDeliveriesByStop(deliveries).map((stop) => {
    const active = stop.pending;
    const representative = active[0] || stop.representative;
    const address = String(representative.address_string || '').trim();
    const numberPresent = /\b\d{1,5}\b/.test(address);
    const missingIfoodCode = active.filter((d) =>
      d.origin === 'ifood' && !/^\d{4}$/.test(String(d.confirmation_code || '').replace(/\D/g, '')),
    ).length;
    return {
      key: stop.key,
      title: String(representative.customer_name || '').trim() || 'Cliente não informado',
      address: address || 'Endereço não informado',
      orderIds: stop.deliveries.map((d) => String(d.order_id || '').trim()).filter(Boolean),
      deliveryIds: stop.deliveries.map((d) => d.id),
      pending: active.length,
      completed: stop.completed.length,
      urgent: active.some((d) => d.is_urgent === true),
      needsAddress: active.length > 0 && (!address || !numberPresent),
      needsLocation: active.length > 0 && !active.some((d) => Boolean(String(d.maps_link || '').trim())),
      missingIfoodCode,
    };
  });
}

export function briefingText(stops: StopBrief[], routeName: string): string {
  const pending = stops.filter((stop) => stop.pending > 0);
  return [
    `DFL Entregas · ${routeName}`,
    `${pending.length} parada(s) pendente(s) · ${pending.reduce((sum, s) => sum + s.pending, 0)} pedido(s)`,
    ...pending.map((s, i) => [
      `${i + 1}. ${s.title} — ${s.address}`,
      s.orderIds.length ? `Pedidos: ${s.orderIds.map((id) => '#' + id).join(', ')}` : '',
      s.urgent ? 'URGENTE' : '',
      s.needsAddress ? 'CONFERIR ENDEREÇO' : '',
      s.missingIfoodCode ? `${s.missingIfoodCode} código(s) iFood pendente(s)` : '',
    ].filter(Boolean).join(' | ')),
  ].join('\n');
}
