import 'server-only';
import { adminDb } from '@/lib/integration/server/admin';
import { hexSha256, randomSecret, trackingCustomerEnabled, trackingTenant, trackingCodeEnabled } from './security';
import {
  canonicalOrderKey, commercialState, iso, mayIssueNewTrackingGrant, projectPublicTracking, sortUniqueEvents,
  type Raw, type TrackingEvent, type TrackingKind, type PublicProjection,
} from './core';

const txt = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const validId = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
const permittedModes = ['OFF','DRY_RUN','MANUAL','AUTOMATIC_CERTIFIED'];
export type CapabilityState = {
  tenant: string; mode: string; kill_switch: boolean; public_tracking: boolean;
  issue_tracking_link: boolean; show_courier: boolean; show_position: boolean;
  eligible_origins: string[];
  event_modes: Record<string,string>;
};
export async function capabilities(): Promise<CapabilityState | null> {
  if (!trackingCodeEnabled()) return null;
  const tenant = trackingTenant();
  if (!tenant) return null;
  const snap = await adminDb.collection('tracking_capabilities_v1').doc(tenant).get();
  const raw = (snap.data() || {}) as Raw;
  const mode = typeof raw.mode === 'string' && permittedModes.includes(raw.mode) ? raw.mode : 'OFF';
  return {
    tenant, mode, kill_switch: raw.kill_switch !== false,
    public_tracking: raw.public_tracking === true,
    issue_tracking_link: raw.issue_tracking_link === true,
    show_courier: raw.show_courier === true,
    show_position: raw.show_position === true,
    event_modes: raw.event_modes && typeof raw.event_modes === 'object' && !Array.isArray(raw.event_modes) ?
      Object.fromEntries(Object.entries(raw.event_modes as Raw).filter(([event,mode]) =>
        ['allocation_notice','dispatch_notice','next_stop_notice','completion_notice'].includes(event) &&
        typeof mode === 'string' && permittedModes.includes(mode))) as Record<string,string> : {},
    eligible_origins: Array.isArray(raw.eligible_origins) ? raw.eligible_origins.filter(x =>
      x === 'dfl_site' || x === 'manual' || x === 'whatsapp' || x === 'ifood' || x === 'food99') : [],
  };
}
export function canAccessCustomer(c: CapabilityState | null) {
  return Boolean(c && trackingCustomerEnabled() && !c.kill_switch && c.public_tracking && c.issue_tracking_link &&
    ['MANUAL','AUTOMATIC_CERTIFIED'].includes(c.mode));
}
export function belongsToTenant(d: Raw, tenant: string): boolean {
  const explicit = txt(d.tenant_id || d.company_id);
  return explicit ? explicit === tenant : process.env.DFL_TRACKING_LEGACY_TENANT_ID === tenant;
}
function originOf(d: Raw): string {
  if (d.source_system === 'dfl_site') return 'dfl_site';
  if (d.origin === 'ifood') return 'ifood';
  if (d.origin === 'food99') return 'food99';
  return 'manual'; // WhatsApp is not currently separately proven by persisted schema.
}
function scopeId(tenant: string, key: string) { return hexSha256(`${tenant}|${key}`); }
function grantDocId(tenant: string, key: string) { return scopeId(tenant, key); }
const grantRef = (id: string) => adminDb.collection('tracking_grants_v1').doc(id);
const idxRef = (token: string) => adminDb.collection('tracking_token_index_v1').doc(hexSha256(token));
const sessionRef = (session: string) => adminDb.collection('tracking_sessions_v1').doc(hexSha256(session));
const ledgerRef = (tenant: string, key: string) => adminDb.collection('tracking_event_ledgers_v1').doc(scopeId(tenant, key));
export async function confirmedDelivery(deliveryId: string) {
  if (!validId(deliveryId)) return null;
  const doc = await adminDb.collection('deliveries').doc(deliveryId).get();
  if (!doc.exists) return null;
  const data: Raw = { ...(doc.data() as Raw), id: doc.id };
  const routeId = txt(data.route_id);
  let route: Raw | null = null;
  let routeDeliveries: Raw[] = [];
  if (routeId && validId(routeId)) {
    const [routeDoc, members] = await Promise.all([
      adminDb.collection('routes').doc(routeId).get(),
      adminDb.collection('deliveries').where('route_id', '==', routeId).limit(301).get(),
    ]);
    if (routeDoc.exists) route = { ...(routeDoc.data() as Raw), id: routeDoc.id };
    if (members.size <= 300) routeDeliveries = members.docs.map(d => ({...(d.data() as Raw), id:d.id}));
  }
  return { data, route, routeDeliveries };
}
function localEvent(kind: TrackingKind, at: string, source: 'dfl_site'|'dfl_entregas', srcId: string, actor: string | null) {
  return { kind, at, source, srcId, actor };
}
/** Only materialize evidence present in server-persisted snapshots, never infer undocumented times. */
export function confirmedEventCandidates(d: Raw, route: Raw | null, manualAcceptance?: Raw | null) {
  const result: ReturnType<typeof localEvent>[] = [];
  const created = iso(d.created_at) || iso(d.createdAt);
  if (created) result.push(localEvent('received', created, d.source_system === 'dfl_site'?'dfl_site':'dfl_entregas', `created-${txt(d.id)}`, null));
  if (d.source_system === 'dfl_site' && Array.isArray(d.site_order_timeline)) {
    for (const row of d.site_order_timeline.slice(0, 150)) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const value = row as Raw;
      const at = iso(value.occurred_at), kind = commercialState(value.status);
      const sourceId = txt(value.event_id);
      if (at && kind && sourceId && sourceId.length <= 180)
        result.push(localEvent(kind, at, 'dfl_site', `site-event-${sourceId}`, null));
    }
  }
  if (manualAcceptance?.accepted_at && d.source_system !== 'dfl_site') {
    const at = iso(manualAcceptance.accepted_at);
    if (at) result.push(localEvent('confirmed', at, 'dfl_entregas', `manual-${txt(manualAcceptance.idempotency_key)}`, txt(manualAcceptance.actor_uid) || null));
  }
  if (d.fulfillment_mode !== 'pickup' && txt(d.route_id) && route && txt(d.route_id) === txt(route.id)) {
    // A route link does not have an immutable assigned_at in legacy records.
    // Do NOT fabricate an 'assigned' event without that evidence.
    const assignedAt = iso(d.assigned_at);
    if (assignedAt) result.push(localEvent('assigned', assignedAt, 'dfl_entregas', `assigned-${txt(d.route_id)}-${assignedAt}`, txt(d.assigned_by_uid) || null));
    const startedAt = iso(route.started_at) || iso(route.departure_time);
    if (startedAt) result.push(localEvent('out_for_delivery', startedAt, 'dfl_entregas', `dispatch-${txt(route.id)}-${startedAt}`, txt(route.started_by_uid) || null));
    const reorderingAt = iso(d.order_reordered_at);
    if (reorderingAt) result.push(localEvent('reorganized', reorderingAt, 'dfl_entregas', `reorder-${reorderingAt}`, txt(d.order_reordered_by_uid) || null));
  }
  if (d.completed === true && iso(d.completed_at))
    result.push(localEvent('delivered', iso(d.completed_at)!, 'dfl_entregas', `completed-${txt(d.id)}-${iso(d.completed_at)}`, txt(d.completed_by_uid) || null));
  if (commercialState(d.site_order_status) === 'cancelled' && iso(d.site_order_status_updated_at))
    result.push(localEvent('cancelled', iso(d.site_order_status_updated_at)!, 'dfl_site', `cancelled-${txt(d.site_order_last_event_id)}`, null));
  return result.sort((a,b) => Date.parse(a.at) - Date.parse(b.at) || a.srcId.localeCompare(b.srcId));
}
function operationalEventFor(input: { tenant: string; key: string; event: TrackingEvent; sourceId: string; delivery: Raw; route: Raw | null }) {
  const map: Partial<Record<TrackingKind,string>> = {
    received:'order.received', scheduled:'order.scheduled', confirmed:'order.confirmed',
    preparing:'order.preparing', ready:'order.ready', assigned:'delivery.assigned',
    out_for_delivery:'delivery.out_for_delivery', reorganized:'route.reordered',
    delivered:'delivery.completed', cancelled:'order.cancelled',
  };
  const type=map[input.event.kind];
  if (!type) return null;
  const baseSource=hexSha256(input.sourceId).slice(0,36);
  let payload: Raw={};
  if (['order.received','order.preparing','order.ready'].includes(type)) payload={source_event_id:baseSource};
  if (type==='order.confirmed') payload={source_event_id:baseSource,
    confirmation_kind: input.event.source==='dfl_site'?'commercial_confirmed':'operator_confirmed'};
  if (type==='order.scheduled') {
    const scheduled=iso(input.delivery.scheduled_for);
    if (!scheduled) return null;
    payload={source_event_id:baseSource,scheduled_for:scheduled};
  }
  if (type==='delivery.assigned') payload={allocation_kind:'route_staging',dispatch_confirmed:false};
  if (type==='delivery.out_for_delivery') payload={start_evidence_at:input.event.at};
  if (type==='delivery.completed') payload={completion_evidence_at:input.event.at,outcome:'delivered'};
  if (type==='order.cancelled') payload={source_event_id:baseSource,cancellation_kind:'commercial'};
  if (type==='route.reordered') {
    const rev=input.route?.revision;
    if (typeof rev!=='number'||!Number.isInteger(rev)||rev<1) return null;
    payload={route_revision:rev};
  }
  const actor=input.event.actor_uid && /^[A-Za-z0-9._:/-]{1,128}$/.test(input.event.actor_uid)
    ? input.event.actor_uid : input.event.source==='dfl_site'?'dfl_site':'verified_server_snapshot';
  const routeId=txt(input.route?.id);
  return {
    contract:'dfl.operational_event',version:1,tenant_id:input.tenant,
    canonical_order_key:input.key,event_id:input.event.event_id,
    transition_id:`transition-${baseSource}`,event_type:type,
    revision:Math.max(1,input.event.revision),occurred_at:input.event.at,
    persisted_at:new Date().toISOString(),source_system:input.event.source,
    actor_id:actor,correlation_id:null,
    route_id:routeId && /^[A-Za-z0-9._:/-]{1,128}$/.test(routeId)?routeId:null,
    route_revision: typeof input.route?.revision==='number' && Number.isInteger(input.route.revision) && input.route.revision>0 ? input.route.revision:null,
    causal_event_id:null,payload,
  };
}

export async function reconcileConfirmedEvents(tenant: string, deliveryId: string) {
  const snap = await confirmedDelivery(deliveryId);
  if (!snap) return { found: false, added: 0, existing: 0 };
  const key = canonicalOrderKey(snap.data);
  if (!belongsToTenant(snap.data, tenant) || !key) return { found: false, added: 0, existing: 0 };
  const acceptanceDoc = await adminDb.collection('tracking_manual_acceptances_v1').doc(scopeId(tenant, key)).get();
  const candidates = confirmedEventCandidates(snap.data, snap.route, acceptanceDoc.data());
  const dryRun = await capabilities();
  const simulate = Boolean(dryRun && !dryRun.kill_switch && dryRun.tenant === tenant && dryRun.mode === 'DRY_RUN');
  let added = 0, existing = 0;
  let previous: string | null = null;
  for (const row of candidates) {
    const fingerprint = hexSha256(`${tenant}|${key}|${row.kind}|${row.srcId}|${row.at}`);
    const eventId = `trv1_${fingerprint.slice(0, 48)}`;
    const event: TrackingEvent = {
      id: eventId, event_id: eventId, kind: row.kind, at: row.at,
      actor_uid: row.actor, source: row.source,
      revision: Date.parse(row.at), causation_id: previous,
    };
    const ref = ledgerRef(tenant, key).collection('events').doc(fingerprint);
    const operational = operationalEventFor({tenant,key,event,sourceId:row.srcId,delivery:snap.data,route:snap.route});
    if (!operational) continue;
    try {
      await ref.create({ ...event, tenant_id: tenant, order_key: key, created_at: new Date().toISOString(), operational_event: operational }); added++;
      const eventSetting = row.kind==='assigned'?'allocation_notice':row.kind==='out_for_delivery'?'dispatch_notice':row.kind==='delivered'?'completion_notice':'';
      if (simulate && eventSetting && dryRun?.eligible_origins.includes(originOf(snap.data)) &&
        dryRun.event_modes[eventSetting] === 'DRY_RUN') {
        const kind = row.kind === 'assigned' ? 'allocation_information_v1' : row.kind === 'out_for_delivery' ? 'dispatch_information_v1' : 'completion_information_v1';
        const intentRef = adminDb.collection('tracking_dry_run_intents_v1').doc(fingerprint);
        await intentRef.create({ contract:'dfl.messaging.intent',version:1,tenant_id:tenant,order_key:key,
          source_event_id:eventId,template_id:kind,channel:'whatsapp',state:'dry_run',
          eligibility:{eligible:false,reason_code:'NOT_CERTIFIED'},occurred_at:row.at,
          created_at:new Date().toISOString() }).catch(e=>{
          const code=String((e as {code?:unknown})?.code||'');
          if (!/^(?:6|already-exists|ALREADY_EXISTS)$/.test(code)) throw e;
        });
      }
    }
    catch (err) {
      const code = String((err as {code?: unknown})?.code || '');
      if (code === '6' || code === 'already-exists' || code === 'ALREADY_EXISTS') existing++;
      else throw err;
    }
    previous = eventId;
  }
  return { found: true, added, existing, canonical_order_key: key };
}
async function loadedLedger(tenant: string, key: string): Promise<TrackingEvent[]> {
  const rows = await ledgerRef(tenant, key).collection('events').orderBy('at', 'desc').limit(100).get();
  return sortUniqueEvents(rows.docs.map(doc => doc.data() as TrackingEvent));
}
export async function publicForAuthorizedGrant(grant: Raw, c: CapabilityState): Promise<PublicProjection | null> {
  if (grant.tenant_id !== c.tenant || grant.status !== 'active') return null;
  const deliveryId = txt(grant.delivery_id);
  if (!validId(deliveryId)) return null;
  const snap = await confirmedDelivery(deliveryId);
  if (!snap) return null;
  const key = canonicalOrderKey(snap.data);
  if (!belongsToTenant(snap.data,c.tenant) || !key || key !== grant.order_key || !c.eligible_origins.includes(originOf(snap.data))) return null;
  const events = await loadedLedger(c.tenant, key);
  // If there is no confirmed audit evidence, deny rather than manufacture a public history.
  if (!events.length) return null;
  const serverTimestamps = [snap.data.completed_at, snap.data.site_order_last_event_at, snap.route?.started_at,
    snap.route?.updated_at, snap.data.order_updated_at, snap.data.created_at, snap.data.createdAt]
    .map(iso).filter((date): date is string => Boolean(date));
  if (!serverTimestamps.length) return null;
  const last = serverTimestamps.sort((a,b) => Date.parse(b)-Date.parse(a))[0];
  return projectPublicTracking({
    delivery: snap.data, route: snap.route, routeDeliveries: snap.routeDeliveries,
    ledgerEvents: events, confirmedAt: last,
    reconciling: snap.data.analytics_sync_pending === true || snap.data.operational_completion_pending_route === true,
    showCourier: c.show_courier, showPosition: c.show_position,
  });
}
export async function issueGrant(input: { tenant: string; deliveryId: string; actorUid: string; idempotencyKey: string; ttlMinutes: number; c: CapabilityState }) {
  const snap = await confirmedDelivery(input.deliveryId);
  if (!snap) return { state: 'invalid' as const };
  const key = canonicalOrderKey(snap.data);
  if (!belongsToTenant(snap.data,input.tenant) || !key || !input.c.eligible_origins.includes(originOf(snap.data)) ||
      !mayIssueNewTrackingGrant(snap.data)) return { state: 'invalid' as const };
  const id = grantDocId(input.tenant, key);
  const plain = randomSecret();
  const tokenHash = hexSha256(plain);
  const grant = grantRef(id), index = idxRef(plain);
  const result = await adminDb.runTransaction(async tx => {
    const existing = await tx.get(grant);
    const old = (existing.data() || {}) as Raw;
    if (old.status === 'active') return { state: 'already_active' as const };
    if (old.idempotency_key === input.idempotencyKey) return { state: 'already_processed' as const };
    const generation = Number.isInteger(old.generation) ? Number(old.generation) + 1 : 1;
    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000).toISOString();
    tx.set(grant, {
      tenant_id: input.tenant, order_key: key, delivery_id: input.deliveryId,
      generation, token_hash: tokenHash, status: 'active', exchange_policy: 'single_use_v1',
      idempotency_key: input.idempotencyKey, expires_at: expiresAt,
      actor_uid: input.actorUid, issued_at: new Date().toISOString(),
    });
    tx.create(index, { tenant_id: input.tenant, grant_id: id, token_hash: tokenHash,
      exchange_policy: 'single_use_v1', grant_generation: generation,
      expire_at: new Date(Date.now() + 24 * 60 * 60_000) });
    return { state: 'issued' as const, grant_id: id, expires_at: expiresAt, generation };
  });
  return result.state === 'issued' ? { ...result, token: plain } : result;
}
export async function revokeGrant(input: { tenant: string; grantId: string; actorUid: string; reason: string; idempotencyKey: string }) {
  if (!/^[a-f0-9]{64}$/.test(input.grantId)) return { state: 'invalid' as const };
  const ref = grantRef(input.grantId);
  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const old = (snap.data() || {}) as Raw;
    if (!snap.exists || old.tenant_id !== input.tenant) return { state: 'invalid' as const };
    if (old.status === 'revoked') return { state: 'revoked' as const, already_revoked: true, revoked_at: txt(old.revoked_at) };
    const revokedAt = new Date().toISOString();
    tx.update(ref, {
      status: 'revoked', revoked_at: revokedAt, revoked_by_uid: input.actorUid,
      revoke_reason: input.reason.slice(0, 160), revoke_idempotency_key: input.idempotencyKey,
      generation: Number(old.generation || 0) + 1,
    });
    return { state: 'revoked' as const, already_revoked: false, revoked_at: revokedAt };
  });
}
/** R255: one link can create one session only. Index consumption and session creation
 * are committed atomically; any transaction error fails closed without a session.
 * Grants from the previous protocol are deliberately ineligible: their usage
 * cannot be established with certainty, and customer access is still OFF.
 */
export async function exchangeToken(tenant: string, token: string) {
  if (!/^[a-zA-Z0-9_-]{40,100}$/.test(token)) return null;
  const hash = hexSha256(token);
  const indexRef = idxRef(token);
  const session = randomSecret();
  const sessionDoc = sessionRef(session);
  try {
    return await adminDb.runTransaction(async tx => {
      const index = await tx.get(indexRef);
      const raw = (index.data() || {}) as Raw;
      if (!index.exists || raw.tenant_id !== tenant || raw.token_hash !== hash ||
          raw.exchange_policy !== 'single_use_v1' ||
          Object.prototype.hasOwnProperty.call(raw, 'consumed_at')) return null;
      const grantId = txt(raw.grant_id);
      if (!/^[a-f0-9]{64}$/.test(grantId)) return null;
      const grant = await tx.get(grantRef(grantId));
      const data = (grant.data() || {}) as Raw;
      const now = Date.now();
      if (!grant.exists || data.status !== 'active' || data.tenant_id !== tenant ||
          data.exchange_policy !== 'single_use_v1' || data.token_hash !== hash ||
          !Number.isInteger(data.generation) || data.generation !== raw.grant_generation ||
          !iso(data.expires_at) || Date.parse(txt(data.expires_at)) <= now) return null;
      const expiresAt = new Date(Math.min(now + 30 * 60_000, Date.parse(txt(data.expires_at)))).toISOString();
      tx.update(indexRef, {consumed_at: new Date(now).toISOString()});
      tx.create(sessionDoc, {
        tenant_id: tenant, grant_id: grant.id, grant_generation: data.generation,
        expires_at: expiresAt, created_at: new Date(now).toISOString(),
        expire_at: new Date(now + 24 * 60 * 60_000),
      });
      return { session_token: session, expires_at: expiresAt };
    });
  } catch {
    // Firestore uncertainty must never yield a successful authorization.
    return null;
  }
}
export async function querySession(tenant: string, session: string, c: CapabilityState) {
  if (!/^[a-zA-Z0-9_-]{40,100}$/.test(session)) return null;
  const sessionDoc = await sessionRef(session).get();
  const data = (sessionDoc.data() || {}) as Raw;
  if (!sessionDoc.exists || data.tenant_id !== tenant || !iso(data.expires_at) ||
      Date.parse(txt(data.expires_at)) <= Date.now()) return null;
  const grantDoc = await grantRef(txt(data.grant_id)).get();
  const grant = (grantDoc.data() || {}) as Raw;
  if (!grantDoc.exists || grant.tenant_id !== tenant || grant.status !== 'active' ||
    grant.generation !== data.grant_generation || !iso(grant.expires_at) ||
    Date.parse(txt(grant.expires_at)) <= Date.now()) return null;
  return publicForAuthorizedGrant(grant, c);
}
export async function confirmInternalDelivery(input: {tenant:string; deliveryId:string; actorUid:string; idempotencyKey:string}) {
  const doc = await confirmedDelivery(input.deliveryId);
  if (!doc || doc.data.source_system === 'dfl_site' || doc.data.origin === 'ifood' || doc.data.origin === 'food99')
    return {state:'invalid' as const};
  const key = canonicalOrderKey(doc.data);
  if (!belongsToTenant(doc.data,input.tenant) || !key) return {state:'invalid' as const};
  const ref = adminDb.collection('tracking_manual_acceptances_v1').doc(scopeId(input.tenant, key));
  const result = await adminDb.runTransaction(async tx => {
    const prev = await tx.get(ref);
    const old = (prev.data() || {}) as Raw;
    if (prev.exists) return {state: old.idempotency_key === input.idempotencyKey ? 'already_processed' as const : 'already_confirmed' as const};
    const acceptedAt = new Date().toISOString();
    tx.create(ref, {tenant_id:input.tenant, order_key:key, delivery_id:input.deliveryId,
      accepted_at: acceptedAt, actor_uid:input.actorUid, idempotency_key:input.idempotencyKey});
    return {state:'confirmed' as const, accepted_at: acceptedAt};
  });
  if (result.state === 'confirmed') await reconcileConfirmedEvents(input.tenant,input.deliveryId);
  return result;
}
export async function hasCommercialAcceptance(tenant: string, d: Raw): Promise<boolean> {
  if (!belongsToTenant(d, tenant)) return false;
  if (d.source_system === 'dfl_site') {
    if (!Array.isArray(d.site_order_timeline)) return false;
    return d.site_order_timeline.some(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const value = row as Raw;
      return Boolean(iso(value.occurred_at) && txt(value.event_id) &&
        ['confirmed','preparing','ready'].includes(commercialState(value.status) || ''));
    });
  }
  const key = canonicalOrderKey(d);
  if (!key || d.origin === 'ifood' || d.origin === 'food99') return false;
  const snap = await adminDb.collection('tracking_manual_acceptances_v1').doc(scopeId(tenant,key)).get();
  return Boolean(snap.exists && snap.data()?.tenant_id === tenant && iso(snap.data()?.accepted_at));
}
export async function resolveCanonicalOrder(orderKey: string): Promise<string | null> {
  if (orderKey.startsWith('entregas:')) {
    const id = orderKey.slice('entregas:'.length);
    if (!validId(id)) return null;
    const snap = await confirmedDelivery(id);
    return snap && belongsToTenant(snap.data,trackingTenant() || '') && canonicalOrderKey(snap.data) === orderKey ? id : null;
  }
  if (orderKey.startsWith('site:')) {
    const id = orderKey.slice('site:'.length);
    if (!validId(id)) return null;
    const q = await adminDb.collection('deliveries').where('source_system', '==', 'dfl_site')
      .where('external_order_id', '==', id).limit(2).get();
    if (q.size !== 1) return null;
    const d: Raw = {...(q.docs[0].data() as Raw), id:q.docs[0].id};
    return belongsToTenant(d,trackingTenant() || '') && canonicalOrderKey(d) === orderKey ? q.docs[0].id : null;
  }
  return null;
}
