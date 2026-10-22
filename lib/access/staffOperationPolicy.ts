/** R27 — contrato puro de propostas; NUNCA representa baixa/entrada efetiva. */
export type StaffOperationKind = 'delivery_confirmation' | 'purchase_intent';
export type StaffRole = 'motoboy' | 'compras' | 'operacao' | 'personalizado';
export interface StaffOperationAccount {
  uid?: unknown;
  status?: unknown;
  role?: unknown;
  permissions?: unknown;
  linkedMotoboyId?: unknown;
}
export interface StaffOperationInput {
  kind: StaffOperationKind;
  targetId: string;
  requestId: string;
  quantity?: number;
  note?: string;
}
const uidPattern = /^[A-Za-z0-9_-]{8,120}$/;
const idPattern = /^[A-Za-z0-9_-]{1,120}$/;
const requestPattern = /^[A-Za-z0-9_-]{8,80}$/;
const validText = (value: unknown) => typeof value === 'string' && value.length <= 120;
const clean = (v: unknown) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
export function validUid(uid: unknown): uid is string { return typeof uid === 'string' && uidPattern.test(uid); }
export function parseStaffOperation(body: unknown): StaffOperationInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const v = body as Record<string, unknown>;
  if (v.kind !== 'delivery_confirmation' && v.kind !== 'purchase_intent') return null;
  if (typeof v.targetId !== 'string' || !idPattern.test(v.targetId) ||
      typeof v.requestId !== 'string' || !requestPattern.test(v.requestId)) return null;
  if (v.note !== undefined && !validText(v.note)) return null;
  const note = clean(v.note);
  if (v.kind === 'delivery_confirmation') {
    if (v.quantity !== undefined) return null;
    return {kind:v.kind,targetId:v.targetId,requestId:v.requestId,...(note?{note}:{})};
  }
  if (typeof v.quantity !== 'number' || !Number.isFinite(v.quantity) ||
      v.quantity < 0.001 || v.quantity > 10000 || Math.abs(v.quantity * 1000 - Math.round(v.quantity * 1000)) > 1e-7) return null;
  return {kind:v.kind,targetId:v.targetId,requestId:v.requestId,quantity:v.quantity,...(note?{note}:{})};
}
export function maySubmitStaffOperation(account: StaffOperationAccount, uid: string, kind: StaffOperationKind): boolean {
  if (!validUid(uid) || account.uid !== uid || account.status !== 'active' || !Array.isArray(account.permissions)) return false;
  const role = account.role;
  if (kind === 'delivery_confirmation') {
    return (role === 'motoboy' || role === 'operacao' || role === 'personalizado') &&
      account.permissions.includes('deliveries_complete') && account.permissions.includes('deliveries_read') &&
      (role === 'operacao' || (typeof account.linkedMotoboyId === 'string' && account.linkedMotoboyId.trim().length > 0));
  }
  return (role === 'compras' || role === 'operacao' || role === 'personalizado') &&
    account.permissions.includes('purchases_write') && account.permissions.includes('stock_read');
}
export function deliveryEligibleForRequest(delivery: Record<string, unknown>, route: Record<string, unknown>, linkedMotoboyId: string, routeId: string, role: StaffOperationAccount['role'] = 'motoboy'): boolean {
  // Operacao tem projecao limitada de varias rotas; demais perfis continuam por motoboy.
  // A API tambem exige previamente o documento publicado em staff_workspaces/{uid}/deliveries/{id}.
  const routeAssigned = typeof route.motoboy_id === 'string' && route.motoboy_id.trim().length > 0;
  const assignedToActor = role === 'operacao' ? routeAssigned : !!linkedMotoboyId && route.motoboy_id === linkedMotoboyId;
  if (!idPattern.test(routeId) || delivery.route_id !== routeId || !assignedToActor) return false;
  if (route.status !== 'aberta' || !(typeof route.started_at === 'string' && route.started_at || typeof route.departure_time === 'string' && route.departure_time)) return false;
  if (delivery.completed === true || (delivery.fulfillment_mode !== undefined && delivery.fulfillment_mode !== 'delivery')) return false;
  if (delivery.source_system === 'dfl_site') {
    const status = clean(delivery.site_order_status).toLowerCase();
    if (!status || ['pendente','agendado','cancelado','cancelada','cancelled','canceled'].includes(status)) return false;
  }
  return true;
}
export function sameRequest(existing: Record<string, unknown>, input: StaffOperationInput, uid: string): boolean {
  return existing.actorUid === uid && existing.kind === input.kind && existing.targetId === input.targetId &&
    (existing.quantity ?? null) === (input.quantity ?? null) && (existing.note ?? '') === (input.note ?? '');
}
