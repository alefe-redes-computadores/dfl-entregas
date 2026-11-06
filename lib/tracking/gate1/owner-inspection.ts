/** R250 private owner-only read-path. No writes, no access grants, no messaging. */
import 'server-only';
import { createHash } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { confirmedDelivery, capabilities, belongsToTenant, hasCommercialAcceptance } from './storage';
import { canonicalOrderKey, projectPublicTracking, sortUniqueEvents, type TrackingEvent, type PublicProjection, iso } from './core';
import { inspectReadiness, type TrackingInspection } from './readiness';
import { trackingCodeEnabled, trackingCustomerEnabled, trackingTenant } from './security';

const idOk = (id: string) => /^[A-Za-z0-9_-]{1,120}$/.test(id);
export async function inspectConfirmedOwnerDelivery(deliveryId: string): Promise<TrackingInspection | null> {
  if (!idOk(deliveryId)) return null;
  const tenant = trackingTenant();
  // No tenant binding means no access through Admin SDK, even for an owner.
  if (!tenant) return null;
  const snap = await confirmedDelivery(deliveryId);
  if (!snap || !belongsToTenant(snap.data,tenant)) return null;
  const key = canonicalOrderKey(snap.data);
  if (!key) return null;
  const company = await capabilities();
  const accepted = await hasCommercialAcceptance(tenant,snap.data);
  const docId = createHash('sha256').update(`${tenant}|${key}`,'utf8').digest('hex');
  const history = await adminDb.collection('tracking_event_ledgers_v1').doc(docId).collection('events')
    .orderBy('at','desc').limit(60).get();
  const events = sortUniqueEvents(history.docs.map(doc=>doc.data() as TrackingEvent));
  const lastConfirmed = [snap.data.completed_at,snap.data.site_order_last_event_at,snap.data.created_at,snap.data.createdAt,snap.route?.started_at,snap.route?.updated_at]
    .map(iso).filter((v):v is string=>Boolean(v)).sort().at(-1) || null;
  const origin = snap.data.source_system==='dfl_site'?'dfl_site':snap.data.origin==='ifood'?'ifood':snap.data.origin==='food99'?'food99':'manual';
  // Only real persisted ledger can generate the public shape. No synthetic events.
  let projection: PublicProjection | null = null;
  if (events.length && lastConfirmed) {
    try {
      projection = projectPublicTracking({delivery:snap.data,route:snap.route,
        routeDeliveries:snap.routeDeliveries, ledgerEvents:events,
        confirmedAt:lastConfirmed,showCourier:company?.show_courier === true,
        showPosition:company?.show_position === true,
        reconciling:snap.data.analytics_sync_pending===true || snap.data.operational_completion_pending_route===true});
    } catch { projection=null; }
  }
  return inspectReadiness({delivery:snap.data,route:snap.route,canonicalKey:key,accepted,tenantValid:true,
    events,projection,codeEnabled:trackingCodeEnabled(),customerCertified:trackingCustomerEnabled(),
    capability:company?{mode:company.mode,kill_switch:company.kill_switch,public_tracking:company.public_tracking,issue_tracking_link:company.issue_tracking_link,
      origin_eligible:company.eligible_origins.includes(origin)}:null});
}
