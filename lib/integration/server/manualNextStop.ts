import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { adminDb } from './admin';
import { planManualNextStopTransition } from '../manualNextStopPolicy';
import { normalizeManualMessagePhone, planManualMessage } from '../manualMessagingPolicy';
import type { Delivery, Route } from '@/types';

type Outcome = { status: 'off' | 'skipped' | 'processed' | 'failed'; eligible: number; queued: number; duplicates: number; failed: number; reason?: string };
const empty = {eligible:0,queued:0,duplicates:0,failed:0};
const sha = (text:string) => createHash('sha256').update(text).digest('hex');
const enabled = () =>
  process.env.DFL_MANUAL_NEXT_STOP_ENABLED === 'true' &&
  process.env.DFL_MANUAL_NEXT_STOP_KILL_SWITCH === 'false' &&
  process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true' &&
  process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH !== 'true' &&
  ((process.env.DFL_MANUAL_NEXT_STOP_SCOPE === 'canary' &&
    process.env.DFL_MANUAL_MESSAGING_SCOPE === 'canary' &&
    /^55[1-9]\d{9,10}$/.test(process.env.DFL_MESSAGING_PILOT_PHONE_E164 || '')) ||
   (process.env.DFL_MANUAL_NEXT_STOP_SCOPE === 'consented_customers' &&
    process.env.DFL_MANUAL_MESSAGING_SCOPE === 'consented_customers' &&
    process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED === 'true'));
const targetSite = () => {
  const raw = process.env.DFL_SITE_INTEGRATION_URL?.trim();
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if (!raw || !secret) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['dafamilialanches.com.br','www.dafamilialanches.com.br','dafamilialanches.vercel.app'].includes(url.hostname)) return null;
    return {url:`${url.origin}/api/integration/manual-messaging`,secret};
  } catch { return null; }
};
const authorizedCandidate = (d:Delivery, pilot:string) => {
  if (d.source_system === 'dfl_site' || d.external_order_id || !['manual','loja'].includes(d.origin)) return false;
  if (d.fulfillment_mode && d.fulfillment_mode !== 'delivery') return false;
  if (d.completed === true || d.notify_whatsapp !== true || d.manual_messaging_opt_in_v1 !== true) return false;
  const recipient = normalizeManualMessagePhone(d.phone);
  if (!recipient) return false;
  // R52 exception stays strictly within the original one-phone canary.
  const ownerPilot = process.env.DFL_MANUAL_OWNER_PILOT_ENABLED === 'true' &&
    process.env.DFL_MANUAL_MESSAGING_SCOPE === 'canary' &&
    process.env.DFL_MANUAL_NEXT_STOP_SCOPE === 'canary' &&
    recipient === pilot &&
    d.owner_order_context === 'owner_test' && d.developer_test === true;
  if ((d.owner_order_context || d.exclude_from_reports === true || d.developer_test === true) && !ownerPilot) return false;
  if (process.env.DFL_MANUAL_NEXT_STOP_SCOPE === 'consented_customers') {
    return process.env.DFL_MANUAL_MESSAGING_SCOPE === 'consented_customers' &&
      process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED === 'true';
  }
  return recipient === pilot;
};

/** At-most-once queue transition, even if two APKs invoke the same server endpoint.
 * A timeout is UNKNOWN, not proof of failure; no automatic replay is scheduled.
 */
export async function notifyManualNextStop(routeId:string):Promise<Outcome> {
  if (!enabled()) return {status:'off',...empty};
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(routeId)) return {status:'skipped',reason:'route_id_invalid',...empty};
  const target = targetSite();
  if (!target) return {status:'failed',reason:'bridge_not_configured',...empty,failed:1};
  const pilot = process.env.DFL_MESSAGING_PILOT_PHONE_E164 || '';
  const [routeSnap, deliverySnap] = await Promise.all([
    adminDb.collection('routes').doc(routeId).get(),
    adminDb.collection('deliveries').where('route_id','==',routeId).limit(102).get(),
  ]);
  if (!routeSnap.exists || deliverySnap.size > 100) return {status:'skipped',reason:'route_missing_or_too_large',...empty};
  const route = {...routeSnap.data(), id:routeId} as Route;
  const deliveries = deliverySnap.docs.map(doc => ({...doc.data(),id:doc.id} as Delivery));
  const plan = planManualNextStopTransition({route,deliveries,now:Date.now()});
  if (!plan) return {status:'skipped',reason:'no_recent_physical_transition',...empty};
  // R302: uma notificação por destinatário e TRANSIÇÃO física, não por pedido.
  // Duas comandas na mesma parada não podem produzir dois WhatsApps.
  const candidateByPhone = new Map<string, Delivery>();
  const consented = plan.nextDeliveries.filter(d => authorizedCandidate(d,pilot))
    .slice().sort((a,b) => a.id.localeCompare(b.id));
  for (const delivery of consented) {
    const phone = normalizeManualMessagePhone(delivery.phone);
    if (phone && !candidateByPhone.has(phone)) candidateByPhone.set(phone,delivery);
  }
  const eligible = [...candidateByPhone.values()];
  if (!eligible.length) return {status:'skipped',reason:'no_consented_customer',...empty};
  const previousId = sha(`${routeId}:${plan.previousGroupKey}`).slice(0,40);
  const nextId = sha(`${routeId}:${plan.nextGroupKey}`).slice(0,40);
  const snapshotVersion = (parseInt(sha(JSON.stringify(plan.snapshotParts)).slice(0,7),16) % 1999999999) + 1;
  const transitionKey = sha(JSON.stringify({routeId,previousId,nextId,completedAt:plan.completedAt,snapshotVersion}));
  const activation = Date.parse(process.env.DFL_MANUAL_MESSAGING_ACTIVATED_AT || '');
  if (!Number.isFinite(activation) || Date.parse(plan.completedAt) < activation) return {status:'skipped',reason:'predates_rollout',...empty};
  let queued=0,duplicates=0,failed=0;
  for (const delivery of eligible) {
    const id = `manual-msg-v2__delivery.next_stop__${delivery.id}__${transitionKey}`;
    // Identidade da reserva permanece a mesma se uma comanda do próximo
    // grupo for baixada e outra continuar pendente. Sem segundo aviso.
    const recipientLedgerKey = sha(`${routeId}:${transitionKey}:${normalizeManualMessagePhone(delivery.phone)}`);
    const ledgerRef = adminDb.collection('manual_next_stop_transitions_v2').doc(recipientLedgerKey);
    const payload = {
      delivery_id:delivery.id,fulfillment_mode:'delivery',manual_messaging_opt_in_v1:true,
      notify_whatsapp:true,route_id:routeId,route_started:true,route_closed:false,
      previous_stop_completed:true,previous_stop_group_id:previousId,next_stop_group_id:nextId,
      previous_stop_completed_at:plan.completedAt,planned_stop:plan.plannedStop,
      total_stops:plan.totalStops,pending_stop_rank:1,stops_ahead:0,
      snapshot_version:snapshotVersion,transition_key:transitionKey,
    };
    const envelope = {
      event_id:id,source:'manual',event_type:'delivery.next_stop',
      order_id:`entregas:${delivery.id}`,occurred_at:plan.completedAt,
      customer_phone:normalizeManualMessagePhone(delivery.phone) || '',customer_name:(delivery.customer_name||'').slice(0,80),payload,
    };
    try {
      await ledgerRef.create({event_id:id,route_id:routeId,delivery_id:delivery.id,
        transition_key:transitionKey,status:'reserved',created_at:new Date().toISOString()});
    } catch (err) {
      // create() atomically rejects duplicate event reservation in multi-device races.
      if ((err as {code?:number|string}).code === 6 || (err as {code?:number|string}).code === '6') {duplicates++;continue;}
      failed++;continue;
    }
    // Fail closed if the route changed after acquiring the reservation.
    try {
      const [freshRoute,freshItems] = await Promise.all([
        adminDb.collection('routes').doc(routeId).get(),
        adminDb.collection('deliveries').where('route_id','==',routeId).limit(102).get(),
      ]);
      const fresh = freshRoute.exists && freshItems.size <= 100
        ? planManualNextStopTransition({route:{...freshRoute.data(),id:routeId} as Route,
            deliveries:freshItems.docs.map(d=>({...d.data(),id:d.id} as Delivery)),now:Date.now()}) : null;
      const freshSnapshot = fresh ? (parseInt(sha(JSON.stringify(fresh.snapshotParts)).slice(0,7),16) % 1999999999)+1 : -1;
      if (!fresh || fresh.previousGroupKey !== plan.previousGroupKey || fresh.nextGroupKey !== plan.nextGroupKey ||
          fresh.completedAt !== plan.completedAt || freshSnapshot !== snapshotVersion ||
          !fresh.nextDeliveries.some(d=>d.id===delivery.id && authorizedCandidate(d,pilot))) {
        await ledgerRef.update({status:'suppressed',reason:'stale_transition'});
        continue;
      }
      const body = JSON.stringify(envelope);
      const timestamp = String(Date.now());
      const signature = createHmac('sha256',target.secret).update(`${timestamp}.${body}`,'utf8').digest('hex');
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),14000);
      try {
        const response = await fetch(target.url,{method:'POST',headers:{'content-type':'application/json',
          'x-dfl-timestamp':timestamp,'x-dfl-signature':signature,'x-dfl-event-id':id},
          body,cache:'no-store',signal:controller.signal});
        const result = await response.json().catch(()=>null) as {ok?:boolean;queued?:boolean;duplicate?:boolean}|null;
        if(response.ok && result?.ok===true && result.queued===true){queued++;await ledgerRef.update({status:'queued',updated_at:new Date().toISOString()});}
        else if(response.ok && result?.duplicate===true){duplicates++;await ledgerRef.update({status:'duplicate',updated_at:new Date().toISOString()});}
        else {failed++;await ledgerRef.update({status:'uncertain',reason:`site_http_${response.status}`,updated_at:new Date().toISOString()});}
      } catch {
        failed++;await ledgerRef.update({status:'uncertain',reason:'timeout_or_network_unknown',updated_at:new Date().toISOString()});
      } finally {clearTimeout(timeout);}
    } catch {
      failed++;
      // Reservation remains: human review required, never blindly retry an unknown send.
    }
  }
  return {status:failed?'failed':'processed',eligible:eligible.length,queued,duplicates,failed};
}
