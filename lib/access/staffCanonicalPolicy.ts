/** R28: verificacoes puras antes de reconciliar uma acao com a origem canonica. */
export type StaffCanonicalRequest = Record<string, unknown>;
export const canonicalRequestId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{8,220}$/.test(v);
export const canonicalSourceId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(v);
export const validIso = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v) && Number.isFinite(Date.parse(v));

export function eligibleDeliveryClaim(
  request: StaffCanonicalRequest, account: Record<string, unknown>,
  delivery: Record<string, unknown>, route: Record<string, unknown>, now: number,
): boolean {
  const linked = account.linkedMotoboyId;
  const perms = account.permissions;
  if (request.status !== 'pending' || request.kind !== 'delivery_confirmation' ||
    !canonicalSourceId(request.targetId) || !canonicalSourceId(request.routeId) ||
    typeof linked !== 'string' || !linked || account.uid !== request.actorUid ||
    account.status !== 'active' || !Array.isArray(perms) ||
    !perms.includes('deliveries_complete') || !perms.includes('deliveries_read') ||
    !['motoboy', 'operacao', 'personalizado'].includes(String(account.role))) return false;
  if (delivery.route_id !== request.routeId || route.motoboy_id !== linked ||
    route.status !== 'aberta' || !(route.started_at || route.departure_time) ||
    delivery.completed === true ||
    (delivery.fulfillment_mode !== undefined && delivery.fulfillment_mode !== 'delivery')) return false;
  if (delivery.source_system === 'dfl_site') {
    const status = String(delivery.site_order_status || '').trim().toLowerCase();
    if (!status || ['pendente','agendado','cancelado','cancelada','cancelled','canceled'].includes(status)) return false;
  }
  if (!validIso(request.createdAt) || Date.parse(request.createdAt) > now + 60000 ||
      now - Date.parse(request.createdAt) > 7 * 86400000) return false;
  const currentLease = request.execution as Record<string, unknown> | undefined;
  if (currentLease && validIso(currentLease.expiresAt) && Date.parse(currentLease.expiresAt) > now) return false;
  return true;
}
export function verifiedCanonicalDelivery(
  request: StaffCanonicalRequest, delivery: Record<string, unknown>, token: string, now: number,
): boolean {
  const lease = request.execution as Record<string, unknown> | undefined;
  if (request.status !== 'pending' || request.kind !== 'delivery_confirmation' ||
    !lease || lease.token !== token || !validIso(lease.issuedAt) || !validIso(lease.expiresAt) ||
    Date.parse(lease.expiresAt) <= now || delivery.route_id !== request.routeId ||
    delivery.completed !== true || !validIso(delivery.completed_at) || !validIso(request.createdAt)) return false;
  const completed = Date.parse(delivery.completed_at);
  return completed >= Date.parse(lease.issuedAt) - 5000 && completed >= Date.parse(request.createdAt) && completed <= now + 60000;
}

export function verifyIntegratedSupply(request: StaffCanonicalRequest, supply: Record<string, unknown>, now: number): {itemIds: string[]; quantity: number} | null {
  if (request.kind !== 'purchase_intent' || request.status !== 'pending' ||
      !canonicalSourceId(request.targetId) || !validIso(request.createdAt) ||
      !validIso(supply.stock_integrated_at) || supply.status !== 'conferido' ||
      supply.stock_reversed_at || Date.parse(supply.stock_integrated_at) < Date.parse(request.createdAt) ||
      Date.parse(supply.stock_integrated_at) > now + 60000 || !Array.isArray(supply.items) ||
      typeof request.quantity !== 'number' || !Number.isFinite(request.quantity) || request.quantity <= 0 ||
      typeof request.unit !== 'string' || !request.unit) return null;
  const items = supply.items as Array<Record<string, unknown>>;
  const linked = items.filter(item => item.stock_product_id === request.targetId);
  if (!linked.length || linked.length > 30 || linked.some(item =>
      !canonicalSourceId(item.id) || item.unit !== request.unit ||
      typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0)) return null;
  const amount = linked.reduce((sum, item) => sum + (item.quantity as number), 0);
  if (Math.round(amount * 1000) < Math.round(request.quantity * 1000)) return null;
  return {itemIds: linked.map(x => x.id as string), quantity: amount};
}

export function existingOutcome(record: StaffCanonicalRequest, operation: 'delivery'|'purchase', source: string): boolean {
  return operation === 'delivery' ?
    record.status === 'applied' && record.effect === 'owner_canonical_delivery' && record.targetId === source :
    record.status === 'linked' && record.effect === 'owner_integrated_supply_verified' && record.linkedSupplyId === source;
}
