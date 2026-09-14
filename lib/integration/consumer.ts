// lib/integration/consumer.ts
import type { Customer, Delivery } from '@/types';
import { findExistingCustomer } from '@/lib/customer-identity';

import type {
  ExternalIdentityLink,
  IntegrationInboxReceipt,
} from './contracts';

import {
  assertDflSiteOrderCreatedEvent,
  customerDraftFromSite,
  deliveryDraftFromSite,
  siteGuestCustomerId,
  type DflSiteOrderCreatedEvent,
} from './site-order';

export type OrderCreatedConsumerResult =
  | {
      kind: 'already_processed';
      event_id: string;
      delivery_id: string;
      customer_id?: string;
    }
  | {
      kind: 'create';
      event: DflSiteOrderCreatedEvent;
      delivery: Delivery;
      customer: Customer;
      create_customer: boolean;
      create_customer_identity: boolean;
      external_customer_id?: string;
      inbox: IntegrationInboxReceipt;
    };

export interface OrderCreatedConsumerContext {
  customers: Customer[];
  deliveries: Delivery[];
  inboxReceipt?: IntegrationInboxReceipt | null;
  customerIdentity?: ExternalIdentityLink | null;
  orderIdentity?: ExternalIdentityLink | null;
  now?: string;
}

function processedDeliveryId(
  receipt?: IntegrationInboxReceipt | null,
  orderIdentity?: ExternalIdentityLink | null,
): string | undefined {
  if (
    receipt?.status === 'processed' &&
    receipt.local_entity_type === 'delivery' &&
    receipt.local_entity_id
  ) {
    return receipt.local_entity_id;
  }

  if (
    orderIdentity?.local_entity_type === 'delivery' &&
    orderIdentity.local_entity_id
  ) {
    return orderIdentity.local_entity_id;
  }

  return undefined;
}

export function planDflSiteOrderCreated(
  rawEvent: unknown,
  context: OrderCreatedConsumerContext,
): OrderCreatedConsumerResult {
  assertDflSiteOrderCreatedEvent(rawEvent);

  const event = rawEvent;
  const payload = event.payload;
  const now = context.now || new Date().toISOString();

  const knownDeliveryId = processedDeliveryId(
    context.inboxReceipt,
    context.orderIdentity,
  );

  if (knownDeliveryId) {
    return {
      kind: 'already_processed',
      event_id: event.event_id,
      delivery_id: knownDeliveryId,
      customer_id:
        context.customerIdentity?.local_entity_type === 'customer'
          ? context.customerIdentity.local_entity_id
          : undefined,
    };
  }

  const duplicateDelivery = context.deliveries.find(
    (delivery) =>
      delivery.source_system === 'dfl_site' &&
      delivery.external_order_id === payload.orderId,
  );

  if (duplicateDelivery) {
    return {
      kind: 'already_processed',
      event_id: event.event_id,
      delivery_id: duplicateDelivery.id,
      customer_id: duplicateDelivery.customer_id,
    };
  }

  const externalCustomerId =
    payload.customerSnapshot?.id?.trim() || undefined;

  let customer: Customer | undefined;
  let createCustomer = false;
  let createCustomerIdentity = false;

  if (externalCustomerId && context.customerIdentity) {
    if (
      context.customerIdentity.source_system !== 'dfl_site' ||
      context.customerIdentity.external_entity_type !== 'customer' ||
      context.customerIdentity.external_entity_id !== externalCustomerId ||
      context.customerIdentity.local_entity_type !== 'customer'
    ) {
      throw new Error('ExternalIdentityLink de Customer inconsistente.');
    }

    customer = context.customers.find(
      (item) => item.id === context.customerIdentity?.local_entity_id,
    );

    if (!customer) {
      throw new Error(
        'Identidade externa aponta para Customer local inexistente.',
      );
    }
  }

  if (!customer && payload.customerSnapshot) {
    const address =
      payload.tipoEntrega === 'delivery'
        ? [
            payload.deliverySnapshot?.street,
            payload.deliverySnapshot?.number,
            payload.deliverySnapshot?.district,
          ]
            .filter(Boolean)
            .join(', ')
        : undefined;

    const phone =
      payload.customerSnapshot.phoneE164 ||
      payload.customerSnapshot.phone ||
      undefined;

    customer = findExistingCustomer(
      context.customers,
      payload.customerSnapshot.name,
      { address, phone },
    );

    if (customer) {
      createCustomerIdentity = Boolean(externalCustomerId);
    }
  }

  if (!customer) {
    const newId = externalCustomerId
      ? `site-customer-v1__${encodeURIComponent(externalCustomerId)}`
      : siteGuestCustomerId(payload.orderId);

    customer = customerDraftFromSite(payload, newId, now);
    createCustomer = true;
    createCustomerIdentity = Boolean(externalCustomerId);
  }

  const delivery = deliveryDraftFromSite(
    payload,
    customer.id,
    now,
  );

  const inbox: IntegrationInboxReceipt = {
    event_id: event.event_id,
    event_type: event.event_type,
    source_system: event.source_system,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    schema_version: event.schema_version,
    received_at: now,
    processed_at: now,
    status: 'processed',
    local_entity_type: 'delivery',
    local_entity_id: delivery.id,
    updated_at: now,
  };

  return {
    kind: 'create',
    event,
    delivery,
    customer,
    create_customer: createCustomer,
    create_customer_identity: createCustomerIdentity,
    external_customer_id: externalCustomerId,
    inbox,
  };
}

/**
 * Contrato do boundary que o futuro VPS/API deverá implementar.
 *
 * O core acima NÃO acessa o Firestore do DFL Site e NÃO faz polling.
 * A persistência real deve aplicar, de forma transacional:
 *
 * - inbox receipt por event_id;
 * - order external identity -> Delivery;
 * - customer external identity -> Customer, quando houver;
 * - Customer novo, quando necessário;
 * - Delivery novo.
 *
 * Se inbox/order identity já existirem, deve retornar idempotentemente.
 */
export interface DflSiteOrderCreatedPersistence {
  consumeOrderCreated(
    event: DflSiteOrderCreatedEvent,
  ): Promise<{
    already_processed: boolean;
    delivery_id: string;
    customer_id: string;
  }>;
}
