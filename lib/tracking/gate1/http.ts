import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { authorizedOwner, trackingCodeEnabled, trackingCustomerEnabled, trackingTenant,
  verifyTrackingSiteRequest, allowTokenExchangeAttempt, allowTrackingStatusAttempt } from './security';
import { capabilities, canAccessCustomer, confirmedDelivery, issueGrant, revokeGrant,
  exchangeToken, querySession, resolveCanonicalOrder, reconcileConfirmedEvents, confirmInternalDelivery, hasCommercialAcceptance } from './storage';
import { canonicalOrderKey, validatePublicProjection, validateStrictPublicProjection } from './core';

const json = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { 'cache-control':'no-store, max-age=0', pragma:'no-cache',
    'referrer-policy':'no-referrer','x-content-type-options':'nosniff' },
});
const err = (status=404) => json({error:{code:'TRACKING_UNAVAILABLE',message:'Não foi possível acessar o acompanhamento. Confira o link ou tente mais tarde.'}},status);
const good = (v: unknown) => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const idempotency = (v: unknown) => typeof v === 'string' && v.length >= 16 && v.length <= 96 && /^[A-Za-z0-9_-]+$/.test(v);
const validEnvelope = (v: Record<string,unknown>, action: string) =>
  v.contract === 'dfl.tracking.access' && v.version === 1 && v.action === action;
const exact = (v: Record<string,unknown>, allowed: readonly string[], required = allowed) =>
  Object.keys(v).every(key => allowed.includes(key)) && required.every(key => Object.prototype.hasOwnProperty.call(v,key));
async function body(req: NextRequest) {
  const raw = await req.text();
  if (raw.length < 2 || raw.length > 8192) return null;
  try { const parsed: unknown = JSON.parse(raw); return good(parsed) ? {raw, data: parsed as Record<string,unknown>} : null; }
  catch { return null; }
}
async function ownerContext(req: NextRequest) {
  if (!trackingCodeEnabled() || !trackingTenant()) return null;
  const uid = await authorizedOwner(req);
  const c = uid ? await capabilities() : null;
  return uid && c ? {uid, c} : null;
}
async function siteContext(req: NextRequest, raw: string) {
  if (!trackingCustomerEnabled()) return {state: 'off' as const};
  const verified = await verifyTrackingSiteRequest(req,raw);
  if (verified !== 'ok') return {state:verified};
  const c = await capabilities();
  if (!canAccessCustomer(c)) return {state:'off' as const};
  return {state:'ok' as const, c:c!};
}
export async function issue(req: NextRequest) {
  try {
    const ctx = await ownerContext(req);
    if (!ctx || !canAccessCustomer(ctx.c)) return err(403);
    const packet = await body(req);
    const v = packet?.data;
    if (!v || !validEnvelope(v,'issue') || !exact(v,['contract','version','action','order','idempotency_key','requested_ttl_minutes']) ||
      !good(v.order) || !idempotency(v.idempotency_key) ||
      !Number.isInteger(v.requested_ttl_minutes) || Number(v.requested_ttl_minutes) < 5 || Number(v.requested_ttl_minutes) > 1440) return err(422);
    const order = v.order as Record<string,unknown>;
    if (!exact(order,['canonical_order_key','origin']) || !['site','whatsapp','manual','ifood','food99','other'].includes(String(order.origin)) ||
      typeof order.canonical_order_key !== 'string' || !/^(?:site|entregas):[A-Za-z0-9._-]{1,120}$/.test(order.canonical_order_key)) return err(422);
    const deliveryId = await resolveCanonicalOrder(order.canonical_order_key);
    if (!deliveryId) return err();
    const snap = await confirmedDelivery(deliveryId);
    if (!snap || canonicalOrderKey(snap.data) !== order.canonical_order_key ||
      (order.origin !== (snap.data.source_system === 'dfl_site' ? 'site' : snap.data.origin === 'ifood' ? 'ifood' : snap.data.origin === 'food99' ? 'food99' : 'manual')) ||
      !(await hasCommercialAcceptance(ctx.c.tenant,snap.data))) return err();
    // Materialize only evidence persisted by the existing operational source.
    await reconcileConfirmedEvents(ctx.c.tenant,deliveryId);
    const issued = await issueGrant({tenant:ctx.c.tenant,deliveryId,actorUid:ctx.uid,
      idempotencyKey:v.idempotency_key as string,ttlMinutes:Number(v.requested_ttl_minutes),c:ctx.c});
    if (issued.state === 'issued') return json({contract:'dfl.tracking.access',version:1,
      grant_id:issued.grant_id,opaque_token:issued.token,expires_at:issued.expires_at,status:'issued'},201);
    if (issued.state === 'already_active' || issued.state === 'already_processed') return err(409);
    return err();
  } catch { return err(503); }
}
export async function revoke(req: NextRequest) {
  try {
    const ctx = await ownerContext(req);
    if (!ctx) return err(403);
    const p = await body(req); const v = p?.data;
    if (!v || !validEnvelope(v,'revoke') || !exact(v,['contract','version','action','grant_id','reason','idempotency_key']) ||
      !idempotency(v.idempotency_key) ||
      typeof v.grant_id !== 'string' || !/^[a-f0-9]{64}$/.test(v.grant_id) ||
      typeof v.reason !== 'string' || !['admin_action','security_incident','order_cancelled','customer_request','policy_change'].includes(v.reason)) return err(422);
    const out = await revokeGrant({tenant:ctx.c.tenant,grantId:v.grant_id as string,
      actorUid:ctx.uid,reason:v.reason as string,idempotencyKey:v.idempotency_key as string});
    return out.state === 'revoked' ? json({contract:'dfl.tracking.access',version:1,
      grant_id:v.grant_id,revoked:true,revoked_at:out.revoked_at}) : err();
  } catch { return err(503); }
}
export async function authorize(req: NextRequest) {
  try {
    const p = await body(req); if (!p || !validEnvelope(p.data,'exchange') ||
      !exact(p.data,['contract','version','action','opaque_token']) ||
      typeof p.data.opaque_token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(p.data.opaque_token)) return err(422);
    const ctx = await siteContext(req,p.raw);
    if (ctx.state !== 'ok') return err(ctx.state === 'invalid'?401:ctx.state === 'replay'?409:503);
    if (!(await allowTokenExchangeAttempt(req))) return err(429);
    const session = await exchangeToken(ctx.c.tenant,p.data.opaque_token);
    return session ? json({contract:'dfl.tracking.access',version:1,authorized:true,
      scope_handle:session.session_token,scope_expires_at:session.expires_at}) : err();
  } catch { return err(503); }
}
export async function status(req: NextRequest) {
  try {
    const p = await body(req);
    if (!p || !validEnvelope(p.data,'status') || !exact(p.data,['contract','version','action','scope_handle']) ||
      typeof p.data.scope_handle !== 'string' || !/^[A-Za-z0-9_-]{22,128}$/.test(p.data.scope_handle)) return err(422);
    const ctx = await siteContext(req,p.raw);
    if (ctx.state !== 'ok') return err(ctx.state === 'invalid'?401:ctx.state === 'replay'?409:503);
    if (!(await allowTrackingStatusAttempt(p.data.scope_handle))) return err(429);
    const projection = await querySession(ctx.c.tenant,p.data.scope_handle,ctx.c);
    if (!projection || !validateStrictPublicProjection(projection)) return err();
    return json(projection);
  } catch { return err(503); }
}
/** Owner-only, explicit bounded reconciliation. Not an always-on scanner. */
export async function sync(req: NextRequest) {
  try {
    const ctx = await ownerContext(req);
    if (!ctx || ctx.c.kill_switch || ctx.c.mode === 'OFF') return err(403);
    const p = await body(req); const v = p?.data;
    if (!v || v.contract !== 'dfl.tracking.sync' || v.version !== 1 ||
      typeof v.delivery_id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(v.delivery_id)) return err(422);
    const result = await reconcileConfirmedEvents(ctx.c.tenant,v.delivery_id);
    return result.found ? json({ok:true,added:result.added,existing:result.existing}) : err();
  } catch { return err(503); }
}
/** Manual confirmation is a server-persisted fact, not a front-end status flip. */
export async function confirm(req: NextRequest) {
  try {
    const ctx = await ownerContext(req);
    if (!ctx || ctx.c.kill_switch || ctx.c.mode === 'OFF') return err(403);
    const p = await body(req); const v = p?.data;
    if (!v || v.contract !== 'dfl.tracking.confirm' || v.version !== 1 ||
      typeof v.delivery_id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(v.delivery_id) ||
      !idempotency(v.idempotency_key)) return err(422);
    const output = await confirmInternalDelivery({tenant:ctx.c.tenant,deliveryId:v.delivery_id,
      actorUid:ctx.uid,idempotencyKey:v.idempotency_key as string});
    return output.state === 'invalid' ? err() : json({ok:true,result:output.state},output.state==='confirmed'?201:200);
  } catch { return err(503); }
}
