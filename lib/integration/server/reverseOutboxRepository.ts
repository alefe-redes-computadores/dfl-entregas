import 'server-only';
import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from './admin';
import type { IntegrationEventEnvelope, IntegrationOutboxRecord } from '../contracts';

const COLLECTION = 'integration_outbox';
const REVERSE_EVENT_TYPES = new Set([
  'delivery.assigned',
  'delivery.out_for_delivery',
  'delivery.position_changed',
  'delivery.next_stop',
  'delivery.completed',
  'delivery.failed',
  'route.started',
  'route.reordered',
  'route.completed',
]);

type Claimed = {
  refId: string;
  event: IntegrationEventEnvelope;
  attempts: number;
};

function eventFrom(data: DocumentData): IntegrationEventEnvelope {
  return {
    event_id: String(data.event_id),
    event_type: data.event_type,
    occurred_at: String(data.occurred_at),
    source_system: data.source_system,
    entity_type: data.entity_type,
    entity_id: String(data.entity_id),
    schema_version: data.schema_version,
    payload: data.payload,
    ...(data.correlation_id ? { correlation_id: String(data.correlation_id) } : {}),
    ...(data.causation_id ? { causation_id: String(data.causation_id) } : {}),
  };
}

function eligible(data: DocumentData, now: number, lockMs: number) {
  if (data.source_system !== 'dfl_entregas') return false;
  if (!REVERSE_EVENT_TYPES.has(String(data.event_type))) return false;
  if (data.status === 'pending') return true;
  if (data.status === 'failed') {
    const next = data.next_attempt_at ? Date.parse(String(data.next_attempt_at)) : 0;
    return !Number.isFinite(next) || next <= now;
  }
  if (data.status === 'processing') {
    const locked = data.locked_at ? Date.parse(String(data.locked_at)) : 0;
    return !Number.isFinite(locked) || locked + lockMs <= now;
  }
  return false;
}

function timeOf(data: DocumentData) {
  const value = Date.parse(String(data.occurred_at || data.created_at || ''));
  return Number.isFinite(value) ? value : 0;
}

async function candidateDocs(limit: number) {
  const snapshots = await Promise.all(
    ['pending', 'failed', 'processing'].map((status) =>
      adminDb.collection(COLLECTION).where('status', '==', status).limit(Math.max(limit * 3, 30)).get(),
    ),
  );
  const map = new Map<string, QueryDocumentSnapshot>();
  for (const snapshot of snapshots) for (const doc of snapshot.docs) map.set(doc.id, doc);
  return [...map.values()].sort((a, b) => {
    const delta = timeOf(a.data()) - timeOf(b.data());
    return delta || String(a.data().event_id || a.id).localeCompare(String(b.data().event_id || b.id));
  });
}

export async function claimReverseOutboxBatch(input: {
  limit: number;
  workerId: string;
  lockMs: number;
}): Promise<Claimed[]> {
  const docs = await candidateDocs(input.limit);
  const claimed: Claimed[] = [];

  for (const candidate of docs) {
    if (claimed.length >= input.limit) break;
    const result = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(candidate.ref);
      if (!fresh.exists) return null;
      const data = fresh.data()!;
      const now = Date.now();
      if (!eligible(data, now, input.lockMs)) return null;

      const attempts = Number(data.attempts || 0) + 1;
      tx.update(candidate.ref, {
        status: 'processing',
        attempts,
        locked_by: input.workerId,
        locked_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
        last_error: FieldValue.delete(),
      });
      return { refId: candidate.id, event: eventFrom(data), attempts };
    });
    if (result) claimed.push(result);
  }
  return claimed;
}

export async function markReverseOutboxSent(refId: string) {
  const now = new Date().toISOString();
  await adminDb.collection(COLLECTION).doc(refId).update({
    status: 'sent',
    processed_at: now,
    updated_at: now,
    locked_by: FieldValue.delete(),
    locked_at: FieldValue.delete(),
    next_attempt_at: FieldValue.delete(),
    last_error: FieldValue.delete(),
  });
}

export async function markReverseOutboxFailed(input: {
  refId: string;
  attempts: number;
  error: string;
  maxAttempts: number;
}) {
  const dead = input.attempts >= input.maxAttempts;
  const backoffMs = Math.min(60 * 60_000, Math.max(5_000, 5_000 * 2 ** Math.max(0, input.attempts - 1)));
  const now = Date.now();
  await adminDb.collection(COLLECTION).doc(input.refId).update({
    status: dead ? 'dead_letter' : 'failed',
    last_error: input.error.slice(0, 1000),
    updated_at: new Date(now).toISOString(),
    ...(dead ? { next_attempt_at: FieldValue.delete() } : { next_attempt_at: new Date(now + backoffMs).toISOString() }),
    locked_by: FieldValue.delete(),
    locked_at: FieldValue.delete(),
  });
}

export async function reverseOutboxStats() {
  const snapshots = await Promise.all(
    ['pending', 'processing', 'failed', 'dead_letter'].map(async (status) => ({
      status,
      count: (await adminDb.collection(COLLECTION).where('status', '==', status).count().get()).data().count,
    })),
  );
  return Object.fromEntries(snapshots.map((item) => [item.status, item.count]));
}
