// lib/integration/identity.ts
import type {
  IntegrationSourceSystem,
} from '@/types';

import type {
  ExternalIdentityLink,
} from './contracts';

export const INTEGRATION_COLLECTIONS = {
  outbox: 'integration_outbox',
  inbox: 'integration_inbox',
  identities:
    'integration_external_identities',
} as const;

const MAX_FIRESTORE_DOCUMENT_ID_LENGTH = 1400;

const encodeKeyPart = (value: string) =>
  encodeURIComponent(value.trim());

const assertDocumentIdLength = (
  id: string,
) => {
  if (
    !id ||
    id.length >
      MAX_FIRESTORE_DOCUMENT_ID_LENGTH
  ) {
    throw new Error(
      'Identificador externo excede o limite seguro da integração.',
    );
  }

  return id;
};

export function externalIdentityLinkId(
  input: {
    source_system:
      IntegrationSourceSystem;

    external_entity_type:
      | 'order'
      | 'customer';

    external_entity_id: string;
  },
) {
  const externalId =
    input.external_entity_id.trim();

  if (!externalId) {
    throw new Error(
      'external_entity_id é obrigatório.',
    );
  }

  return assertDocumentIdLength(
    [
      'v1',
      encodeKeyPart(
        input.source_system,
      ),
      encodeKeyPart(
        input.external_entity_type,
      ),
      encodeKeyPart(externalId),
    ].join('__'),
  );
}

export function buildExternalIdentityLink(
  input: {
    source_system:
      IntegrationSourceSystem;

    external_entity_type:
      | 'order'
      | 'customer';

    external_entity_id: string;

    local_entity_type:
      | 'delivery'
      | 'customer';

    local_entity_id: string;

    now?: string;
  },
): ExternalIdentityLink {
  const localId =
    input.local_entity_id.trim();

  const externalId =
    input.external_entity_id.trim();

  if (!localId) {
    throw new Error(
      'local_entity_id é obrigatório.',
    );
  }

  if (!externalId) {
    throw new Error(
      'external_entity_id é obrigatório.',
    );
  }

  const now =
    input.now ||
    new Date().toISOString();

  return {
    id: externalIdentityLinkId({
      source_system:
        input.source_system,

      external_entity_type:
        input.external_entity_type,

      external_entity_id:
        externalId,
    }),

    source_system:
      input.source_system,

    external_entity_type:
      input.external_entity_type,

    external_entity_id:
      externalId,

    local_entity_type:
      input.local_entity_type,

    local_entity_id:
      localId,

    created_at: now,
    updated_at: now,
  };
}
