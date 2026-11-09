/** MSG-M1 — política pura de avisos para pedidos cadastrados no Entregas.
 * Não envia nada; ausência de confirmação explícita significa OFF.
 */
export type ManualMessageReason = 'created' | 'route_started' | 'delivery_completed';
export type ManualMessageType = 'order.created' | 'delivery.started' | 'delivery.completed';
export type ManualDeliveryRecord = {
  id: string;
  source_system?: unknown; external_order_id?: unknown; origin?: unknown; notify_whatsapp?: unknown;
  phone?: unknown; customer_name?: unknown; owner_order_context?: unknown; manual_messaging_opt_in_v1?: unknown;
  developer_test?: unknown; exclude_from_reports?: unknown; fulfillment_mode?: unknown;
  completed?: unknown; completed_at?: unknown; created_at?: unknown; createdAt?: unknown;
  address_string?: unknown; manual_order_items?: unknown; customer_charge?: unknown; value?: unknown;
  payment_method?: unknown; payment_state?: unknown; is_paid?: unknown;
};
export type ManualRouteRecord = { started_at?: unknown; departure_time?: unknown; status?: unknown };
export type ManualMessagePlan =
  | { eligible: false; reason: string }
  | { eligible: true; eventType: ManualMessageType; orderId: string; phone: string; customerName: string; payload: Record<string, string | number | boolean> };
const asText = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export function normalizeManualMessagePhone(value: unknown): string | null {
  const digits = asText(value).replace(/\D/g, '');
  const withoutCountry = digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if (!/^[1-9]\d{9,10}$/.test(withoutCountry)) return null;
  return `55${withoutCountry}`;
}
function recent(value: unknown, now: number, windowMs: number) {
  const stamp = Date.parse(asText(value));
  return Number.isFinite(stamp) && stamp <= now + 30_000 && now - stamp >= -30_000 && now - stamp <= windowMs;
}
export function planManualMessage(input: {
  delivery: ManualDeliveryRecord;
  reason: ManualMessageReason;
  route?: ManualRouteRecord | null;
  now?: number;
}): ManualMessagePlan {
  const { delivery: d, route } = input;
  const now = input.now ?? Date.now();
  if (!/^dfl-[A-Za-z0-9-]{12,120}$/.test(d.id)) return { eligible: false, reason: 'delivery_id_invalid' };
  if (d.source_system === 'dfl_site' || asText(d.external_order_id) || !['manual', 'loja'].includes(asText(d.origin))) return { eligible: false, reason: 'source_not_manual' };
  if (d.notify_whatsapp !== true || d.manual_messaging_opt_in_v1 !== true) return { eligible: false, reason: 'no_explicit_opt_in' };
  if (d.developer_test === true || Boolean(d.owner_order_context) || d.exclude_from_reports === true) return { eligible: false, reason: 'test_or_internal_order' };
  if (d.fulfillment_mode !== 'delivery') return { eligible: false, reason: 'not_dfl_delivery' };
  const phone = normalizeManualMessagePhone(d.phone);
  if (!phone) return { eligible: false, reason: 'phone_missing_or_invalid' };
  const eventType: ManualMessageType = input.reason === 'created' ? 'order.created' : input.reason === 'route_started' ? 'delivery.started' : 'delivery.completed';
  if (input.reason === 'created') {
    if (d.completed === true || !recent(d.created_at || d.createdAt, now, 15 * 60_000)) return {eligible:false,reason:'creation_not_current'};
  } else if (input.reason === 'route_started') {
    if (d.completed === true || !route || route.status === 'fechada' || !recent(route.started_at || route.departure_time,now,20*60_000)) return {eligible:false,reason:'route_not_recently_started'};
  } else if (d.completed !== true || !recent(d.completed_at,now,20*60_000)) {
    return {eligible:false,reason:'completion_not_current'};
  }
  const total = Number(d.customer_charge ?? d.value);
  const payload: Record<string, string | number | boolean> = {
    fulfillment_mode: 'delivery',
    delivery_id: d.id,
  };
  if (Number.isFinite(total) && total >= 0 && total < 100_000) payload.total = Math.round(total*100)/100;
  if (asText(d.address_string)) payload.address = asText(d.address_string).slice(0,180);
  if (asText(d.manual_order_items)) payload.order_description = asText(d.manual_order_items).slice(0,180);
  if (asText(d.payment_method)) payload.payment_method = asText(d.payment_method).slice(0,28);
  if (asText(d.payment_state)) payload.payment_state = asText(d.payment_state).slice(0,32);
  if (d.is_paid === true) payload.is_paid = true;
  return {eligible:true,eventType,orderId:`entregas:${d.id}`,phone,customerName:asText(d.customer_name).slice(0,80),payload};
}
