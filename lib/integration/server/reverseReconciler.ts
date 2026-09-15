import 'server-only';
import { createHash } from 'node:crypto';
import type { QueryDocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { adminDb } from './admin';
import { buildIntegrationEvent, buildOutboxRecord } from '../contracts';

type Raw = Record<string, unknown>;

type Stop = {
  key: string;
  deliveries: Array<{ id: string; data: Raw }>;
  pending: Array<{ id: string; data: Raw }>;
};

const str = (value: unknown) => typeof value === 'string' ? value : '';
const bool = (value: unknown) => value === true;
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;

function isSiteDelivery(data: Raw) {
  return data.source_system === 'dfl_site' && str(data.external_order_id).trim().length > 0;
}

function stopKey(id: string, data: Raw) {
  return str(data.stop_group_id).trim() || id;
}

function groups(items: Array<{ id: string; data: Raw }>): Stop[] {
  const ordered = [...items].sort((a, b) => {
    const delta = num(a.data.order_index) - num(b.data.order_index);
    return delta || a.id.localeCompare(b.id);
  });
  const map = new Map<string, Stop>();
  for (const item of ordered) {
    const key = stopKey(item.id, item.data);
    const current = map.get(key) || { key, deliveries: [], pending: [] };
    current.deliveries.push(item);
    if (!bool(item.data.completed)) current.pending.push(item);
    map.set(key, current);
  }
  return [...map.values()];
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

function routeStarted(route: Raw | undefined) {
  return Boolean(str(route?.started_at) || str(route?.departure_time));
}

function routeClosed(route: Raw | undefined) {
  return route?.status === 'fechada';
}

function occurredAt(delivery: Raw, route: Raw | undefined) {
  const candidates = [
    str(delivery.completed_at),
    str(delivery.order_updated_at),
    str(delivery.updated_at),
    str(route?.end_time),
    str(route?.updated_at),
    str(route?.started_at),
    str(route?.departure_time),
  ].filter(Boolean);
  const valid = candidates
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  return valid[0]?.value || new Date().toISOString();
}

function eventType(input: {
  delivery: Raw;
  route: Raw | undefined;
  pendingIndex: number;
}) {
  if (bool(input.delivery.completed)) return 'delivery.completed' as const;
  if (routeClosed(input.route)) return 'route.completed' as const;
  if (routeStarted(input.route) && input.pendingIndex === 0) return 'delivery.next_stop' as const;
  if (routeStarted(input.route)) return 'delivery.position_changed' as const;
  if (str(input.delivery.route_id)) return 'delivery.assigned' as const;
  return null;
}

export async function reconcileReverseTrackingOutbox() {
  const [deliverySnap, routeSnap] = await Promise.all([
    adminDb.collection('deliveries').get(),
    adminDb.collection('routes').get(),
  ]);

  const routes = new Map(
    routeSnap.docs.map((doc: QueryDocumentSnapshot) => [
      doc.id,
      doc.data() as Raw,
    ]),
  );
  const all = deliverySnap.docs.map((doc: QueryDocumentSnapshot) => ({
    id: doc.id,
    data: doc.data() as Raw,
  }));
  const byRoute = new Map<string, Array<{ id: string; data: Raw }>>();

  for (const item of all) {
    const routeId = str(item.data.route_id);
    if (!routeId) continue;
    const list = byRoute.get(routeId) || [];
    list.push(item);
    byRoute.set(routeId, list);
  }

  const candidates: Array<{
    eventId: string;
    event: ReturnType<typeof buildIntegrationEvent>;
  }> = [];

  for (const item of all) {
    if (!isSiteDelivery(item.data)) continue;

    const routeId = str(item.data.route_id);
    const route = routeId ? routes.get(routeId) : undefined;
    const routeItems = routeId ? (byRoute.get(routeId) || []) : [item];
    const stopGroups = groups(routeItems);
    const key = stopKey(item.id, item.data);
    const stopIndex = stopGroups.findIndex((group) => group.key === key);
    const pendingGroups = stopGroups.filter((group) => group.pending.length > 0);
    const pendingIndex = pendingGroups.findIndex((group) => group.key === key);
    const type = eventType({ delivery: item.data, route, pendingIndex });
    if (!type) continue;

    const payload = {
      externalOrderId: str(item.data.external_order_id),
      externalOrderSource: 'dfl_site' as const,
      deliveryId: item.id,
      routeId: routeId || null,
      routeName: str(route?.name) || null,
      motoboyId: str(route?.motoboy_id) || null,
      motoboyName: str(route?.motoboy_name) || null,
      stopGroupId: key,
      stopPosition: stopIndex >= 0 ? stopIndex + 1 : null,
      stopsAhead: pendingIndex >= 0 ? pendingIndex : null,
      totalStops: stopGroups.length || null,
      nextStop: routeStarted(route) && pendingIndex === 0,
      completedAt: str(item.data.completed_at) || null,
      failedReason: null,
    };

    // O ID deriva do snapshot operacional relevante. Reconciliar o mesmo estado
    // produz o mesmo event_id; mudar posição/rota/conclusão produz outro evento.
    const fingerprint = stableHash({ type, payload });
    const eventId = `evt-v1__${type}__${encodeURIComponent(item.id)}__snapshot-${fingerprint}`;
    const event = buildIntegrationEvent({
      event_id: eventId,
      event_type: type,
      occurred_at: occurredAt(item.data, route),
      source_system: 'dfl_entregas',
      entity_type: 'delivery',
      entity_id: item.id,
      correlation_id: str(item.data.external_order_id),
      payload,
    });
    candidates.push({ eventId, event });
  }

  let created = 0;
  let existing = 0;

  // Admin transaction torna a criação do outbox idempotente. Não precisamos
  // acoplar o cliente PWA às regras de integration_outbox.
  for (const candidate of candidates) {
    const ref = adminDb.collection('integration_outbox').doc(encodeURIComponent(candidate.eventId));
    const wasCreated = await adminDb.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, buildOutboxRecord(candidate.event));
      return true;
    });
    if (wasCreated) created += 1;
    else existing += 1;
  }

  return {
    ok: true,
    siteDeliveries: all.filter((item) => isSiteDelivery(item.data)).length,
    candidates: candidates.length,
    created,
    existing,
  };
}
