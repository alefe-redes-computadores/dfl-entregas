/**
 * DFL Gate 1 — pure, side-effect-free tracking policy.
 * Only CONFIRMED server snapshots may be passed by the server adapter.
 * No client/SDK/service credentials in this module.
 */
export const TRACKING_PUBLIC_CONTRACT = 'dfl.tracking.public' as const;
export const TRACKING_PUBLIC_VERSION = 1 as const;
export const TRACKING_MODES = ['OFF', 'DRY_RUN', 'MANUAL', 'AUTOMATIC_CERTIFIED'] as const;
export type TrackingMode = typeof TRACKING_MODES[number];
export type TrackingKind = 'received' | 'scheduled' | 'confirmed' | 'preparing' | 'ready' | 'assigned' |
  'out_for_delivery' | 'reorganized' | 'next_stop' | 'delivered' | 'delivery_issue' | 'cancelled';
export type TrackingStatus = Exclude<TrackingKind, 'reorganized'>;
export type Raw = Record<string, unknown>;
export interface TrackingEvent {
  id: string;
  event_id: string;
  kind: TrackingKind;
  at: string;
  actor_uid: string | null;
  source: 'dfl_site' | 'dfl_entregas';
  revision: number;
  causation_id: string | null;
}
export interface PublicProjection {
  contract: typeof TRACKING_PUBLIC_CONTRACT;
  version: typeof TRACKING_PUBLIC_VERSION;
  order: { label: string; origin_label: string; fulfillment: 'delivery' | 'pickup' };
  status: TrackingStatus;
  as_of: string;
  freshness: 'fresh' | 'stale' | 'reconciling' | 'unknown';
  timeline: Array<{ id: string; kind: TrackingKind; title: string; at: string }>;
  progress: null | {
    status: 'verified';
    current_stop_number: number | null;
    planned_customer_stop_number: number | null;
    total_physical_stops: number;
    stops_ahead: number | null;
    is_next_stop: boolean;
  };
  courier: { first_name: string } | null;
  terminal: boolean;
}
const TITLES: Record<TrackingKind, string> = {
  received: 'Pedido recebido', scheduled: 'Pedido agendado', confirmed: 'Pedido confirmado',
  preparing: 'Em preparação', ready: 'Pedido pronto', assigned: 'Organizado para entrega',
  out_for_delivery: 'Saiu para entrega', reorganized: 'Rota reorganizada',
  next_stop: 'Próxima parada', delivered: 'Pedido entregue',
  delivery_issue: 'Intercorrência na entrega', cancelled: 'Pedido cancelado',
};
export const EVENT_KINDS: readonly TrackingKind[] = Object.keys(TITLES) as TrackingKind[];
const text = (v: unknown, n = 128) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function iso(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < 20 || v.length > 40 || !/^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))$/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function canonicalOrderKey(d: Raw): string | null {
  const source = text(d.source_system);
  if (source === 'dfl_site') {
    const id = text(d.external_order_id);
    return id && id.length <= 120 ? `site:${id}` : null;
  }
  const id = text(d.id);
  return id && id.length <= 120 ? `entregas:${id}` : null;
}
export function commercialState(v: unknown): TrackingStatus | null {
  const s = text(v, 60).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  if (['pendente', 'recebido'].includes(s)) return 'received';
  if (s === 'agendado') return 'scheduled';
  if (['confirmado','confirmada','aceito','aceita','aprovado','aprovada'].includes(s)) return 'confirmed';
  if (['em_producao','em_preparo','em_preparacao','preparando','preparacao'].includes(s)) return 'preparing';
  if (['pronto','pronta'].includes(s)) return 'ready';
  if (s.includes('cancel')) return 'cancelled';
  // Commercial 'saiu para entrega' / 'finalizado' is not evidence of dispatch/completion.
  return null;
}
export function stopGroupKey(d: Raw): string {
  const dedicated = text(d.stop_group_id);
  if (dedicated) return `g:${dedicated}`;
  const address = text(d.address_string, 512).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return address ? `a:${address}` : `d:${text(d.id)}`;
}
function isCancelled(d: Raw) { return commercialState(d.site_order_status) === 'cancelled' || d.operational_dismissed_at != null; }
export function sortUniqueEvents(events: readonly TrackingEvent[]): TrackingEvent[] {
  const known = new Map<string, TrackingEvent>();
  for (const event of events) {
    if (!EVENT_KINDS.includes(event.kind) || !iso(event.at) || !event.event_id) continue;
    const previous = known.get(event.event_id);
    if (!previous || previous.revision < event.revision) known.set(event.event_id, event);
  }
  return Array.from(known.values()).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.revision - b.revision || a.event_id.localeCompare(b.event_id));
}
export interface ConfirmedSnapshot {
  delivery: Raw;
  route: Raw | null;
  routeDeliveries: Raw[];
  ledgerEvents: TrackingEvent[];
  confirmedAt: string;
  now?: number;
  reconciling?: boolean;
  showCourier?: boolean;
  showPosition?: boolean;
}
function statusFromSnapshot(s: ConfirmedSnapshot, events: TrackingEvent[]): TrackingStatus {
  const d = s.delivery;
  if (isCancelled(d)) return 'cancelled';
  if (d.completed === true && iso(d.completed_at)) return 'delivered';
  if (Array.isArray(d.delivery_attempts) && d.delivery_attempts.length > 0 && d.completed !== true) return 'delivery_issue';
  const commercial = commercialState(d.site_order_status);
  const started = Boolean(iso(s.route?.started_at) || iso(s.route?.departure_time));
  if (started && text(d.route_id) && text(d.route_id) === text(s.route?.id)) return 'out_for_delivery';
  if (text(d.route_id) && s.route) return 'assigned';
  if (commercial) return commercial === 'cancelled' ? 'cancelled' : commercial;
  if (events.some(event => event.kind === 'confirmed')) return 'confirmed';
  return d.scheduled_for ? 'scheduled' : 'received';
}
export function computeProgress(s: ConfirmedSnapshot, status: TrackingStatus): PublicProjection['progress'] {
  const d = s.delivery;
  const route = s.route;
  if (s.showPosition !== true || s.reconciling === true || !route || status !== 'out_for_delivery') return null;
  if (!iso(route.started_at) && !iso(route.departure_time)) return null;
  if (text(route.id) !== text(d.route_id) || route.status === 'fechada') return null;
  const routeRevision = iso(route.updated_at);
  const deliveryRevision = iso(d.order_updated_at);
  const now = s.now ?? Date.now();
  // Changed ordering / route metadata: use conservative recovery window.
  if (routeRevision && now - Date.parse(routeRevision) < 90_000) return null;
  if (deliveryRevision && now - Date.parse(deliveryRevision) < 90_000) return null;
  // A route revision mismatch is positive evidence of an unreconciled ordering change.
  if (typeof route.route_revision === 'number' && typeof d.route_revision === 'number' &&
      Number.isInteger(route.route_revision) && Number.isInteger(d.route_revision) &&
      route.route_revision !== d.route_revision) return null;
  const candidates = s.routeDeliveries.filter(x => x.route_id === d.route_id && !isCancelled(x) &&
    (x.fulfillment_mode == null || x.fulfillment_mode === 'delivery'));
  if (candidates.length === 0 || candidates.length > 300 || !candidates.some(x => x.id === d.id)) return null;
  // No deterministic order means no trustworthy public position.
  if (candidates.some(x => num(x.order_index) === null || Number(x.order_index) < 0)) return null;
  const ordered = [...candidates].sort((a, b) => Number(a.order_index) - Number(b.order_index) || text(a.id).localeCompare(text(b.id)));
  const stops: Array<{ key: string; items: Raw[] }> = [];
  for (const item of ordered) {
    const key = stopGroupKey(item);
    let group = stops.find(group => group.key === key);
    if (!group) { group = { key, items: [] }; stops.push(group); }
    group.items.push(item);
  }
  const idx = stops.findIndex(stop => stop.items.some(item => item.id === d.id));
  if (idx < 0) return null;
  const pending = stops.filter(stop => stop.items.some(item => item.completed !== true));
  const pendingIndex = pending.findIndex(stop => stop.items.some(item => item.id === d.id));
  if (pendingIndex < 0) return null;
  const current = num(route.current_stop_number);
  const currentAt = iso(route.current_stop_verified_at);
  const currentStop = currentAt && current != null && Number.isInteger(current) && current > 0 && current <= stops.length &&
    now - Date.parse(currentAt) < 10 * 60_000 ? current : null;
  return {
    status: 'verified', current_stop_number: currentStop,
    planned_customer_stop_number: idx + 1, total_physical_stops: stops.length,
    stops_ahead: pendingIndex, is_next_stop: pendingIndex === 0,
  };
}
export function projectPublicTracking(s: ConfirmedSnapshot): PublicProjection {
  const events = sortUniqueEvents(s.ledgerEvents);
  const status = statusFromSnapshot(s, events);
  const timestamps = [s.confirmedAt, s.delivery.completed_at, s.delivery.created_at, s.delivery.createdAt, s.route?.started_at, s.route?.departure_time,
    ...events.map(e => e.at)].map(iso).filter((x): x is string => Boolean(x));
  if (timestamps.length === 0) throw new Error('TRACKING_UNAVAILABLE');
  const asOf = timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const now = s.now ?? Date.now();
  const terminal = status === 'delivered' || status === 'cancelled';
  const freshness = s.reconciling ? 'reconciling' : !terminal && now - Date.parse(asOf) > 10 * 60_000 ? 'stale' : 'fresh';
  const timeline = events.slice(-30).map(e => ({
    id: e.id.slice(0, 128).replace(/[^A-Za-z0-9._:/-]/g, ''), kind: e.kind,
    title: TITLES[e.kind], at: iso(e.at)!,
  }));
  const fulfillment = s.delivery.fulfillment_mode === 'pickup' ? 'pickup' as const : 'delivery' as const;
  const source = text(s.delivery.source_system);
  const origin = text(s.delivery.origin);
  const origin_label = source === 'dfl_site' ? 'Loja' : origin === 'ifood' ? 'iFood' : origin === 'food99' ? '99Food' : 'Loja';
  const id = text(s.delivery.order_id || s.delivery.external_order_id || s.delivery.id, 30).replace(/[^a-zA-Z0-9_-]/g, '');
  const label = id ? `#${id}`.slice(0, 32) : 'Pedido';
  const courier = s.showCourier && s.route && !terminal &&
    typeof s.route.motoboy_name === 'string'
    ? s.route.motoboy_name.trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}'-]/gu, '').slice(0, 40)
    : '';
  return {
    contract: TRACKING_PUBLIC_CONTRACT, version: TRACKING_PUBLIC_VERSION,
    order: { label, origin_label, fulfillment }, status, as_of: asOf, freshness,
    timeline, progress: freshness === 'fresh' ? computeProgress(s, status) : null,
    courier: courier ? { first_name: courier } : null,
    terminal,
  };
}
function validateBasePublicProjection(p: PublicProjection): boolean {
  if (p.contract !== TRACKING_PUBLIC_CONTRACT || p.version !== 1 || !iso(p.as_of)) return false;
  if (!['fresh','stale','reconciling','unknown'].includes(p.freshness) || !EVENT_KINDS.includes(p.status)) return false;
  if (p.order.label.length > 32 || p.order.origin_label.length > 40 || p.timeline.length > 30) return false;
  const ids = new Set<string>();
  for (const e of p.timeline) {
    if (!e.id || ids.has(e.id) || !EVENT_KINDS.includes(e.kind) || !iso(e.at) || e.title !== TITLES[e.kind]) return false;
    ids.add(e.id);
  }
  const v = p.progress;
  if (v) {
    const t = v.total_physical_stops;
    if (t < 1 || t > 300 || !Number.isInteger(t) ||
      v.planned_customer_stop_number == null || v.planned_customer_stop_number < 1 || v.planned_customer_stop_number > t ||
      v.stops_ahead == null || v.stops_ahead < 0 || v.stops_ahead >= t ||
      v.is_next_stop !== (v.stops_ahead === 0)) return false;
  }
  return true;
}

/** R251 strict public allowlist: rejects extra fields, inconsistent progress and private information. */
export function validateStrictPublicProjection(value: unknown): value is PublicProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const shape = (v:unknown, names:readonly string[]) => Boolean(v && typeof v==='object' && !Array.isArray(v) &&
    Object.keys(v as Record<string,unknown>).length===names.length &&
    Object.keys(v as Record<string,unknown>).every(k=>names.includes(k)) &&
    names.every(k=>Object.prototype.hasOwnProperty.call(v,k)));
  if (!shape(record,['contract','version','order','status','as_of','freshness','timeline','progress','courier','terminal'])) return false;
  if (!shape(record.order,['label','origin_label','fulfillment'])) return false;
  if (typeof record.status!=='string' || !EVENT_KINDS.includes(record.status as TrackingKind) || record.status==='reorganized')return false;
  if (typeof record.terminal!=='boolean' || record.terminal !== (record.status==='delivered'||record.status==='cancelled'))return false;
  const order=record.order as Record<string,unknown>;
  if (typeof order.label!=='string'||order.label.length<1||order.label.length>32||
    typeof order.origin_label!=='string'||order.origin_label.length<1||order.origin_label.length>40||
    (order.fulfillment!=='delivery'&&order.fulfillment!=='pickup'))return false;
  if (!iso(record.as_of) || typeof record.freshness!=='string' || !['fresh','stale','reconciling','unknown'].includes(record.freshness))return false;
  if (!Array.isArray(record.timeline) || record.timeline.length>30)return false;
  const ids=new Set<string>();
  for(const row of record.timeline){
    if (!shape(row,['id','kind','title','at'])) return false;
    const t=row as Record<string,unknown>;
    if(typeof t.id!=='string'||t.id.length<1||t.id.length>128|| !/^[A-Za-z0-9._:/-]+$/.test(t.id)||ids.has(t.id))return false;
    ids.add(t.id);
    if(typeof t.kind!=='string'|| !EVENT_KINDS.includes(t.kind as TrackingKind) ||
      typeof t.title!=='string'||t.title!==TITLES[t.kind as TrackingKind]||!iso(t.at))return false;
  }
  if(record.courier!==null){
    if(!shape(record.courier,['first_name']))return false;
    const c=record.courier as Record<string,unknown>;
    if(typeof c.first_name!=='string'||c.first_name.length<1||c.first_name.length>40||!/^[\p{L}\p{M}'-]+$/u.test(c.first_name))return false;
  }
  if(record.progress!==null){
    if(!shape(record.progress,['status','current_stop_number','planned_customer_stop_number','total_physical_stops','stops_ahead','is_next_stop']))return false;
    const p=record.progress as Record<string,unknown>;
    const int=(v:unknown)=>typeof v==='number'&&Number.isInteger(v);
    if(record.status!=='out_for_delivery'||record.freshness!=='fresh'||p.status!=='verified'||
      !int(p.total_physical_stops)||Number(p.total_physical_stops)<1||Number(p.total_physical_stops)>300||
      !int(p.planned_customer_stop_number)||Number(p.planned_customer_stop_number)<1||Number(p.planned_customer_stop_number)>Number(p.total_physical_stops)||
      !int(p.stops_ahead)||Number(p.stops_ahead)<0||Number(p.stops_ahead)>=Number(p.total_physical_stops)||
      typeof p.is_next_stop!=='boolean'||p.is_next_stop!==(p.stops_ahead===0))return false;
    if(p.current_stop_number!==null&&(!int(p.current_stop_number)||Number(p.current_stop_number)<1||Number(p.current_stop_number)>Number(p.total_physical_stops)))return false;
  }
  return validateBasePublicProjection(value as PublicProjection);
}

export function validatePublicProjection(p: PublicProjection): boolean {
  return validateStrictPublicProjection(p);
}
