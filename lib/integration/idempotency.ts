// lib/integration/idempotency.ts
import type {
  IntegrationEventType,
} from './contracts';

const MAX_EVENT_ID_LENGTH = 1400;

const cleanPart = (
  value: string,
) =>
  encodeURIComponent(
    value.trim(),
  );

export function integrationEventId(
  input: {
    event_type:
      IntegrationEventType;

    entity_id: string;

    occurrence_id: string;
  },
) {
  const entityId =
    input.entity_id.trim();

  const occurrenceId =
    input.occurrence_id.trim();

  if (
    !entityId ||
    !occurrenceId
  ) {
    throw new Error(
      'entity_id e occurrence_id são obrigatórios para gerar event_id.',
    );
  }

  const id = [
    'evt-v1',
    cleanPart(
      input.event_type,
    ),
    cleanPart(entityId),
    cleanPart(
      occurrenceId,
    ),
  ].join('__');

  if (
    id.length >
    MAX_EVENT_ID_LENGTH
  ) {
    throw new Error(
      'event_id excede o limite seguro da integração.',
    );
  }

  return id;
}
