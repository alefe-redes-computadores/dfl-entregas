/** DFL R250 — evidence-only owner readiness. No side effects or PII. */
import { commercialState, iso, type Raw, type TrackingEvent, type PublicProjection, type TrackingStatus } from './core';

export type ReadinessLevel = 'ready_for_internal_review' | 'needs_attention' | 'blocked';
export type ReadinessSignal = { code: string; severity: 'info' | 'warning' | 'blocker'; label: string };
export type TrackingInspection = {
  contract: 'dfl.tracking.admin.inspection';
  version: 1;
  delivery: {
    canonical_order_key: string;
    public_label: string;
    origin: 'site' | 'manual' | 'ifood' | 'food99';
    state: TrackingStatus;
    fulfillment: 'delivery' | 'pickup' | 'counter' | 'external_delivery';
  };
  readiness: { level: ReadinessLevel; signals: ReadinessSignal[]; source: 'confirmed_server_snapshot'; last_confirmed_at: string | null };
  gate: { code_enabled: boolean; customer_access_certified: boolean; mode: string; kill_switch: boolean; public_tracking: boolean; origin_eligible: boolean; site_connected: false; real_notifications: false };
  public_projection: PublicProjection | null;
  events: Array<{id: string; kind: string; at: string; source: string}>;
};
const str = (v: unknown, length = 90) => typeof v === 'string' ? v.trim().slice(0,length) : '';
export function readinessOrigin(d: Raw): TrackingInspection['delivery']['origin'] {
  return d.source_system === 'dfl_site' ? 'site' : d.origin === 'ifood' ? 'ifood' : d.origin === 'food99' ? 'food99' : 'manual';
}
export function readinessStatus(d: Raw, route: Raw | null, accepted: boolean): TrackingStatus {
  if (commercialState(d.site_order_status) === 'cancelled' || d.operational_dismissed_at != null) return 'cancelled';
  if (d.completed === true && iso(d.completed_at)) return 'delivered';
  if (Array.isArray(d.delivery_attempts) && d.delivery_attempts.length && d.completed !== true) return 'delivery_issue';
  if (route && d.route_id === route.id && (iso(route.started_at) || iso(route.departure_time))) return 'out_for_delivery';
  if (route && d.route_id === route.id) return 'assigned';
  const commercial = commercialState(d.site_order_status);
  if (commercial) return commercial;
  return accepted ? 'confirmed' : d.scheduled_for ? 'scheduled' : 'received';
}
export function inspectReadiness(input: {
  delivery: Raw; route: Raw | null; canonicalKey: string; accepted: boolean;
  tenantValid: boolean; events: TrackingEvent[]; projection: PublicProjection | null;
  codeEnabled: boolean; customerCertified: boolean; capability: {
    mode: string; kill_switch: boolean; public_tracking: boolean; origin_eligible: boolean;
  } | null;
}): TrackingInspection {
  const { delivery:d, route, events, projection } = input;
  const origin = readinessOrigin(d);
  const state = readinessStatus(d, route, input.accepted);
  const signals: ReadinessSignal[] = [];
  const add = (code: string, severity: ReadinessSignal['severity'], label: string) => signals.push({code,severity,label});
  if (!input.tenantValid) add('TENANT_NOT_CONFIRMED','blocker','Empresa do pedido não confirmada no servidor');
  if (!input.accepted) add('NOT_ACCEPTED','blocker','Aceite comercial ou operacional ainda não comprovado');
  if (state === 'cancelled') add('CANCELLED','blocker','Pedido cancelado: acompanhamento não pode ser emitido');
  if (d.completed === true && !iso(d.completed_at)) add('COMPLETION_UNVERIFIED','warning','Conclusão sem horário comprovável');
  if (d.route_id && !route) add('MISSING_ROUTE','warning','Rota informada, mas não confirmada no servidor');
  if (route && !iso(route.started_at) && !iso(route.departure_time)) add('NOT_DISPATCHED','info','Rota alocada, ainda sem despacho confirmado');
  if (!events.length) add('NO_LEDGER','warning','Histórico confirmado do acompanhamento ainda não materializado');
  if (!projection) add('NO_PROJECTION','warning','Projeção pública ainda não certificada para este pedido');
  if (projection && projection.freshness !== 'fresh') add('STALE_PROJECTION','warning','Dados desatualizados ou aguardando reconciliação');
  if (!input.codeEnabled || !input.capability || input.capability.mode === 'OFF' || input.capability.kill_switch)
    add('FEATURE_OFF','info','Novo acompanhamento permanece desligado por padrão');
  if (!input.customerCertified) add('CUSTOMER_OFF','info','Acesso público e mensagens reais não certificados');
  if (origin === 'ifood' || origin === 'food99') add('MARKETPLACE_POLICY','blocker','Compartilhamento de marketplace depende de autorização específica');
  if (input.capability && !input.capability.origin_eligible) add('ORIGIN_DISABLED','blocker','Origem não autorizada nas configurações');
  const hasBlocker = signals.some(signal=>signal.severity==='blocker');
  const hasWarning = signals.some(signal=>signal.severity==='warning');
  const lastConfirmed = [iso(d.completed_at),iso(d.site_order_last_event_at),iso(d.created_at),iso(d.createdAt),iso(route?.started_at),iso(route?.updated_at),...events.map(e=>iso(e.at))]
    .filter((v):v is string=>Boolean(v)).sort().at(-1) || null;
  const fulfillment: TrackingInspection['delivery']['fulfillment'] = d.fulfillment_mode === 'pickup' || d.fulfillment_mode === 'counter' || d.fulfillment_mode === 'external_delivery' ? d.fulfillment_mode : 'delivery';
  return {
    contract:'dfl.tracking.admin.inspection',version:1,
    delivery:{canonical_order_key:input.canonicalKey,public_label:str(d.order_id || d.external_order_id || d.id,50),origin,state,fulfillment},
    readiness:{level:hasBlocker?'blocked':hasWarning?'needs_attention':'ready_for_internal_review',signals,source:'confirmed_server_snapshot',last_confirmed_at:lastConfirmed},
    gate:{code_enabled:input.codeEnabled,customer_access_certified:input.customerCertified,mode:input.capability?.mode||'OFF',
      kill_switch:input.capability?.kill_switch!==false,public_tracking:input.capability?.public_tracking===true,
      origin_eligible:input.capability?.origin_eligible===true,site_connected:false,real_notifications:false},
    public_projection:projection,
    events:events.slice(-30).map(e=>({id:e.id,kind:e.kind,at:e.at,source:e.source})),
  };
}

export function inspectionPublicCopy(inspection: TrackingInspection): string {
  const projection = inspection.public_projection;
  if (!projection) return JSON.stringify({contract:'dfl.tracking.public',version:1,status:'unavailable',reason:'NO_CERTIFIED_PROJECTION'},null,2);
  return JSON.stringify(projection,null,2);
}
