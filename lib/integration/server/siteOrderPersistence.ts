import 'server-only';
import type { Customer, Delivery } from '@/types';
import type { ExternalIdentityLink, IntegrationInboxReceipt } from '../contracts';
import { planDflSiteOrderCreated } from '../consumer';
import { assertDflSiteOrderCreatedEvent, siteDeliveryId, type DflSiteOrderCreatedEvent } from '../site-order';
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
    if (plan.create_customer) tx.create(customerRef, plan.customer as FirebaseFirestore.DocumentData);
    if (deliverySnap.exists) throw new Error('Delivery externa apareceu durante criação; retry idempotente necessário.');
    tx.create(deliveryRef, plan.delivery as FirebaseFirestore.DocumentData);

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
