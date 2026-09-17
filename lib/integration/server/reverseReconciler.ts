import 'server-only';
import { createHash } from 'node:crypto';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from './admin';
import { buildIntegrationEvent, buildOutboxRecord } from '../contracts';

type Raw = Record<string, unknown>;
type Item = { id: string; data: Raw };
type Stop = { key: string; deliveries: Item[]; pending: Item[] };

const str = (value: unknown) => typeof value === 'string' ? value : '';
const bool = (value: unknown) => value === true;
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;

function stopKey(id: string, data: Raw) {
  return str(data.stop_group_id).trim() || id;
}

function groups(items: Item[]): Stop[] {
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
    str(delivery.completed_at), str(delivery.order_updated_at), str(delivery.updated_at),
    str(route?.end_time), str(route?.updated_at), str(route?.started_at), str(route?.departure_time),
  ].filter(Boolean);
  const valid = candidates.map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time)).sort((a, b) => b.time - a.time);
  return valid[0]?.value || new Date().toISOString();
}

function eventTypes(delivery: Raw, route: Raw | undefined, pendingIndex: number) {
  if (bool(delivery.completed)) return ['delivery.completed'] as const;
  if (routeClosed(route)) return ['route.completed'] as const;

  // Estar apenas alocado em uma rota NÃO significa estar na rua.
  // A saída real exige started_at/departure_time da rota.
  if (!routeStarted(route)) {
    return str(delivery.route_id) ? ['delivery.assigned'] as const : [] as const;
  }

  // Ao iniciar a rota existem duas informações diferentes:
  // 1) o pedido saiu para entrega;
  // 2) a posição operacional atual.
  // Mantemos ambas no outbox, mas somente next_stop deve significar
  // "você é o próximo".
  return pendingIndex === 0
    ? ['delivery.out_for_delivery', 'delivery.next_stop'] as const
    : ['delivery.out_for_delivery', 'delivery.position_changed'] as const;
}

async function loadRoute(routeId: string): Promise<Raw | undefined> {
  if (!routeId) return undefined;
  const snap = await adminDb.collection('routes').doc(routeId).get();
  return snap.exists ? snap.data() as Raw : undefined;
}

async function loadRouteDeliveries(routeId: string, fallback: Item): Promise<Item[]> {
  if (!routeId) return [fallback];
  const snap = await adminDb.collection('deliveries').where('route_id', '==', routeId).get();
  return (snap.docs as QueryDocumentSnapshot[]).map((doc) => ({ id: doc.id, data: doc.data() as Raw }));
}

export async function reconcileReverseTrackingOutbox() {
  // O worker reverso só precisa partir de deliveries pertencentes ao Site.
  // A versão anterior lia TODAS as deliveries e TODAS as routes a cada minuto.
  const siteSnap = await adminDb.collection('deliveries')
    .where('source_system', '==', 'dfl_site')
    .get();

  const siteDeliveries: Item[] = (siteSnap.docs as QueryDocumentSnapshot[])
    .map((doc) => ({ id: doc.id, data: doc.data() as Raw }))
    .filter((item) => str(item.data.external_order_id).trim().length > 0);

  const routeIds = [...new Set(siteDeliveries.map((item) => str(item.data.route_id).trim()).filter(Boolean))];
  const routeMap = new Map<string, Raw | undefined>();
  const routeItemsMap = new Map<string, Item[]>();

  // Carregamos somente as rotas que contêm deliveries do Site. As deliveries
  // da rota continuam necessárias para calcular posição por parada física.
  await Promise.all(routeIds.map(async (routeId) => {
    const [route, items] = await Promise.all([
      loadRoute(routeId),
      loadRouteDeliveries(routeId, siteDeliveries.find((item) => str(item.data.route_id) === routeId)!),
    ]);
    routeMap.set(routeId, route);
    routeItemsMap.set(routeId, items);
  }));

  const candidates: Array<{ eventId: string; event: ReturnType<typeof buildIntegrationEvent> }> = [];

  for (const item of siteDeliveries) {
    const routeId = str(item.data.route_id).trim();
    const route = routeId ? routeMap.get(routeId) : undefined;
    const routeItems = routeId ? (routeItemsMap.get(routeId) || [item]) : [item];
    const stopGroups = groups(routeItems);
    const key = stopKey(item.id, item.data);
    const stopIndex = stopGroups.findIndex((group) => group.key === key);
    const pendingGroups = stopGroups.filter((group) => group.pending.length > 0);
    const pendingIndex = pendingGroups.findIndex((group) => group.key === key);
    const started = routeStarted(route);
    const types = eventTypes(item.data, route, pendingIndex);
    if (!types.length) continue;

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
      stopsAhead: started && pendingIndex >= 0 ? pendingIndex : null,
      totalStops: stopGroups.length || null,
      nextStop: started && pendingIndex === 0,
      completedAt: str(item.data.completed_at) || null,
      failedReason: null,
    };

    for (const type of types) {
      // delivery.out_for_delivery representa a SAÍDA da rota, não cada
      // alteração posterior de posição. Sua identidade precisa permanecer
      // estável enquanto a rota estiver na rua para não gerar WhatsApp repetido.
      const identity = type === 'delivery.out_for_delivery'
        ? {
            type,
            deliveryId: item.id,
            routeId: routeId || null,
            startedAt: str(route?.started_at) || str(route?.departure_time),
          }
        : { type, payload };

      const fingerprint = stableHash(identity);
      const eventId = `evt-v1__${type}__${encodeURIComponent(item.id)}__snapshot-${fingerprint}`;
      candidates.push({
        eventId,
        event: buildIntegrationEvent({
          event_id: eventId, event_type: type, occurred_at: occurredAt(item.data, route),
          source_system: 'dfl_entregas', entity_type: 'delivery', entity_id: item.id,
          correlation_id: str(item.data.external_order_id), payload,
        }),
      });
    }
  }

  let created = 0;
  let existing = 0;

  // O event_id é determinístico. Uma leitura direta é suficiente para snapshots
  // já existentes; create() preserva atomicamente a proteção contra corrida.
  for (const candidate of candidates) {
    const ref = adminDb.collection('integration_outbox').doc(encodeURIComponent(candidate.eventId));
    const snap = await ref.get();
    if (snap.exists) {
      existing += 1;
      continue;
    }
    try {
      await ref.create(buildOutboxRecord(candidate.event));
      created += 1;
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
      if (code === '6' || code === 'already-exists' || code === 'ALREADY_EXISTS') {
        existing += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    ok: true,
    siteDeliveries: siteDeliveries.length,
    routesRead: routeIds.length,
    candidates: candidates.length,
    created,
    existing,
  };
}
