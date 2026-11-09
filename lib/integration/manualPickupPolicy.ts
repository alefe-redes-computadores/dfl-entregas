/** R301 — política pura para retirada MANUAL. Não dispara mensagens.
 * Pedido recebido e prontidão são fatos comerciais distintos; nenhum
 * deles equivale a entrega, pagamento ou retirada concluída.
 */
import { normalizeManualMessagePhone } from './manualMessagingPolicy';
import type { Delivery } from '@/types';

export type ManualPickupRecipientDecision =
  | { allowed: true }
  | { allowed: false; status: 'off' | 'skipped'; reason: string };

/** R303 / Site R38: valida somente destinatário da retirada manual v2.
 * Mensageria v1, comercial do Site e NEXT_STOP usam suas próprias políticas.
 * Nenhuma destas permissões envia mensagem ou altera flags.
 */
export function manualPickupRecipientAccess(
  env: Record<string, string | undefined>,
  phone: string,
): ManualPickupRecipientDecision {
  const off = (reason: string): ManualPickupRecipientDecision => ({allowed: false, status:'off', reason});
  const skipped = (reason: string): ManualPickupRecipientDecision => ({allowed: false, status:'skipped', reason});
  if (env.DFL_MANUAL_PICKUP_ENABLED !== 'true') return off('pickup_disabled');
  if (env.DFL_MANUAL_PICKUP_KILL_SWITCH !== 'false') return off('pickup_kill_switch');
  if (env.DFL_MANUAL_MESSAGING_ENABLED !== 'true') return off('manual_messaging_disabled');
  if (env.DFL_MANUAL_MESSAGING_KILL_SWITCH !== 'false') return off('manual_messaging_kill_switch');
  if (!/^55[1-9]\d{9,10}$/.test(phone)) return skipped('invalid_phone');
  const scope = env.DFL_MANUAL_PICKUP_SCOPE;
  if (scope === 'canary') {
    // O escopo histórico antigo permanece obrigatório SOMENTE no canário legado.
    if (env.DFL_MANUAL_MESSAGING_SCOPE !== 'canary') return off('canary_legacy_scope_mismatch');
    const pilot = env.DFL_MESSAGING_PILOT_PHONE_E164 || '';
    if (!/^55[1-9]\d{9,10}$/.test(pilot)) return off('pilot_not_configured');
    return phone === pilot ? {allowed: true} : skipped('not_pilot_phone');
  }
  if (scope === 'authorized_clients') {
    const raw = (env.DFL_MANUAL_PICKUP_APPROVED_PHONES_E164 || '').trim();
    const numbers = raw.split(',').map(v => v.trim()).filter(Boolean);
    if (numbers.length < 1 || numbers.length > 12 ||
        new Set(numbers).size !== numbers.length ||
        numbers.some(v => !/^55[1-9]\d{9,10}$/.test(v))) return off('approved_list_invalid');
    return numbers.includes(phone) ? {allowed: true} : skipped('not_authorized_phone');
  }
  if (scope === 'consented_customers') {
    return env.DFL_MANUAL_PICKUP_ROLLOUT_APPROVED === 'true'
      ? {allowed: true} : off('rollout_not_approved');
  }
  return off('pickup_scope_invalid');
}

export type ManualPickupReason = 'created' | 'ready';
export type ManualPickupPlan =
  | { eligible: false; reason: string }
  | {
      eligible: true;
      eventType: 'order.created' | 'order.ready';
      orderId: string;
      deliveryId: string;
      phone: string;
      customerName: string;
      occurredAt: string;
      payload: Record<string, string | number | boolean>;
    };

const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const recent = (date: unknown, now: number, ttlMs: number) => {
  const stamp = Date.parse(text(date));
  return Number.isFinite(stamp) && stamp <= now + 30_000 && now - stamp <= ttlMs;
};

export function planManualPickup(input: {
  delivery: Delivery;
  reason: ManualPickupReason;
  now: number;
}): ManualPickupPlan {
  const { delivery: d, reason, now } = input;
  if (!/^dfl-[A-Za-z0-9-]{12,120}$/.test(d.id)) return {eligible: false, reason: 'invalid_delivery_id'};
  if (d.source_system === 'dfl_site' || text(d.external_order_id) || d.origin !== 'loja')
    return {eligible: false, reason: 'site_or_marketplace'};
  if (d.fulfillment_mode !== 'pickup' || d.completed === true)
    return {eligible: false, reason: 'not_active_pickup'};
  if (d.notify_whatsapp !== true || d.manual_messaging_opt_in_v1 !== true)
    return {eligible: false, reason: 'no_explicit_consent'};
  if (d.developer_test === true || d.exclude_from_reports === true || Boolean(d.owner_order_context))
    return {eligible: false, reason: 'internal_or_test'};
  const phone = normalizeManualMessagePhone(d.phone);
  if (!phone) return {eligible: false, reason: 'invalid_phone'};

  const created = text(d.created_at || d.createdAt);
  const ready = text(d.pickup_ready_at);
  const selected = reason === 'created' ? created : ready;
  if (reason === 'created' && ready) return {eligible: false, reason: 'already_ready'};
  if (!recent(selected, now, reason === 'created' ? 15 * 60_000 : 7 * 60_000))
    return {eligible: false, reason: 'stale_event'};
  if (reason === 'ready' && created && Date.parse(ready) < Date.parse(created) - 30_000)
    return {eligible: false, reason: 'time_order_invalid'};
  const occurredAt = new Date(Date.parse(selected)).toISOString();
  const payload: Record<string, string | number | boolean> = {
    delivery_id: d.id,
    fulfillment_mode: 'pickup',
    manual_pickup_v1: true,
    manual_messaging_opt_in_v1: true,
    notify_whatsapp: true,
    completed: false,
    [reason === 'created' ? 'created_at' : 'pickup_ready_at']: occurredAt,
  };
  const charge = Number(d.customer_charge ?? d.value);
  if (Number.isFinite(charge) && charge >= 0 && charge < 100_000)
    payload.total = Math.round(charge * 100) / 100;
  if (text(d.payment_method)) payload.payment_method = text(d.payment_method).slice(0, 28);
  if (text(d.payment_state)) payload.payment_state = text(d.payment_state).slice(0, 32);
  if (d.is_paid === true) payload.is_paid = true;

  return {
    eligible: true,
    eventType: reason === 'created' ? 'order.created' : 'order.ready',
    orderId: `entregas:${d.id}`,
    deliveryId: d.id,
    occurredAt,
    customerName: text(d.customer_name).slice(0, 80),
    phone,
    payload,
  };
}
