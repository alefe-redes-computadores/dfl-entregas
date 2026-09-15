import 'server-only';
import type { Customer, Delivery } from '@/types';
import type { ExternalIdentityLink, IntegrationInboxReceipt } from '../contracts';
import { planDflSiteOrderCreated } from '../consumer';
import { assertDflSiteOrderCreatedEvent, assertDflSiteOrderUpdatedEvent, siteDeliveryId, type DflSiteOrderCreatedEvent, type DflSiteOrderUpdatedEvent } from '../site-order';
import { buildExternalIdentityLink, externalIdentityLinkId, INTEGRATION_COLLECTIONS } from '../identity';
import { adminDb } from './admin';

const encodeDocId = (value: string) => {
  const id = encodeURIComponent(value.trim());
  if (!id || id.length > 1400) throw new Error('event_id inválido para inbox.');
  return id;
};

const asCustomer = (id: string, data: FirebaseFirestore.DocumentData): Customer => ({ id, ...data } as Customer);
const asDelivery = (id: string, data: FirebaseFirestore.DocumentData): Delivery => ({ id, ...data } as Delivery);

function sameLink(link: ExternalIdentityLink, type: 'delivery' | 'customer', id: string) {
  return link.local_entity_type === type && link.local_entity_id === id;
}

// Firestore Admin rejeita propriedades undefined por padrão.
// Os drafts locais usam undefined legitimamente para campos opcionais;
// removemos somente undefined antes de persistir, preservando null.
function firestoreData<T>(value: T): FirebaseFirestore.DocumentData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value as FirebaseFirestore.DocumentData;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, field]) => field !== undefined)
      .map(([key, field]) => [
        key,
        field && typeof field === 'object' && !Array.isArray(field)
          ? firestoreData(field)
          : Array.isArray(field)
            ? field.map((item) =>
                item && typeof item === 'object'
                  ? firestoreData(item)
                  : item,
              )
            : field,
      ]),
  );
}

export interface PersistedSiteOrderResult {
  already_processed: boolean;
  event_id: string;
  delivery_id: string;
  customer_id: string;
}

export async function consumeDflSiteOrderCreatedPersisted(rawEvent: unknown): Promise<PersistedSiteOrderResult> {
  assertDflSiteOrderCreatedEvent(rawEvent);
  const event: DflSiteOrderCreatedEvent = rawEvent;
  const externalCustomerId = event.payload.customerSnapshot?.id?.trim() || undefined;

  return adminDb.runTransaction(async (tx) => {
    const inboxRef = adminDb.collection(INTEGRATION_COLLECTIONS.inbox).doc(encodeDocId(event.event_id));
    const orderIdentityRef = adminDb.collection(INTEGRATION_COLLECTIONS.identities).doc(externalIdentityLinkId({
      source_system: 'dfl_site', external_entity_type: 'order', external_entity_id: event.payload.orderId,
    }));
    const deliveryRef = adminDb.collection('deliveries').doc(siteDeliveryId(event.payload.orderId));
    const customerIdentityRef = externalCustomerId
      ? adminDb.collection(INTEGRATION_COLLECTIONS.identities).doc(externalIdentityLinkId({
          source_system: 'dfl_site', external_entity_type: 'customer', external_entity_id: externalCustomerId,
        }))
      : null;

    // Firestore exige todas as leituras antes das escritas na transação.
    const [inboxSnap, orderIdentitySnap, deliverySnap, customerIdentitySnap, customersSnap] = await Promise.all([
      tx.get(inboxRef),
      tx.get(orderIdentityRef),
      tx.get(deliveryRef),
      customerIdentityRef ? tx.get(customerIdentityRef) : Promise.resolve(null),
      tx.get(adminDb.collection('customers')),
    ]);

    const inbox = inboxSnap.exists ? (inboxSnap.data() as IntegrationInboxReceipt) : null;
    const orderIdentity = orderIdentitySnap.exists ? (orderIdentitySnap.data() as ExternalIdentityLink) : null;
    const customerIdentity = customerIdentitySnap?.exists ? (customerIdentitySnap.data() as ExternalIdentityLink) : null;
    const deterministicDelivery = deliverySnap.exists ? asDelivery(deliverySnap.id, deliverySnap.data()!) : null;
    const customers = customersSnap.docs.map((snap) => asCustomer(snap.id, snap.data()));

    if (orderIdentity && !sameLink(orderIdentity, 'delivery', siteDeliveryId(event.payload.orderId))) {
      throw new Error('Conflito: pedido externo já aponta para outra entidade local.');
    }

    if (inbox?.status === 'processed' && inbox.local_entity_type === 'delivery' && inbox.local_entity_id) {
      const knownDelivery = deterministicDelivery;
      if (!knownDelivery || knownDelivery.id !== inbox.local_entity_id) {
        throw new Error('Inbox processada aponta para Delivery inexistente/divergente.');
      }
      return { already_processed: true, event_id: event.event_id, delivery_id: knownDelivery.id, customer_id: knownDelivery.customer_id };
    }

    const plan = planDflSiteOrderCreated(event, {
      customers,
      deliveries: deterministicDelivery ? [deterministicDelivery] : [],
      inboxReceipt: inbox,
      orderIdentity,
      customerIdentity,
      now: new Date().toISOString(),
    });

    if (plan.kind === 'already_processed') {
      if (!deterministicDelivery) throw new Error('Evento marcado como processado sem Delivery determinística.');
      const now = new Date().toISOString();
      if (!orderIdentity) {
        tx.create(orderIdentityRef, buildExternalIdentityLink({
          source_system: 'dfl_site', external_entity_type: 'order', external_entity_id: event.payload.orderId,
          local_entity_type: 'delivery', local_entity_id: deterministicDelivery.id, now,
        }));
      }
      if (!inboxSnap.exists) {
        tx.create(inboxRef, {
          event_id: event.event_id, event_type: event.event_type, source_system: event.source_system,
          entity_type: event.entity_type, entity_id: event.entity_id, schema_version: event.schema_version,
          received_at: now, processed_at: now, status: 'processed', local_entity_type: 'delivery',
          local_entity_id: deterministicDelivery.id, updated_at: now,
        } satisfies IntegrationInboxReceipt);
      }
      return { already_processed: true, event_id: event.event_id, delivery_id: deterministicDelivery.id, customer_id: deterministicDelivery.customer_id };
    }

    const customerRef = adminDb.collection('customers').doc(plan.customer.id);
    const customerExists = customers.some((customer) => customer.id === plan.customer.id);
    if (plan.create_customer && customerExists) {
      throw new Error('Customer determinístico já existe sem vínculo esperado; revisão manual necessária.');
    }
    if (!plan.create_customer && !customerExists) {
      throw new Error('Customer planejado não existe no snapshot transacional.');
    }

    // Nenhuma leitura abaixo deste ponto.
    if (plan.create_customer) tx.create(customerRef, firestoreData(plan.customer));
    if (deliverySnap.exists) throw new Error('Delivery externa apareceu durante criação; retry idempotente necessário.');
    tx.create(deliveryRef, firestoreData(plan.delivery));

    if (!orderIdentity) {
      tx.create(orderIdentityRef, buildExternalIdentityLink({
        source_system: 'dfl_site', external_entity_type: 'order', external_entity_id: event.payload.orderId,
        local_entity_type: 'delivery', local_entity_id: plan.delivery.id, now: plan.inbox.updated_at,
      }));
    }

    if (plan.create_customer_identity && plan.external_customer_id && customerIdentityRef) {
      if (customerIdentity) {
        if (!sameLink(customerIdentity, 'customer', plan.customer.id)) throw new Error('Conflito de identidade externa do Customer.');
      } else {
        tx.create(customerIdentityRef, buildExternalIdentityLink({
          source_system: 'dfl_site', external_entity_type: 'customer', external_entity_id: plan.external_customer_id,
          local_entity_type: 'customer', local_entity_id: plan.customer.id, now: plan.inbox.updated_at,
        }));
      }
    }

    if (inboxSnap.exists) tx.set(inboxRef, plan.inbox, { merge: true });
    else tx.create(inboxRef, plan.inbox);

    return { already_processed: false, event_id: event.event_id, delivery_id: plan.delivery.id, customer_id: plan.customer.id };
  });
}


export interface PersistedSiteOrderUpdatedResult {
  already_processed: boolean;
  stale_ignored: boolean;
  event_id: string;
  delivery_id: string;
  customer_id: string;
  site_order_status: string;
}

function eventClock(event: DflSiteOrderUpdatedEvent) {
  const timestamp = event.payload.statusUpdatedAt || event.occurred_at;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) throw new Error('Timestamp comercial inválido em order.updated.');
  return { timestamp: new Date(time).toISOString(), time, eventId: event.event_id };
}

function storedCommercialClock(delivery: Delivery) {
  const raw = delivery.site_order_last_event_at || delivery.site_order_status_updated_at || null;
  if (!raw) return null;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) throw new Error('Delivery possui timestamp comercial inválido.');
  return { timestamp: new Date(time).toISOString(), time, eventId: delivery.site_order_last_event_id || '' };
}

function incomingWins(incoming: ReturnType<typeof eventClock>, current: ReturnType<typeof storedCommercialClock>) {
  if (!current) return true;
  if (incoming.time !== current.time) return incoming.time > current.time;
  return incoming.eventId.localeCompare(current.eventId) > 0;
}

export async function consumeDflSiteOrderUpdatedPersisted(rawEvent: unknown): Promise<PersistedSiteOrderUpdatedResult> {
  assertDflSiteOrderUpdatedEvent(rawEvent);
  const event: DflSiteOrderUpdatedEvent = rawEvent;

  return adminDb.runTransaction(async (tx) => {
    const inboxRef = adminDb.collection(INTEGRATION_COLLECTIONS.inbox).doc(encodeDocId(event.event_id));
    const orderIdentityRef = adminDb.collection(INTEGRATION_COLLECTIONS.identities).doc(externalIdentityLinkId({
      source_system: 'dfl_site', external_entity_type: 'order', external_entity_id: event.payload.orderId,
    }));
    const deliveryRef = adminDb.collection('deliveries').doc(siteDeliveryId(event.payload.orderId));

    // Todas as leituras acontecem antes de qualquer escrita.
    const [inboxSnap, identitySnap, deliverySnap] = await Promise.all([
      tx.get(inboxRef), tx.get(orderIdentityRef), tx.get(deliveryRef),
    ]);

    const delivery = deliverySnap.exists ? asDelivery(deliverySnap.id, deliverySnap.data()!) : null;
    if (inboxSnap.exists) {
      const receipt = inboxSnap.data() as IntegrationInboxReceipt;
      if (receipt.status === 'processed' && receipt.event_id === event.event_id &&
          receipt.local_entity_type === 'delivery' && receipt.local_entity_id === deliveryRef.id && delivery) {
        return { already_processed: true, stale_ignored: false, event_id: event.event_id, delivery_id: delivery.id,
          customer_id: delivery.customer_id, site_order_status: delivery.site_order_status || event.payload.status };
      }
      throw new Error('event_id já existe no inbox em estado incompatível.');
    }

    if (!identitySnap.exists) throw new Error('order.updated recebido antes de order.created/ExternalIdentity.');
    const identity = identitySnap.data() as ExternalIdentityLink;
    if (!sameLink(identity, 'delivery', deliveryRef.id) || identity.source_system !== 'dfl_site' ||
        identity.external_entity_type !== 'order' || identity.external_entity_id !== event.payload.orderId) {
      throw new Error('ExternalIdentity do pedido está inconsistente.');
    }
    if (!delivery) throw new Error('ExternalIdentity do pedido aponta para Delivery inexistente.');
    if (delivery.source_system !== 'dfl_site' || delivery.external_order_id !== event.payload.orderId) {
      throw new Error('Delivery vinculada diverge do pedido externo.');
    }

    const now = new Date().toISOString();
    const incoming = eventClock(event);
    const current = storedCommercialClock(delivery);
    const applyIncoming = incomingWins(incoming, current);

    // Evento atrasado é consumido/auditado, mas NÃO pode regredir o snapshot comercial.
    if (applyIncoming) {
      tx.update(deliveryRef, firestoreData({
        site_order_status: event.payload.status,
        site_order_status_updated_at: event.payload.statusUpdatedAt,
        site_order_last_event_at: incoming.timestamp,
        site_order_last_event_id: event.event_id,
        external_order_schema_version: event.payload.orderSchemaVersion,
        updated_at: now,
      }));
    }

    const receipt = {
      event_id: event.event_id, event_type: event.event_type, source_system: event.source_system,
      entity_type: event.entity_type, entity_id: event.entity_id, schema_version: event.schema_version,
      received_at: now, processed_at: now, status: 'processed' as const,
      local_entity_type: 'delivery' as const, local_entity_id: delivery.id, updated_at: now,
      processing_outcome: applyIncoming ? 'applied' : 'ignored_stale',
      incoming_event_at: incoming.timestamp,
      ...(current ? { previous_event_at: current.timestamp } : {}),
      ...(current?.eventId ? { previous_event_id: current.eventId } : {}),
    };
    tx.create(inboxRef, firestoreData(receipt));

    return {
      already_processed: false,
      stale_ignored: !applyIncoming,
      event_id: event.event_id,
      delivery_id: delivery.id,
      customer_id: delivery.customer_id,
      site_order_status: applyIncoming ? event.payload.status : (delivery.site_order_status || event.payload.status),
    };
  });
}
