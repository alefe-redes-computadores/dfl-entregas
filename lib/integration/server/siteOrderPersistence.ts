import 'server-only';
import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import type { Customer, Delivery } from '@/types';
import type {
  ExternalIdentityLink,
  IntegrationInboxReceipt,
} from '../contracts';
import {
  assertDflSiteOrderCreatedEvent,
  assertDflSiteOrderUpdatedEvent,
  customerDraftFromSite,
  commercialSnapshotFromSite,
  deliveryDraftFromSite,
  dflSiteAddressString,
  normalizeSitePaymentMethod,
  siteDeliveryId,
  siteGuestCustomerId,
  siteOrderItemsFromPayload,
  type DflSiteOrderCreatedEvent,
  type DflSiteOrderUpdatedEvent,
} from '../site-order';
import {
  buildExternalIdentityLink,
  externalIdentityLinkId,
  INTEGRATION_COLLECTIONS,
} from '../identity';
import { adminDb } from './admin';

const encodeDocId = (value: string) => {
  const id = encodeURIComponent(value.trim());
  if (!id || id.length > 1400) {
    throw new Error('event_id inválido para inbox.');
  }
  return id;
};

const asCustomer = (id: string, data: DocumentData): Customer =>
  ({ id, ...data }) as Customer;

const asDelivery = (id: string, data: DocumentData): Delivery =>
  ({ id, ...data }) as Delivery;

function sameLink(
  link: ExternalIdentityLink,
  type: 'delivery' | 'customer',
  id: string,
) {
  return link.local_entity_type === type && link.local_entity_id === id;
}

// Firestore Admin rejeita propriedades undefined por padrão.
function firestoreData<T>(value: T): DocumentData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value as DocumentData;
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

function normalizeDigits(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

function phoneCandidates(value?: string | null): string[] {
  const digits = normalizeDigits(value);
  if (!digits) return [];

  const candidates = new Set<string>([digits]);

  // Site pode mandar E.164 (+55...) enquanto cadastros antigos do Entregas
  // podem ter sido salvos somente com DDD+número.
  if (digits.startsWith('55') && digits.length >= 12) {
    candidates.add(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    candidates.add(`55${digits}`);
  }

  return [...candidates];
}

function storedPhoneForms(value?: string | null): string[] {
  const forms = new Set<string>();

  for (const candidate of phoneCandidates(value)) {
    forms.add(candidate);
    forms.add(`+${candidate}`);

    const local =
      candidate.startsWith('55') && (candidate.length === 12 || candidate.length === 13)
        ? candidate.slice(2)
        : candidate;

    if (local.length === 10 || local.length === 11) {
      const ddd = local.slice(0, 2);
      const number = local.slice(2);
      const prefix = number.length === 9 ? number.slice(0, 5) : number.slice(0, 4);
      const suffix = number.length === 9 ? number.slice(5) : number.slice(4);

      forms.add(local);
      forms.add(`${ddd}${number}`);
      forms.add(`(${ddd}) ${prefix}-${suffix}`);
      forms.add(`(${ddd})${prefix}-${suffix}`);
      forms.add(`${ddd} ${prefix}-${suffix}`);
      forms.add(`${ddd} ${number}`);
      forms.add(`55${local}`);
      forms.add(`+55${local}`);
      forms.add(`+55 (${ddd}) ${prefix}-${suffix}`);
    }
  }

  return [...forms].filter(Boolean);
}

function normalizeComparable(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function incomingAddress(event: DflSiteOrderCreatedEvent): string {
  if (event.payload.tipoEntrega !== 'delivery') return '';
  return dflSiteAddressString(event.payload.deliverySnapshot);
}

function customerMatchesAddress(
  customer: Customer,
  address: string,
): boolean {
  if (!address) return false;

  const local = normalizeComparable(customer.address);
  const incoming = normalizeComparable(address);
  if (!local || !incoming) return false;

  return local === incoming;
}

function uniqueCustomers(
  snapshots: Array<QueryDocumentSnapshot<DocumentData>>,
): Customer[] {
  const byId = new Map<string, Customer>();
  for (const snapshot of snapshots) {
    byId.set(snapshot.id, asCustomer(snapshot.id, snapshot.data()));
  }
  return [...byId.values()];
}

async function findCustomerByPhone(
  tx: Transaction,
  phone?: string | null,
): Promise<Customer | null> {
  const rawForms = storedPhoneForms(phone);
  if (rawForms.length === 0) return null;

  const snapshots: Array<QueryDocumentSnapshot<DocumentData>> = [];

  // Continua sem full scan: consultas pontuais cobrem E.164, somente dígitos
  // e os formatos brasileiros que o app historicamente aceitou nos cadastros.
  for (const raw of rawForms) {
    const query = adminDb
      .collection('customers')
      .where('phone', '==', raw)
      .limit(2);
    const snap = await tx.get(query);
    snapshots.push(...snap.docs);
  }

  const matches = uniqueCustomers(snapshots);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      'Mais de um Customer local possui o mesmo telefone; associação automática recusada.',
    );
  }

  return matches[0];
}

function assertCustomerIdentity(
  identity: ExternalIdentityLink,
  externalCustomerId: string,
) {
  if (
    identity.source_system !== 'dfl_site' ||
    identity.external_entity_type !== 'customer' ||
    identity.external_entity_id !== externalCustomerId ||
    identity.local_entity_type !== 'customer'
  ) {
    throw new Error('ExternalIdentityLink de Customer inconsistente.');
  }
}

function createdInbox(
  event: DflSiteOrderCreatedEvent,
  deliveryId: string,
  now: string,
): IntegrationInboxReceipt {
  return {
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
    local_entity_id: deliveryId,
    updated_at: now,
  };
}

export interface PersistedSiteOrderResult {
  already_processed: boolean;
  event_id: string;
  delivery_id: string;
  customer_id: string;
}

export async function consumeDflSiteOrderCreatedPersisted(
  rawEvent: unknown,
): Promise<PersistedSiteOrderResult> {
  assertDflSiteOrderCreatedEvent(rawEvent);
  const event: DflSiteOrderCreatedEvent = rawEvent;
  const externalCustomerId =
    event.payload.customerSnapshot?.id?.trim() || undefined;
  const deterministicDeliveryId = siteDeliveryId(event.payload.orderId);

  return adminDb.runTransaction(async (tx: Transaction) => {
    const inboxRef = adminDb
      .collection(INTEGRATION_COLLECTIONS.inbox)
      .doc(encodeDocId(event.event_id));

    const orderIdentityRef = adminDb
      .collection(INTEGRATION_COLLECTIONS.identities)
      .doc(
        externalIdentityLinkId({
          source_system: 'dfl_site',
          external_entity_type: 'order',
          external_entity_id: event.payload.orderId,
        }),
      );

    const deliveryRef = adminDb
      .collection('deliveries')
      .doc(deterministicDeliveryId);

    const customerIdentityRef = externalCustomerId
      ? adminDb
          .collection(INTEGRATION_COLLECTIONS.identities)
          .doc(
            externalIdentityLinkId({
              source_system: 'dfl_site',
              external_entity_type: 'customer',
              external_entity_id: externalCustomerId,
            }),
          )
      : null;

    // Fase 1: somente documentos determinísticos.
    const [
      inboxSnap,
      orderIdentitySnap,
      deliverySnap,
      customerIdentitySnap,
    ] = await Promise.all([
      tx.get(inboxRef),
      tx.get(orderIdentityRef),
      tx.get(deliveryRef),
      customerIdentityRef
        ? tx.get(customerIdentityRef)
        : Promise.resolve(null),
    ]);

    const inbox = inboxSnap.exists
      ? (inboxSnap.data() as IntegrationInboxReceipt)
      : null;
    const orderIdentity = orderIdentitySnap.exists
      ? (orderIdentitySnap.data() as ExternalIdentityLink)
      : null;
    const customerIdentity = customerIdentitySnap?.exists
      ? (customerIdentitySnap.data() as ExternalIdentityLink)
      : null;
    const deterministicDelivery: Delivery | null = deliverySnap.exists
      ? asDelivery(deliverySnap.id, deliverySnap.data()!)
      : null;

    if (
      orderIdentity &&
      !sameLink(orderIdentity, 'delivery', deterministicDeliveryId)
    ) {
      throw new Error(
        'Conflito: pedido externo já aponta para outra entidade local.',
      );
    }

    if (
      inbox?.status === 'processed' &&
      inbox.local_entity_type === 'delivery' &&
      inbox.local_entity_id
    ) {
      if (
        !deterministicDelivery ||
        deterministicDelivery.id !== inbox.local_entity_id
      ) {
        throw new Error(
          'Inbox processada aponta para Delivery inexistente/divergente.',
        );
      }

      return {
        already_processed: true,
        event_id: event.event_id,
        delivery_id: deterministicDelivery.id,
        customer_id: deterministicDelivery.customer_id,
      };
    }

    // Delivery determinística já existente = retry/recuperação.
    if (deterministicDelivery) {
      if (
        deterministicDelivery.source_system !== 'dfl_site' ||
        deterministicDelivery.external_order_id !== event.payload.orderId
      ) {
        throw new Error(
          'Delivery determinística existente diverge do pedido externo.',
        );
      }

      const now = new Date().toISOString();

      if (!orderIdentity) {
        tx.create(
          orderIdentityRef,
          buildExternalIdentityLink({
            source_system: 'dfl_site',
            external_entity_type: 'order',
            external_entity_id: event.payload.orderId,
            local_entity_type: 'delivery',
            local_entity_id: deterministicDelivery.id,
            now,
          }),
        );
      }

      if (!inboxSnap.exists) {
        tx.create(
          inboxRef,
          createdInbox(event, deterministicDelivery.id, now),
        );
      }

      return {
        already_processed: true,
        event_id: event.event_id,
        delivery_id: deterministicDelivery.id,
        customer_id: deterministicDelivery.customer_id,
      };
    }

    let customer: Customer | null = null;
    let createCustomer = false;
    let createCustomerIdentity = false;
    let customerRef: DocumentReference<DocumentData> | null = null;

    // Vínculo externo já criado é a autoridade.
    if (externalCustomerId && customerIdentity) {
      assertCustomerIdentity(customerIdentity, externalCustomerId);

      customerRef = adminDb
        .collection('customers')
        .doc(customerIdentity.local_entity_id);

      const linkedSnap = await tx.get(customerRef);
      if (!linkedSnap.exists) {
        throw new Error(
          'Identidade externa aponta para Customer local inexistente.',
        );
      }

      customer = asCustomer(linkedSnap.id, linkedSnap.data()!);
    }

    // Primeira associação: telefone é o identificador conservador disponível
    // no contrato atual. Nome sozinho nunca é usado.
    if (!customer && event.payload.customerSnapshot) {
      const phone =
        event.payload.customerSnapshot.phoneE164 ||
        event.payload.customerSnapshot.phone ||
        undefined;

      const byPhone = await findCustomerByPhone(tx, phone);

      if (byPhone) {
        const address = incomingAddress(event);

        // Telefone identifica; endereço, quando existe dos dois lados,
        // funciona como trava contra associação contraditória.
        if (
          address &&
          byPhone.address &&
          !customerMatchesAddress(byPhone, address)
        ) {
          throw new Error(
            'Customer com mesmo telefone possui endereço divergente; associação automática recusada.',
          );
        }

        customer = byPhone;
        customerRef = adminDb.collection('customers').doc(byPhone.id);
        createCustomerIdentity = Boolean(externalCustomerId);
      }
    }

    if (!customer) {
      const newId = externalCustomerId
        ? `site-customer-v1__${encodeURIComponent(externalCustomerId)}`
        : siteGuestCustomerId(event.payload.orderId);

      customerRef = adminDb.collection('customers').doc(newId);

      // Leitura pontual protege contra colisão do ID determinístico.
      const deterministicCustomerSnap: DocumentSnapshot<DocumentData> =
        await tx.get(customerRef);

      if (deterministicCustomerSnap.exists) {
        customer = asCustomer(
          deterministicCustomerSnap.id,
          deterministicCustomerSnap.data()!,
        );

        if (!externalCustomerId) {
          throw new Error(
            'Customer guest determinístico já existe sem Delivery; revisão manual necessária.',
          );
        }

        createCustomerIdentity = true;
      } else {
        const now = new Date().toISOString();
        customer = customerDraftFromSite(event.payload, newId, now);
        createCustomer = true;
        createCustomerIdentity = Boolean(externalCustomerId);
      }
    }

    if (!customer || !customerRef) {
      throw new Error('Falha ao resolver Customer do pedido externo.');
    }

    const now = new Date().toISOString();
    const delivery = deliveryDraftFromSite(
      event.payload,
      customer.id,
      now,
    );
    const inboxReceipt = createdInbox(event, delivery.id, now);

    // Todas as leituras terminaram acima. A partir daqui, somente escritas.
    if (createCustomer) {
      tx.create(customerRef, firestoreData(customer));
    }

    tx.create(deliveryRef, firestoreData(delivery));

    if (!orderIdentity) {
      tx.create(
        orderIdentityRef,
        buildExternalIdentityLink({
          source_system: 'dfl_site',
          external_entity_type: 'order',
          external_entity_id: event.payload.orderId,
          local_entity_type: 'delivery',
          local_entity_id: delivery.id,
          now,
        }),
      );
    }

    if (
      createCustomerIdentity &&
      externalCustomerId &&
      customerIdentityRef
    ) {
      if (customerIdentity) {
        if (!sameLink(customerIdentity, 'customer', customer.id)) {
          throw new Error(
            'Conflito de identidade externa do Customer.',
          );
        }
      } else {
        tx.create(
          customerIdentityRef,
          buildExternalIdentityLink({
            source_system: 'dfl_site',
            external_entity_type: 'customer',
            external_entity_id: externalCustomerId,
            local_entity_type: 'customer',
            local_entity_id: customer.id,
            now,
          }),
        );
      }
    }

    if (inboxSnap.exists) {
      tx.set(inboxRef, inboxReceipt, { merge: true });
    } else {
      tx.create(inboxRef, inboxReceipt);
    }

    return {
      already_processed: false,
      event_id: event.event_id,
      delivery_id: delivery.id,
      customer_id: customer.id,
    };
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
  if (!Number.isFinite(time)) {
    throw new Error('Timestamp comercial inválido em order.updated.');
  }
  return {
    timestamp: new Date(time).toISOString(),
    time,
    eventId: event.event_id,
  };
}

function storedCommercialClock(delivery: Delivery) {
  const raw =
    delivery.site_order_last_event_at ||
    delivery.site_order_status_updated_at ||
    null;

  if (!raw) return null;

  const time = Date.parse(raw);
  if (!Number.isFinite(time)) {
    throw new Error('Delivery possui timestamp comercial inválido.');
  }

  return {
    timestamp: new Date(time).toISOString(),
    time,
    eventId: delivery.site_order_last_event_id || '',
  };
}

function incomingWins(
  incoming: ReturnType<typeof eventClock>,
  current: ReturnType<typeof storedCommercialClock>,
) {
  if (!current) return true;
  if (incoming.time !== current.time) return incoming.time > current.time;
  return incoming.eventId.localeCompare(current.eventId) > 0;
}

export async function consumeDflSiteOrderUpdatedPersisted(
  rawEvent: unknown,
): Promise<PersistedSiteOrderUpdatedResult> {
  assertDflSiteOrderUpdatedEvent(rawEvent);
  const event: DflSiteOrderUpdatedEvent = rawEvent;

  return adminDb.runTransaction(async (tx: Transaction) => {
    const inboxRef = adminDb
      .collection(INTEGRATION_COLLECTIONS.inbox)
      .doc(encodeDocId(event.event_id));

    const orderIdentityRef = adminDb
      .collection(INTEGRATION_COLLECTIONS.identities)
      .doc(
        externalIdentityLinkId({
          source_system: 'dfl_site',
          external_entity_type: 'order',
          external_entity_id: event.payload.orderId,
        }),
      );

    const deliveryRef = adminDb
      .collection('deliveries')
      .doc(siteDeliveryId(event.payload.orderId));

    const [inboxSnap, identitySnap, deliverySnap] = await Promise.all([
      tx.get(inboxRef),
      tx.get(orderIdentityRef),
      tx.get(deliveryRef),
    ]);

    const delivery: Delivery | null = deliverySnap.exists
      ? asDelivery(deliverySnap.id, deliverySnap.data()!)
      : null;

    if (inboxSnap.exists) {
      const receipt = inboxSnap.data() as IntegrationInboxReceipt;

      if (
        receipt.status === 'processed' &&
        receipt.event_id === event.event_id &&
        receipt.local_entity_type === 'delivery' &&
        receipt.local_entity_id === deliveryRef.id &&
        delivery
      ) {
        return {
          already_processed: true,
          stale_ignored: false,
          event_id: event.event_id,
          delivery_id: delivery.id,
          customer_id: delivery.customer_id,
          site_order_status:
            delivery.site_order_status || event.payload.status,
        };
      }

      throw new Error(
        'event_id já existe no inbox em estado incompatível.',
      );
    }

    if (!identitySnap.exists) {
      throw new Error(
        'order.updated recebido antes de order.created/ExternalIdentity.',
      );
    }

    const identity = identitySnap.data() as ExternalIdentityLink;

    if (
      !sameLink(identity, 'delivery', deliveryRef.id) ||
      identity.source_system !== 'dfl_site' ||
      identity.external_entity_type !== 'order' ||
      identity.external_entity_id !== event.payload.orderId
    ) {
      throw new Error('ExternalIdentity do pedido está inconsistente.');
    }

    if (!delivery) {
      throw new Error(
        'ExternalIdentity do pedido aponta para Delivery inexistente.',
      );
    }

    if (
      delivery.source_system !== 'dfl_site' ||
      delivery.external_order_id !== event.payload.orderId
    ) {
      throw new Error('Delivery vinculada diverge do pedido externo.');
    }

    const now = new Date().toISOString();
    const incoming = eventClock(event);
    const current = storedCommercialClock(delivery);
    const applyIncoming = incomingWins(incoming, current);

    if (applyIncoming) {
      const normalizedIncomingStatus = event.payload.status
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim();
      const siteFinalized =
        normalizedIncomingStatus.includes('final') ||
        normalizedIncomingStatus.includes('conclu');

      tx.update(
        deliveryRef,
        firestoreData({
          site_order_status: event.payload.status,
          // Sem rota real, a conclusao comercial pode encerrar a pendencia
          // operacional sem fabricar rota/saida/next-stop.
          ...(siteFinalized && !delivery.route_id && !delivery.completed ? {
            completed: true,
            completed_at: incoming.timestamp,
            operational_completion_source: 'dfl_site',
            operational_completion_pending_route: false,
          } : {}),
          site_order_status_updated_at: event.payload.statusUpdatedAt,
          site_order_last_event_at: incoming.timestamp,
          site_order_last_event_id: event.event_id,
          external_order_schema_version: event.payload.orderSchemaVersion,
          site_order_items: siteOrderItemsFromPayload(event.payload.itens),
          site_order_subtotal: event.payload.subtotal,
          site_order_delivery_fee: event.payload.taxaEntrega,
          site_order_discount: event.payload.desconto,
          site_order_coupon: typeof event.payload.cupom === 'string' && event.payload.cupom.trim() ? event.payload.cupom.trim() : null,
          site_order_reward_id: typeof event.payload.rewardId === 'string' && event.payload.rewardId.trim() ? event.payload.rewardId.trim() : null,
          site_order_commercial: commercialSnapshotFromSite(event.payload),
          value: event.payload.total,
          customer_charge: event.payload.total,
          payment_method: normalizeSitePaymentMethod(event.payload.metodoPagamento),
          change_for: event.payload.trocoPara ?? null,
          updated_at: now,
        }),
      );
    }

    const receipt = {
      event_id: event.event_id,
      event_type: event.event_type,
      source_system: event.source_system,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      schema_version: event.schema_version,
      received_at: now,
      processed_at: now,
      status: 'processed' as const,
      local_entity_type: 'delivery' as const,
      local_entity_id: delivery.id,
      updated_at: now,
      processing_outcome: applyIncoming ? 'applied' : 'ignored_stale',
      incoming_event_at: incoming.timestamp,
      ...(current ? { previous_event_at: current.timestamp } : {}),
      ...(current?.eventId
        ? { previous_event_id: current.eventId }
        : {}),
    };

    tx.create(inboxRef, firestoreData(receipt));

    return {
      already_processed: false,
      stale_ignored: !applyIncoming,
      event_id: event.event_id,
      delivery_id: delivery.id,
      customer_id: delivery.customer_id,
      site_order_status: applyIncoming
        ? event.payload.status
        : delivery.site_order_status || event.payload.status,
    };
  });
}
