import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { adminDb } from './admin';
import { planManualPickup, type ManualPickupReason } from '../manualPickupPolicy';
import type { Delivery } from '@/types';

export type ManualPickupResult = {
  status: 'off' | 'skipped' | 'queued' | 'duplicate' | 'failed';
  reason?: string;
};
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const gate = (): boolean =>
  process.env.DFL_MANUAL_PICKUP_ENABLED === 'true' &&
  process.env.DFL_MANUAL_PICKUP_KILL_SWITCH === 'false' &&
  process.env.DFL_MANUAL_PICKUP_SCOPE === 'canary' &&
  process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true' &&
  process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH === 'false' &&
  process.env.DFL_MANUAL_MESSAGING_SCOPE === 'canary' &&
  /^55[1-9]\d{9,10}$/.test(process.env.DFL_MESSAGING_PILOT_PHONE_E164 || '');
const site = () => {
  const raw = process.env.DFL_SITE_INTEGRATION_URL?.trim();
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if (!raw || !secret) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['dafamilialanches.com.br', 'www.dafamilialanches.com.br', 'dafamilialanches.vercel.app'].includes(url.hostname)) return null;
    return {url: `${url.origin}/api/integration/manual-messaging`, secret};
  } catch { return null; }
};
const oldEnough = (createdAt: string) => {
  const activation = Date.parse(process.env.DFL_MANUAL_MESSAGING_ACTIVATED_AT || '');
  const created = Date.parse(createdAt);
  return Number.isFinite(activation) && Number.isFinite(created) && created >= activation;
};

/** Um único aviso de cada fase por pedido. Reserva atômica impede dois aparelhos.
 * Resposta incerta NÃO pode ser retransmitida automaticamente.
 */
export async function notifyManualPickup(deliveryId: string, reason: ManualPickupReason): Promise<ManualPickupResult> {
  if (!gate()) return {status:'off'};
  if (!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId) || !['created','ready'].includes(reason))
    return {status:'skipped',reason:'invalid_request'};
  const target = site();
  if (!target) return {status:'failed',reason:'bridge_not_configured'};
  const deliveryRef = adminDb.collection('deliveries').doc(deliveryId);
  const snap = await deliveryRef.get();
  if (!snap.exists) return {status:'skipped',reason:'delivery_missing'};
  const delivery = {...snap.data(),id:snap.id} as Delivery;
  if (!oldEnough(delivery.created_at || delivery.createdAt || '')) return {status:'skipped',reason:'predates_rollout'};
  const plan = planManualPickup({delivery,reason,now:Date.now()});
  if (!plan.eligible) return {status:'skipped',reason:plan.reason};
  if (plan.phone !== process.env.DFL_MESSAGING_PILOT_PHONE_E164) return {status:'skipped',reason:'not_pilot_phone'};

  const transitionKey = sha(JSON.stringify({v:2,deliveryId,reason,occurredAt:plan.occurredAt}));
  const eventId = `manual-msg-v2__${plan.eventType}__${deliveryId}__${transitionKey}`;
  const event = {
    event_id:eventId,source:'manual',event_type:plan.eventType,
    order_id:plan.orderId,occurred_at:plan.occurredAt,
    customer_phone:plan.phone,customer_name:plan.customerName,
    payload:{...plan.payload,transition_key:transitionKey},
  };

  // Chave é por fase, não por timestamp mutável do aparelho.
  const ledgerRef = adminDb.collection('manual_pickup_events_v2').doc(sha(`${deliveryId}:${reason}`));
  try {
    await ledgerRef.create({event_id:eventId,delivery_id:deliveryId,phase:reason,status:'reserved',created_at:new Date().toISOString()});
  } catch (err) {
    if ((err as {code?:number|string}).code === 6 || (err as {code?:number|string}).code === '6')
      return {status:'duplicate'};
    return {status:'failed',reason:'reservation_unconfirmed'};
  }

  try {
    // Conferir o documento depois de reservar: servidor é autoridade, não o APK.
    const freshSnap = await deliveryRef.get();
    const fresh = freshSnap.exists
      ? planManualPickup({delivery:{...freshSnap.data(),id:freshSnap.id} as Delivery,reason,now:Date.now()})
      : null;
    if (!fresh?.eligible || fresh.occurredAt !== plan.occurredAt || fresh.phone !== plan.phone ||
        !oldEnough(String((freshSnap.data() || {}).created_at || (freshSnap.data() || {}).createdAt || ''))) {
      await ledgerRef.update({status:'suppressed',reason:'stale_or_changed',updated_at:new Date().toISOString()});
      return {status:'skipped',reason:'stale_or_changed'};
    }
    const body=JSON.stringify(event);
    const timestamp=String(Date.now());
    const signature=createHmac('sha256',target.secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),14000);
    try {
      const response=await fetch(target.url,{method:'POST',headers:{'content-type':'application/json',
        'x-dfl-timestamp':timestamp,'x-dfl-signature':signature,'x-dfl-event-id':eventId},
        body,cache:'no-store',signal:controller.signal});
      const parsed=await response.json().catch(()=>null) as {ok?:boolean;queued?:boolean;duplicate?:boolean}|null;
      if (response.ok && parsed?.ok === true && parsed.queued === true) {
        await ledgerRef.update({status:'queued',updated_at:new Date().toISOString()});
        return {status:'queued'};
      }
      if (response.ok && parsed?.duplicate === true) {
        await ledgerRef.update({status:'duplicate',updated_at:new Date().toISOString()});
        return {status:'duplicate'};
      }
      await ledgerRef.update({status:'uncertain',reason:`site_http_${response.status}`,updated_at:new Date().toISOString()});
      return {status:'failed',reason:'site_not_confirmed'};
    } catch {
      await ledgerRef.update({status:'uncertain',reason:'network_unknown',updated_at:new Date().toISOString()});
      return {status:'failed',reason:'network_unknown'};
    } finally {clearTimeout(timeout);}
  } catch {
    // Reserva permanece. Nunca reprocessar automaticamente um envio incerto.
    return {status:'failed',reason:'state_unconfirmed'};
  }
}
