// lib/integration/firestore.ts
import {
  doc,
  getDoc,
  runTransaction,
  type Transaction,
} from 'firebase/firestore';

import {
  db,
} from '@/lib/firebase';

import type {
  IntegrationSourceSystem,
} from '@/types';

import {
  buildOutboxRecord,
  type ExternalIdentityLink,
  type IntegrationEventEnvelope,
  type IntegrationOutboxRecord,
} from './contracts';

import {
  buildExternalIdentityLink,
  externalIdentityLinkId,
  INTEGRATION_COLLECTIONS,
} from './identity';

const MAX_DOCUMENT_ID_LENGTH = 1400;

const integrationDocumentId = (
  raw: string,
) => {
  const cleaned =
    raw.trim();

  if (!cleaned) {
    throw new Error(
      'ID de integração vazio.',
    );
  }

  const encoded =
    encodeURIComponent(
      cleaned,
    );

  if (
    encoded.length >
    MAX_DOCUMENT_ID_LENGTH
  ) {
    throw new Error(
      'ID de integração excede o limite seguro.',
    );
  }

  return encoded;
};

export async function enqueueIntegrationEvent<
  TPayload,
>(
  event:
    IntegrationEventEnvelope<TPayload>,
): Promise<{
  created: boolean;
  record:
    IntegrationOutboxRecord<TPayload>;
}> {
  const ref = doc(
    db,

    INTEGRATION_COLLECTIONS.outbox,

    integrationDocumentId(
      event.event_id,
    ),
  );

  return runTransaction(
    db,

    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          ref,
        );

      if (
        snapshot.exists()
      ) {
        return {
          created: false,

          record:
            snapshot.data() as IntegrationOutboxRecord<TPayload>,
        };
      }

      const record =
        buildOutboxRecord(
          event,
        );

      transaction.set(
        ref,
        record,
      );

      return {
        created: true,
        record,
      };
    },
  );
}

export async function ensureIntegrationEventInTransaction<
  TPayload,
>(
  transaction:
    Transaction,

  event:
    IntegrationEventEnvelope<TPayload>,
): Promise<{
  created: boolean;
  record:
    IntegrationOutboxRecord<TPayload>;
}> {
  const ref = doc(
    db,

    INTEGRATION_COLLECTIONS.outbox,

    integrationDocumentId(
      event.event_id,
    ),
  );

  const snapshot =
    await transaction.get(
      ref,
    );

  if (
    snapshot.exists()
  ) {
    return {
      created: false,

      record:
        snapshot.data() as IntegrationOutboxRecord<TPayload>,
    };
  }

  const record =
    buildOutboxRecord(
      event,
    );

  transaction.set(
    ref,
    record,
  );

  return {
    created: true,
    record,
  };
}

export async function getExternalIdentityLink(
  input: {
    source_system:
      IntegrationSourceSystem;

    external_entity_type:
      | 'order'
      | 'customer';

    external_entity_id:
      string;
  },
): Promise<
  ExternalIdentityLink |
  null
> {
  const ref = doc(
    db,

    INTEGRATION_COLLECTIONS.identities,

    externalIdentityLinkId(
      input,
    ),
  );

  const snapshot =
    await getDoc(ref);

  return snapshot.exists()
    ? (snapshot.data() as ExternalIdentityLink)
    : null;
}

export async function ensureExternalIdentityLink(
  input: {
    source_system:
      IntegrationSourceSystem;

    external_entity_type:
      | 'order'
      | 'customer';

    external_entity_id:
      string;

    local_entity_type:
      | 'delivery'
      | 'customer';

    local_entity_id:
      string;
  },
): Promise<ExternalIdentityLink> {
  const link =
    buildExternalIdentityLink(
      input,
    );

  const ref = doc(
    db,

    INTEGRATION_COLLECTIONS.identities,

    link.id,
  );

  return runTransaction(
    db,

    async (
      transaction,
    ) => {
      const snapshot =
        await transaction.get(
          ref,
        );

      if (
        snapshot.exists()
      ) {
        const current =
          snapshot.data() as ExternalIdentityLink;

        const sameTarget =
          current.local_entity_type ===
            link.local_entity_type &&
          current.local_entity_id ===
            link.local_entity_id;

        if (!sameTarget) {
          throw new Error(
            'Esta identidade externa já está vinculada a outro registro local.',
          );
        }

        return current;
      }

      transaction.set(
        ref,
        link,
      );

      return link;
    },
  );
}

export async function ensureExternalIdentityLinkInTransaction(
  transaction:
    Transaction,

  input: {
    source_system:
      IntegrationSourceSystem;

    external_entity_type:
      | 'order'
      | 'customer';

    external_entity_id:
      string;

    local_entity_type:
      | 'delivery'
      | 'customer';

    local_entity_id:
      string;
  },
): Promise<{
  created: boolean;
  link:
    ExternalIdentityLink;
}> {
  const proposed =
    buildExternalIdentityLink(
      input,
    );

  const ref = doc(
    db,

    INTEGRATION_COLLECTIONS.identities,

    proposed.id,
  );

  const snapshot =
    await transaction.get(
      ref,
    );

  if (
    snapshot.exists()
  ) {
    const current =
      snapshot.data() as ExternalIdentityLink;

    const sameTarget =
      current.local_entity_type ===
        proposed.local_entity_type &&
      current.local_entity_id ===
        proposed.local_entity_id;

    if (!sameTarget) {
      throw new Error(
        'Conflito de identidade externa: o ID já pertence a outro registro local.',
      );
    }

    return {
      created: false,
      link: current,
    };
  }

  transaction.set(
    ref,
    proposed,
  );

  return {
    created: true,
    link: proposed,
  };
}
