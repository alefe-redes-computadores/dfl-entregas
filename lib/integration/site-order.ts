// lib/integration/site-order.ts
import type {
  Customer,
  Delivery,
  FulfillmentMode,
  PaymentMethod,
  SiteOrderCommercialSnapshot,
} from '@/types';

import {
  INTEGRATION_SCHEMA_VERSION,
  isIntegrationEventEnvelope,
  type IntegrationEventEnvelope,
} from './contracts';

export interface DflSiteCustomerSnapshotV1 {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
}

export interface DflSiteDeliverySnapshotV1 {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  complement?: string | null;
  reference?: string | null;
}

export interface DflSiteOrderEventPayloadV1 {
  orderId: string;
  sourceSystem: 'dfl_site';
  orderSchemaVersion: number;
  userId: string;

  customerSnapshot: DflSiteCustomerSnapshotV1 | null;
  tipoEntrega: 'delivery' | 'pickup';
  deliverySnapshot: DflSiteDeliverySnapshotV1 | null;

  itens: unknown;
  subtotal: number;
  taxaEntrega: number;
  desconto: number;
  cupom: unknown;
  rewardId: unknown;
  total: number;
  metodoPagamento: string;
  trocoPara: number | null;
  status: string;
  isAgendamento: boolean;

  // order.created nasce antes de qualquer transição administrativa de status.
  // Nesse caso o Site envia null; order.updated poderá trazer timestamp.
  statusUpdatedAt: string | null;
}

export type DflSiteOrderCreatedEvent =
  IntegrationEventEnvelope<DflSiteOrderEventPayloadV1> & {
    event_type: 'order.created';
    source_system: 'dfl_site';
    entity_type: 'order';
    schema_version: typeof INTEGRATION_SCHEMA_VERSION;
  };

export type DflSiteOrderUpdatedEvent =
  IntegrationEventEnvelope<DflSiteOrderEventPayloadV1> & {
    event_type: 'order.updated';
    source_system: 'dfl_site';
    entity_type: 'order';
    schema_version: typeof INTEGRATION_SCHEMA_VERSION;
  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const requiredText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function isCustomerSnapshot(
  value: unknown,
): value is DflSiteCustomerSnapshotV1 {
  if (!isRecord(value)) return false;

  return (
    requiredText(value.id) &&
    requiredText(value.name) &&
    (value.email == null || typeof value.email === 'string') &&
    (value.phone == null || typeof value.phone === 'string') &&
    (value.phoneE164 == null || typeof value.phoneE164 === 'string')
  );
}

function isDeliverySnapshot(
  value: unknown,
): value is DflSiteDeliverySnapshotV1 {
  if (!isRecord(value)) return false;

  return [
    'cep',
    'street',
    'number',
    'district',
    'complement',
    'reference',
  ].every((key) => value[key] == null || typeof value[key] === 'string');
}

export function isDflSiteOrderPayloadV1(
  value: unknown,
): value is DflSiteOrderEventPayloadV1 {
  if (!isRecord(value)) return false;

  const tipoEntrega = value.tipoEntrega;

  if (tipoEntrega !== 'delivery' && tipoEntrega !== 'pickup') {
    return false;
  }

  if (
    tipoEntrega === 'delivery' &&
    !isDeliverySnapshot(value.deliverySnapshot)
  ) {
    return false;
  }

  if (
    tipoEntrega === 'pickup' &&
    value.deliverySnapshot !== null &&
    !isDeliverySnapshot(value.deliverySnapshot)
  ) {
    return false;
  }

  return (
    requiredText(value.orderId) &&
    value.sourceSystem === 'dfl_site' &&
    finiteNumber(value.orderSchemaVersion) &&
    value.orderSchemaVersion >= 1 &&
    requiredText(value.userId) &&
    (value.customerSnapshot === null ||
      isCustomerSnapshot(value.customerSnapshot)) &&
    finiteNumber(value.subtotal) &&
    finiteNumber(value.taxaEntrega) &&
    finiteNumber(value.desconto) &&
    finiteNumber(value.total) &&
    requiredText(value.metodoPagamento) &&
    (value.trocoPara === null || finiteNumber(value.trocoPara)) &&
    requiredText(value.status) &&
    typeof value.isAgendamento === 'boolean' &&
    (value.statusUpdatedAt === null ||
      (typeof value.statusUpdatedAt === 'string' &&
        value.statusUpdatedAt.trim().length > 0))
  );
}

export function assertDflSiteOrderCreatedEvent(
  value: unknown,
): asserts value is DflSiteOrderCreatedEvent {
  if (!isIntegrationEventEnvelope(value)) {
    throw new Error('Envelope de integração inválido.');
  }

  if (value.schema_version !== 1) {
    throw new Error('schema_version não suportado.');
  }

  if (value.source_system !== 'dfl_site') {
    throw new Error('source_system inválido para order.created.');
  }

  if (value.event_type !== 'order.created') {
    throw new Error('Evento não é order.created.');
  }

  if (value.entity_type !== 'order') {
    throw new Error('entity_type inválido para order.created.');
  }

  if (!isDflSiteOrderPayloadV1(value.payload)) {
    throw new Error('Payload DFL Site Order V1 inválido.');
  }

  if (value.entity_id.trim() !== value.payload.orderId.trim()) {
    throw new Error('entity_id e payload.orderId divergem.');
  }
}

export function assertDflSiteOrderUpdatedEvent(
  value: unknown,
): asserts value is DflSiteOrderUpdatedEvent {
  if (!isIntegrationEventEnvelope(value)) throw new Error('Envelope de integração inválido.');
  if (value.schema_version !== 1) throw new Error('schema_version não suportado.');
  if (value.source_system !== 'dfl_site') throw new Error('source_system inválido para order.updated.');
  if (value.event_type !== 'order.updated') throw new Error('Evento não é order.updated.');
  if (value.entity_type !== 'order') throw new Error('entity_type inválido para order.updated.');
  if (!isDflSiteOrderPayloadV1(value.payload)) throw new Error('Payload DFL Site Order V1 inválido.');
  if (value.entity_id.trim() !== value.payload.orderId.trim()) throw new Error('entity_id e payload.orderId divergem.');
}

const text = (value?: string | null) => value?.trim() || '';

export function dflSiteAddressString(
  snapshot: DflSiteDeliverySnapshotV1 | null,
): string {
  if (!snapshot) return '';

  const street = text(snapshot.street);
  const number = text(snapshot.number);
  const district = text(snapshot.district);
  const complement = text(snapshot.complement);
  const reference = text(snapshot.reference);
  const cep = text(snapshot.cep);

  return [
    [street, number].filter(Boolean).join(', '),
    district ? `Bairro ${district}` : '',
    complement,
    reference ? `Ref.: ${reference}` : '',
    cep ? `CEP ${cep}` : '',
  ]
    .filter(Boolean)
    .join(' • ');
}

export function normalizeSitePaymentMethod(
  raw: string,
): PaymentMethod {
  const value = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '_');

  if (value.includes('pix')) return 'pix';
  if (value.includes('dinheiro')) return 'dinheiro';
  if (value.includes('debito')) return 'cartao_debito';
  if (value.includes('credito')) return 'cartao_credito';
  if (value.includes('cartao')) return 'cartao';

  throw new Error(
    `Método de pagamento do Site não suportado: ${raw}`,
  );
}

const safeIdPart = (value: string) =>
  encodeURIComponent(value.trim());

export function siteDeliveryId(orderId: string): string {
  const clean = orderId.trim();
  if (!clean) throw new Error('orderId vazio.');

  const id = `site-order-v1__${safeIdPart(clean)}`;

  if (id.length > 1400) {
    throw new Error('ID externo excede limite seguro.');
  }

  return id;
}

export function siteGuestCustomerId(orderId: string): string {
  return `site-guest-v1__${safeIdPart(orderId)}`;
}

export function fulfillmentFromSite(
  tipoEntrega: DflSiteOrderEventPayloadV1['tipoEntrega'],
): FulfillmentMode {
  return tipoEntrega === 'pickup' ? 'pickup' : 'delivery';
}

export function customerDraftFromSite(
  payload: DflSiteOrderEventPayloadV1,
  id: string,
  now: string,
): Customer {
  const snapshot = payload.customerSnapshot;
  const address =
    payload.tipoEntrega === 'delivery'
      ? dflSiteAddressString(payload.deliverySnapshot)
      : undefined;

  return {
    id,
    name: snapshot?.name?.trim() || 'Cliente do Site',
    phone:
      snapshot?.phoneE164?.trim() ||
      snapshot?.phone?.trim() ||
      undefined,
    origin: 'loja',
    address: address || undefined,
    createdAt: now,
    updated_at: now,
  };
}

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const moneyValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const positiveQuantity = (value: unknown): number => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
};

function normalizeSiteAddons(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'string') {
      const name = item.trim();
      return name ? [{ id: `legacy-${index}`, name, price: 0 }] : [];
    }
    const raw = recordValue(item);
    if (!raw) return [];
    const name = optionalString(raw.name ?? raw.nome);
    if (!name) return [];
    return [{ id: optionalString(raw.id), name, price: moneyValue(raw.price ?? raw.preco) }];
  });
}

export function commercialSnapshotFromSite(payload: DflSiteOrderEventPayloadV1): SiteOrderCommercialSnapshot {
  const source = Array.isArray(payload.itens) ? payload.itens : [];
  const items = source.flatMap((item) => {
    const raw = recordValue(item);
    if (!raw) return [];
    const name = optionalString(raw.name ?? raw.nome);
    if (!name) return [];
    const quantity = positiveQuantity(raw.quantity ?? raw.qtd);
    const unitPrice = moneyValue(raw.price ?? raw.preco);
    return [{
      id: optionalString(raw.id), name, quantity, unit_price: unitPrice, line_total: unitPrice * quantity,
      selected_addons: normalizeSiteAddons(raw.selectedAddons ?? raw.adicionais),
      observation: optionalString(raw.observation ?? raw.observacao),
    }];
  });
  return {
    schema_version: 1, items, subtotal: payload.subtotal, delivery_fee: payload.taxaEntrega,
    discount: payload.desconto, coupon_code: optionalString(payload.cupom), reward_id: optionalString(payload.rewardId),
    total: payload.total, payment_method_raw: payload.metodoPagamento, change_for: payload.trocoPara ?? undefined,
    scheduled: payload.isAgendamento,
  };
}

const siteRecord=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const siteText=(v:unknown)=>String(v??'').trim();
const siteMoney=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export function siteOrderItemsFromPayload(value:unknown):import('@/types').SiteOrderItemSnapshot[]{
 if(!Array.isArray(value))return[];
 return value.flatMap(raw=>{const i=siteRecord(raw),id=siteText(i.id),name=siteText(i.name);if(!id||!name)return[];const quantity=Math.max(1,Math.trunc(siteMoney(i.quantity)||1));const unitPrice=Math.max(0,siteMoney(i.unitPrice??i.price));const detailsItems=Array.isArray(i.detailsItems)?i.detailsItems.map(siteText).filter(Boolean):[];const selectedAddons=Array.isArray(i.selectedAddons)?i.selectedAddons.flatMap(a=>{const x=siteRecord(a),aid=siteText(x.id),an=siteText(x.name);return aid&&an?[{id:aid,name:an,price:Math.max(0,siteMoney(x.price))}]:[]}):[];return[{
  id,
  name,
  quantity,

  // Formato canônico V22.3R
  unit_price: unitPrice,
  line_total: Math.max(0, siteMoney(i.lineTotal) || unitPrice * quantity),
  selected_addons: selectedAddons,
  observation: siteText(i.observation) || undefined,
  details_title: siteText(i.detailsTitle) || undefined,
  details_items: detailsItems,
  included_extras: siteText(i.includedExtras) || undefined,

  // Compatibilidade temporária com V22.3
  unitPrice,
  lineTotal: Math.max(0, siteMoney(i.lineTotal) || unitPrice * quantity),
  detailsTitle: siteText(i.detailsTitle) || null,
  detailsItems,
  includedExtras: siteText(i.includedExtras) || null,
  selectedAddons,
}]});
}
export function isSiteOrderAwaitingConfirmation(delivery:Pick<Delivery,'source_system'|'site_order_status'>){return delivery.source_system==='dfl_site'&&(delivery.site_order_status||'').trim().toLocaleLowerCase('pt-BR')==='pendente'}

export function deliveryDraftFromSite(
  payload: DflSiteOrderEventPayloadV1,
  customerId: string,
  now: string,
): Delivery {
  const fulfillmentMode = fulfillmentFromSite(payload.tipoEntrega);
  const customerName = payload.customerSnapshot?.name?.trim();
  const phone =
    payload.customerSnapshot?.phoneE164?.trim() ||
    payload.customerSnapshot?.phone?.trim();

  const address =
    fulfillmentMode === 'delivery'
      ? dflSiteAddressString(payload.deliverySnapshot)
      : '';

  return {
    id: siteDeliveryId(payload.orderId),
    route_id: '',
    fulfillment_mode: fulfillmentMode,

    // NÃO definir stop_group_id aqui.
    // Pedido externo independente continua parada independente
    // até uma decisão operacional explícita.
    origin: 'loja',
    source_system: 'dfl_site',
    external_order_id: payload.orderId,
    external_order_schema_version: payload.orderSchemaVersion,
    site_order_commercial: commercialSnapshotFromSite(payload),
    site_order_status: payload.status,
    site_order_status_updated_at: payload.statusUpdatedAt,
    site_order_items: siteOrderItemsFromPayload(payload.itens),
    site_order_subtotal: payload.subtotal,
    site_order_delivery_fee: payload.taxaEntrega,
    site_order_discount: payload.desconto,
    site_order_coupon: typeof payload.cupom === 'string' && payload.cupom.trim() ? payload.cupom.trim() : null,
    site_order_reward_id: typeof payload.rewardId === 'string' && payload.rewardId.trim() ? payload.rewardId.trim() : null,

    customer_id: customerId,
    customer_name: customerName || undefined,

    value: payload.total,
    customer_charge: payload.total,
    is_paid: false,
    payment_method: normalizeSitePaymentMethod(payload.metodoPagamento),
    change_for: payload.trocoPara ?? undefined,

    address_string: address,
    maps_link: '',
    phone: phone || undefined,

    completed: false,
    createdAt: now,
    created_at: now,
    updated_at: now,
  };
}
