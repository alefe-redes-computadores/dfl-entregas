import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';

export function hexSha256(value: string) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
export function randomSecret() { return randomBytes(32).toString('base64url'); }
const safe = (a: string, b: string) => {
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
};
export function signedPayload(method: string, path: string, body: string, timestamp: string, nonce: string, kid: string, tenant: string) {
  return [method.toUpperCase(), path, hexSha256(body), timestamp, nonce, kid, tenant].join('\n');
}
export function signTrackingRequest(input: { method: string; path: string; body: string; timestamp: string; nonce: string; kid: string; tenant: string; secret: string }) {
  return createHmac('sha256', input.secret).update(signedPayload(input.method, input.path, input.body, input.timestamp, input.nonce, input.kid, input.tenant)).digest('hex');
}
export function trackingTenant(): string | null {
  const tenant = process.env.DFL_TRACKING_TENANT_ID?.trim() || '';
  return /^[A-Za-z0-9_-]{4,64}$/.test(tenant) ? tenant : null;
}
export function trackingCodeEnabled() { return process.env.DFL_TRACKING_GATE1_ACTIVE === '1'; }
export function trackingCustomerEnabled() {
  return trackingCodeEnabled() && process.env.DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED === '1';
}
export async function authorizedOwner(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 8192) return null;
  try {
    const user = await adminAuth.verifyIdToken(auth.slice(7), true);
    // R256: separate one-off owner in the reused TEST Firebase only.
    // The operational superadmin remains unchanged. This file is deployed
    // ONLY on the homologation branch, never merged into the commercial main.
    let testOwner = false;
    const expected = process.env.DFL_TRACKING_HML_OWNER_UID || '';
    if (process.env.DFL_TRACKING_HML_OWNER_OPT_IN === '1' &&
        process.env.DFL_TRACKING_TENANT_ID === 'DFL_HML_A' &&
        /^[A-Za-z0-9_-]{6,128}$/.test(expected) && user.uid === expected) {
      try {
        const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}') as Record<string,unknown>;
        testOwner = account.project_id === 'dfl-finance';
      } catch { testOwner = false; }
    }
    return isSuperadminUid(user.uid) || testOwner ? user.uid : null;
  } catch { return null; }
}
function keys() {
  const raw = process.env.DFL_TRACKING_S2S_KEYS_JSON;
  if (!raw || raw.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const parsed = value as Record<string, unknown>;
    const list = Object.entries(parsed);
    if (list.length < 1 || list.length > 4 || list.some(([key, val]) =>
      !/^[A-Za-z0-9_-]{3,24}$/.test(key) || typeof val !== 'string' || val.length < 32 || val.length > 512)) return null;
    return parsed as Record<string, string>;
  } catch { return null; }
}
export type TrackingAuthResult = 'ok' | 'invalid' | 'replay' | 'not_ready';
export async function verifyTrackingSiteRequest(request: NextRequest, rawBody: string): Promise<TrackingAuthResult> {
  if (!trackingCustomerEnabled()) return 'not_ready';
  return verifySignedTrackingRequest(request,rawBody);
}
/** R254: separately gated internal S2S probe; never enables customers. */
export async function verifyTrackingBridgeRequest(request: NextRequest, rawBody: string): Promise<TrackingAuthResult> {
  if (!trackingCodeEnabled() || process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED !== '1') return 'not_ready';
  return verifySignedTrackingRequest(request,rawBody);
}
/** Both routes share the exact same signature, timestamp and nonce-replay policy. */
async function verifySignedTrackingRequest(request: NextRequest,rawBody: string): Promise<TrackingAuthResult> {
  const tenant = trackingTenant(), configured = keys();
  if (!tenant || !configured) return 'not_ready';
  const timestamp = request.headers.get('x-dfl-tracking-timestamp') || '';
  const nonce = request.headers.get('x-dfl-tracking-nonce') || '';
  const kid = request.headers.get('x-dfl-tracking-kid') || '';
  const signature = request.headers.get('x-dfl-tracking-signature') || '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(timestamp) || !/^[a-zA-Z0-9_-]{20,90}$/.test(nonce) ||
      !/^[a-f0-9]{64}$/.test(signature) || !Object.prototype.hasOwnProperty.call(configured,kid) ||
      !Number.isFinite(Date.parse(timestamp)) ||
      Math.abs(Date.now() - Date.parse(timestamp)) > 120_000) return 'invalid';
  const valid = signTrackingRequest({
    method: request.method, path: request.nextUrl.pathname, body: rawBody,
    timestamp, nonce, kid, tenant, secret: configured[kid],
  });
  if (!safe(signature, valid)) return 'invalid';
  // Server-side idempotency / replay guard. Durable, globally shared across instances.
  const id = hexSha256(`${tenant}:${kid}:${nonce}`);
  try {
    await adminDb.collection('tracking_replay_nonces_v1').doc(id).create({
      tenant_id: tenant, created_at: new Date().toISOString(),
      expire_at: new Date(Date.now() + 24 * 60 * 60_000),
    });
    return 'ok';
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || '');
    return /6|already-exists|ALREADY_EXISTS/.test(code) ? 'replay' : 'not_ready';
  }
}
/** Signed response proof: no secret is returned or stored. Fail closed unless bridge flag is enabled. */
export function signTrackingBridgeProof(input:{challengeHash:string;nonce:string;serverTime:string;kid:string}):string|null {
  if (!trackingCodeEnabled() || process.env.DFL_TRACKING_BRIDGE_PROBE_CERTIFIED !== '1') return null;
  const tenant=trackingTenant(),configured=keys();
  if(!tenant||!configured||!Object.prototype.hasOwnProperty.call(configured,input.kid)||
     !/^[a-f0-9]{64}$/.test(input.challengeHash)||
     !/^[A-Za-z0-9_-]{20,90}$/.test(input.nonce)||
     !Number.isFinite(Date.parse(input.serverTime)))return null;
  const material=['DFL_TRACKING_BRIDGE_PROOF_V1','/api/integration/tracking/v1/bridge',
    input.challengeHash,input.nonce,input.serverTime,tenant,input.kid].join('\n');
  return createHmac('sha256',configured[input.kid]).update(material).digest('hex');
}
export async function allowTokenExchangeAttempt(request: NextRequest): Promise<boolean> {
  const tenant = trackingTenant();
  if (!tenant) return false;
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim().slice(0, 64) || 'unknown';
  const slot = Math.floor(Date.now() / 600_000);
  const id = hexSha256(`${tenant}|exchange|${ip}|${slot}`);
  const ref = adminDb.collection('tracking_rate_limits_v1').doc(id);
  try {
    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const prior = Number(snap.data()?.count || 0);
      if (prior >= 30) return false;
      tx.set(ref, { tenant_id: tenant, count: prior + 1, expire_at: new Date(Date.now() + 86_400_000) }, { merge: true });
      return true;
    });
  } catch { return false; }
}
export async function allowTrackingStatusAttempt(scopeHandle: string): Promise<boolean> {
  const tenant = trackingTenant();
  if (!tenant || !/^[A-Za-z0-9_-]{22,128}$/.test(scopeHandle)) return false;
  const slot = Math.floor(Date.now() / 600_000);
  const id = hexSha256(`${tenant}|status|${hexSha256(scopeHandle)}|${slot}`);
  const ref = adminDb.collection('tracking_rate_limits_v1').doc(id);
  try {
    return await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const prior = Number(snap.data()?.count || 0);
      if (prior >= 120) return false;
      tx.set(ref, { tenant_id:tenant,count:prior+1,expire_at:new Date(Date.now()+86_400_000) },{merge:true});
      return true;
    });
  } catch { return false; }
}
