/** Strict Site consumption gate for a successful tracking status response. */
import type { PublicProjection } from '../gate1/core';
import { validateStrictPublicProjection } from '../gate1/core';

export type StatusTransportResult =
  | {state:'ok';projection:PublicProjection}
  | {state:'unavailable';reason:'unauthorized'|'invalid_session'|'rate_limited'|'service_error'|'invalid_payload'};

/** The Site must not display stale cached data after any authorization failure. */
export function parseSiteStatusResponse(status:number, payload:unknown):StatusTransportResult {
  if(status===200){
    return validateStrictPublicProjection(payload)
      ?{state:'ok',projection:payload as PublicProjection}
      :{state:'unavailable',reason:'invalid_payload'};
  }
  if(status===401||status===403)return{state:'unavailable',reason:'unauthorized'};
  if(status===404)return{state:'unavailable',reason:'invalid_session'};
  if(status===429)return{state:'unavailable',reason:'rate_limited'};
  return{state:'unavailable',reason:'service_error'};
}
/** For Site UI: no outcome here authorizes showing previously obtained tracking data. */
export function siteMustClearDisplayedTracking(result:StatusTransportResult): boolean {
  return result.state!=='ok';
}
export function isValidExchangeResponse(payload:unknown): payload is {
  contract:'dfl.tracking.access';version:1;authorized:true;scope_handle:string;scope_expires_at:string;
} {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return false;
  const r=payload as Record<string,unknown>;
  if(Object.keys(r).length!==5||r.contract!=='dfl.tracking.access'||r.version!==1||r.authorized!==true)return false;
  if(typeof r.scope_handle!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(r.scope_handle))return false;
  if(typeof r.scope_expires_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.scope_expires_at))return false;
  const expiry=Date.parse(r.scope_expires_at);
  return Number.isFinite(expiry) && expiry>Date.now() && expiry<=Date.now()+31*60_000;
}
