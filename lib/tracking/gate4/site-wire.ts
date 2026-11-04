/** Gate4 server-to-server reference wire protocol. Pure builders: NO network and NO credentials stored. */
import 'server-only';
import { randomBytes, createHmac, createHash } from 'node:crypto';

export const SITE_TRACKING_PATHS = {
  exchange: '/api/integration/tracking/v1/authorize',
  status: '/api/integration/tracking/v1/status',
} as const;
export type SiteTrackingAction = keyof typeof SITE_TRACKING_PATHS;
export type SiteWireRequest = {
  path: string;
  method: 'POST';
  body: string;
  headers: Record<string,string>;
};
export type WireOptions = {
  action: SiteTrackingAction;
  credential: string;
  tenant: string;
  keyId: string;
  signingSecret: string;
  timestamp?: string;
  nonce?: string;
};
const id = /^[A-Za-z0-9_-]{4,64}$/;
const kidPattern = /^[A-Za-z0-9_-]{3,24}$/;
const opaque = /^[A-Za-z0-9_-]{43}$/;
const scope = /^[A-Za-z0-9_-]{22,128}$/;
const noncePattern = /^[A-Za-z0-9_-]{20,90}$/;
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Never include tokens in URL/query/header/log. They are confined to signed request body. */
export function buildSiteTrackingWire(input: WireOptions): SiteWireRequest {
  if (!id.test(input.tenant) || !kidPattern.test(input.keyId) ||
      input.signingSecret.length < 32 || input.signingSecret.length > 512) throw Error('Invalid S2S configuration');
  if (!((input.action === 'exchange' && opaque.test(input.credential)) ||
        (input.action === 'status' && scope.test(input.credential)))) throw Error('Invalid S2S credential shape');
  const path = SITE_TRACKING_PATHS[input.action];
  const timestamp = input.timestamp ?? new Date().toISOString();
  const nonce = input.nonce ?? randomBytes(24).toString('base64url');
  if (!utcPattern.test(timestamp) || !Number.isFinite(Date.parse(timestamp)) || !noncePattern.test(nonce)) throw Error('Invalid S2S clock/nonce');
  const body = JSON.stringify(input.action === 'exchange'
    ? {contract:'dfl.tracking.access',version:1,action:'exchange',opaque_token:input.credential}
    : {contract:'dfl.tracking.access',version:1,action:'status',scope_handle:input.credential});
  const digest = createHash('sha256').update(body,'utf8').digest('hex');
  const signed = ['POST',path,digest,timestamp,nonce,input.keyId,input.tenant].join('\n');
  const signature = createHmac('sha256',input.signingSecret).update(signed).digest('hex');
  return {
    path,method:'POST',body,
    headers:{
      'content-type':'application/json',
      'x-dfl-tracking-timestamp':timestamp,
      'x-dfl-tracking-nonce':nonce,
      'x-dfl-tracking-kid':input.keyId,
      'x-dfl-tracking-signature':signature,
    },
  };
}

/** Transport options for the Site backend; never browser-side. */
export function siteTrackingFetchPolicy() {
  return {method:'POST' as const,cache:'no-store' as const,redirect:'error' as const,credentials:'omit' as const};
}
