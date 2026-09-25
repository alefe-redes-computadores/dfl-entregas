// READ-GUARD V45B: preservar ativos dfl_site + recuperação limitada; nunca reintroduzir scan histórico completo.
import 'server-only';
import { createHash } from 'node:crypto';
import { type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from './admin';
import { buildIntegrationEvent, buildOutboxRecord } from '../contracts';

type Raw = Record<string, unknown>;
type Item = { id: string; data: Raw };
type Stop = { key: string; deliveries: Item[]; pending: Item[] };
export type ReverseReconcileOptions = {
  tracking?: boolean;
  recovery?: boolean;
  analytics?: boolean;
  activeLimit?: number;
};

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

export async function reconcileReverseTrackingOutbox(options: ReverseReconcileOptions = {}) {
  const trackingEnabled = options.tracking !== false;
  const recoveryEnabled = options.recovery !== false;
  const analyticsEnabled = options.analytics !== false;
  const activeLimit = Math.max(1, Math.min(40, Math.trunc(options.activeLimit || 40)));
  // O worker reverso só precisa partir de deliveries pertencentes ao Site.
  // A versão anterior lia TODAS as deliveries e TODAS as routes a cada minuto.
  // V42: reconciliation is a bounded recovery path, not a full-history scanner.
  const activeSnap = trackingEnabled
    ? await adminDb.collection('deliveries')
      .where('source_system', '==', 'dfl_site')
      .where('completed', '==', false)
      .limit(activeLimit)
      .get()
    : null;

  const maintenanceRef = adminDb
    .collection('integration_checkpoints')
    .doc('reverse_recovery_v3');
  const maintenanceSnap = recoveryEnabled || analyticsEnabled ? await maintenanceRef.get() : null;
  const maintenanceState = maintenanceSnap?.data() || {};
  const lastMaintenanceAt = Date.parse(str(maintenanceState.last_run_at));
  const maintenanceDue = recoveryEnabled &&
    (!Number.isFinite(lastMaintenanceAt) || Date.now() - lastMaintenanceAt >= 7 * 24 * 60 * 60 * 1000);

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const completedCursor = str(maintenanceState.completed_cursor).trim();
  let recentCompletedDocs: QueryDocumentSnapshot[] = [];
  try {
    // Recuperação é uma rede de segurança, não parte do polling rápido.
    // Repetir a mesma janela de 48h a cada minuto multiplicava leituras.
    if (!maintenanceDue) throw new Error('maintenance-not-due');
    const recentCompletedSnap = await adminDb.collection('deliveries')
      .where('source_system', '==', 'dfl_site')
      .where('completed', '==', true)
      .where('updated_at', '>', completedCursor || recentCutoff)
      .orderBy('updated_at', 'asc')
      .limit(120)
      .get();
    recentCompletedDocs = recentCompletedSnap.docs as QueryDocumentSnapshot[];
  } catch (error) {
    if (error instanceof Error && error.message === 'maintenance-not-due') {
      // Ciclo rápido: somente entregas ativas.
    } else {
    // Missing composite index must not stop active delivery reconciliation.
    console.warn('[integration/reverse-reconciler] recent recovery skipped', {
      error: error instanceof Error ? error.message : String(error),
    });
    }
  }

  const byId = new Map<string, Item>();
  for (const doc of [...((activeSnap?.docs || []) as QueryDocumentSnapshot[]), ...recentCompletedDocs]) {
    byId.set(doc.id, { id: doc.id, data: doc.data() as Raw });
  }
  const siteDeliveries: Item[] = [...byId.values()]
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

  // Fila dirigida por escrita: zero paginação do histórico. Somente entregas
  // marcadas ao fechar uma rota (ou concluir retirada/balcão) são lidas.
  const analyticsPendingSnap = analyticsEnabled
    ? await adminDb.collection('deliveries').where('analytics_sync_pending', '==', true).limit(40).get()
    : null;
  const analyticsItems: Item[] = ((analyticsPendingSnap?.docs || []) as QueryDocumentSnapshot[])
    .map((doc) => ({ id: doc.id, data: doc.data() as Raw }));

  const candidates: Array<{ eventId: string; event: ReturnType<typeof buildIntegrationEvent> }> = [];

  for(const item of analyticsItems){
    const updatedAt=str(item.data.updated_at).trim(),completedAt=str(item.data.completed_at).trim(),createdAt=str(item.data.created_at||item.data.createdAt).trim();
    const sourceSystem=str(item.data.source_system).trim(),externalOrderId=str(item.data.external_order_id).trim();
    const customerCharge=Number(item.data.customer_charge??item.data.value),value=Number(item.data.value),paymentMethod=str(item.data.payment_method).trim()||'nao_informado';
    const completed=bool(item.data.completed),occurred=completedAt||createdAt||updatedAt||new Date().toISOString();
    const fingerprint=stableHash({deliveryId:item.id,updatedAt,completed,sourceSystem,externalOrderId,customerCharge:Number.isFinite(customerCharge)?customerCharge:0,value:Number.isFinite(value)?value:0,paymentMethod,origin:str(item.data.origin),fulfillmentMode:str(item.data.fulfillment_mode)});
    const eventType=completed?'delivery.completed':'delivery.created';
    const eventId=`evt-v1__${eventType}__${encodeURIComponent(item.id)}__analytics-v2-${fingerprint}`;
    candidates.push({eventId,event:buildIntegrationEvent({event_id:eventId,event_type:eventType,occurred_at:occurred,source_system:'dfl_entregas',entity_type:'delivery',entity_id:item.id,correlation_id:externalOrderId||`dfl_entregas:delivery:${item.id}`,payload:{analyticsNativeDelivery:true,completed,completedAt:completedAt||null,createdAt:createdAt||null,updatedAt:updatedAt||null,sourceSystem:sourceSystem||null,externalOrderId:externalOrderId||null,externalOrderSource:externalOrderId&&sourceSystem==='dfl_site'?'dfl_site':null,value:Number.isFinite(value)?value:0,customerCharge:Number.isFinite(customerCharge)?customerCharge:0,paymentMethod,origin:str(item.data.origin).trim()||'manual',fulfillmentMode:str(item.data.fulfillment_mode).trim()||'delivery'}})});
  }

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

  // O event_id é determinístico e create() já é atômico. Evitamos uma leitura
  // Firestore por candidato antes de cada create: ALREADY_EXISTS é o caminho
  // idempotente normal para snapshots já materializados.
  for (const candidate of candidates) {
    const ref = adminDb.collection('integration_outbox').doc(encodeURIComponent(candidate.eventId));
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

  if (analyticsItems.length) {
    const syncedAt = new Date().toISOString();
    const batch = adminDb.batch();
    analyticsItems.forEach((item) => batch.update(
      adminDb.collection('deliveries').doc(item.id),
      { analytics_sync_pending: false, analytics_synced_at: syncedAt },
    ));
    await batch.commit();
  }

  if (maintenanceDue || analyticsEnabled) {
    const newestCompletedCursor = recentCompletedDocs.reduce((latest, doc) => {
      const value = str((doc.data() as Raw).updated_at).trim();
      return value > latest ? value : latest;
    }, completedCursor);
    await maintenanceRef.set({
      ...(maintenanceDue ? { last_run_at: new Date().toISOString() } : {}),
      recent_completed_read: recentCompletedDocs.length,
      analytics_pending_read: analyticsItems.length,
      ...(newestCompletedCursor ? { completed_cursor: newestCompletedCursor } : {}),
    }, { merge: true });
  }

  return {
    ok: true,
    maintenanceDue,
    trackingEnabled,
    recoveryEnabled,
    analyticsEnabled,
    activeLimit,
    analyticsNativePendingRead: analyticsPendingSnap?.size || 0,
    analyticsNativeCandidates: analyticsItems.length,
    siteDeliveries: siteDeliveries.length,
    activeSiteDeliveries: activeSnap?.size || 0,
    recentCompletedRecoveries: recentCompletedDocs.length,
    recoveryWindowHours: 168,
    routesRead: routeIds.length,
    candidates: candidates.length,
    created,
    existing,
  };
}
