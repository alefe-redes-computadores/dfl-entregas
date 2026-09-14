// lib/integration/contracts.ts
import type { IntegrationSourceSystem } from '@/types';

export const INTEGRATION_SCHEMA_VERSION = 1 as const;

export const INTEGRATION_EVENT_TYPES = [
  'order.created',
  'order.updated',

  'delivery.created',
  'delivery.assigned',
  'delivery.out_for_delivery',
  'delivery.position_changed',
  'delivery.next_stop',
  'delivery.completed',
  'delivery.failed',

  'route.created',
  'route.started',
  'route.reordered',
  'route.completed',
] as const;

export type IntegrationEventType =
  (typeof INTEGRATION_EVENT_TYPES)[number];

export const INTEGRATION_ENTITY_TYPES = [
  'order',
  'customer',
  'delivery',
  'route',
  'motoboy',
  'expense',
] as const;

export type IntegrationEntityType =
  (typeof INTEGRATION_ENTITY_TYPES)[number];

export interface IntegrationEventEnvelope<
  TPayload = Record<string, unknown>,
> {
  event_id: string;
  event_type: IntegrationEventType;
  occurred_at: string;
  source_system: IntegrationSourceSystem;
  entity_type: IntegrationEntityType;
  entity_id: string;
  schema_version: typeof INTEGRATION_SCHEMA_VERSION;
  payload: TPayload;

  correlation_id?: string;
  causation_id?: string;
}

export type IntegrationOutboxStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'dead_letter';

export interface IntegrationOutboxRecord<
  TPayload = Record<string, unknown>,
> extends IntegrationEventEnvelope<TPayload> {
  status: IntegrationOutboxStatus;
  attempts: number;

  next_attempt_at?: string;
  last_error?: string;

  locked_by?: string;
  locked_at?: string;

  processed_at?: string;

  created_at: string;
  updated_at: string;
}

export interface IntegrationInboxReceipt {
  event_id: string;
  event_type: IntegrationEventType;
  source_system: IntegrationSourceSystem;

  entity_type: IntegrationEntityType;
  entity_id: string;

  schema_version: typeof INTEGRATION_SCHEMA_VERSION;

  received_at: string;
  processed_at?: string;

  status:
    | 'processing'
    | 'processed'
    | 'failed';

  local_entity_type?: IntegrationEntityType;
  local_entity_id?: string;

  last_error?: string;

  updated_at: string;
}

export interface ExternalIdentityLink {
  id: string;

  source_system: IntegrationSourceSystem;

  external_entity_type:
    | 'order'
    | 'customer';

  external_entity_id: string;

  local_entity_type:
    | 'delivery'
    | 'customer';

  local_entity_id: string;

  created_at: string;
  updated_at: string;
}

export interface IntegrationEventInput<
  TPayload = Record<string, unknown>,
> {
  event_id: string;
  event_type: IntegrationEventType;

  occurred_at?: string;
  source_system?: IntegrationSourceSystem;

  entity_type: IntegrationEntityType;
  entity_id: string;

  payload: TPayload;

  correlation_id?: string;
  causation_id?: string;
}

const eventTypeSet = new Set<string>(
  INTEGRATION_EVENT_TYPES,
);

const entityTypeSet = new Set<string>(
  INTEGRATION_ENTITY_TYPES,
);

const sourceSystems = new Set<string>([
  'dfl_site',
  'dfl_entregas',
]);

const validIsoDate = (value: unknown) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  Number.isFinite(Date.parse(value));

const requiredString = (
  value: string,
  field: string,
) => {
  const cleaned = value.trim();

  if (!cleaned) {
    throw new Error(
      `Campo de integração obrigatório ausente: ${field}.`,
    );
  }

  return cleaned;
};

export function buildIntegrationEvent<TPayload>(
  input: IntegrationEventInput<TPayload>,
): IntegrationEventEnvelope<TPayload> {
  const occurredAt =
    input.occurred_at ||
    new Date().toISOString();

  if (!validIsoDate(occurredAt)) {
    throw new Error(
      'occurred_at inválido no evento de integração.',
    );
  }

  return {
    event_id: requiredString(
      input.event_id,
      'event_id',
    ),

    event_type: input.event_type,

    occurred_at: occurredAt,

    source_system:
      input.source_system ||
      'dfl_entregas',

    entity_type: input.entity_type,

    entity_id: requiredString(
      input.entity_id,
      'entity_id',
    ),

    schema_version:
      INTEGRATION_SCHEMA_VERSION,

    payload: input.payload,

    ...(input.correlation_id?.trim()
      ? {
          correlation_id:
            input.correlation_id.trim(),
        }
      : {}),

    ...(input.causation_id?.trim()
      ? {
          causation_id:
            input.causation_id.trim(),
        }
      : {}),
  };
}

export function buildOutboxRecord<TPayload>(
  event: IntegrationEventEnvelope<TPayload>,
  now = new Date().toISOString(),
): IntegrationOutboxRecord<TPayload> {
  return {
    ...event,

    status: 'pending',
    attempts: 0,

    created_at: now,
    updated_at: now,
  };
}

export function isIntegrationEventEnvelope(
  value: unknown,
): value is IntegrationEventEnvelope {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.event_id === 'string' &&
    candidate.event_id.trim().length > 0 &&

    typeof candidate.event_type === 'string' &&
    eventTypeSet.has(candidate.event_type) &&

    validIsoDate(candidate.occurred_at) &&

    typeof candidate.source_system === 'string' &&
    sourceSystems.has(candidate.source_system) &&

    typeof candidate.entity_type === 'string' &&
    entityTypeSet.has(candidate.entity_type) &&

    typeof candidate.entity_id === 'string' &&
    candidate.entity_id.trim().length > 0 &&

    candidate.schema_version ===
      INTEGRATION_SCHEMA_VERSION &&

    Object.prototype.hasOwnProperty.call(
      candidate,
      'payload',
    )
  );
}
