import 'server-only';
import { randomUUID, createHmac } from 'node:crypto';
import { assertReverseRelayConfigured } from './reverseConfig';
import {
  claimReverseOutboxBatch,
  claimReverseOutboxByEventId,
  markReverseOutboxFailed,
  markReverseOutboxSent,
} from './reverseOutboxRepository';

function signature(body: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

async function sendOne(
  event: Awaited<ReturnType<typeof claimReverseOutboxBatch>>[number]['event'],
  config: ReturnType<typeof assertReverseRelayConfigured>,
) {
  const body = JSON.stringify(event);
  const timestamp = String(Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(config.targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dfl-event-id': event.event_id,
        'x-dfl-timestamp': timestamp,
        'x-dfl-signature': signature(body, timestamp, config.signingSecret),
      },
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Site respondeu HTTP ${response.status}: ${text.slice(0, 500)}`);
    return { status: response.status, body: text.slice(0, 1000) };
  } finally {
    clearTimeout(timer);
  }
}

export async function drainReverseIntegrationOutbox() {
  const config = assertReverseRelayConfigured();
  const workerId = `reverse-relay-${randomUUID()}`;
  const claimed = await claimReverseOutboxBatch({
    limit: config.batchSize,
    workerId,
    lockMs: config.lockMs,
  });

  const results: Array<{ eventId: string; ok: boolean; status?: number; error?: string }> = [];

  for (const item of claimed) {
    try {
      const response = await sendOne(item.event, config);
      await markReverseOutboxSent(item.refId);
      results.push({ eventId: item.event.event_id, ok: true, status: response.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida no relay reverso.';
      await markReverseOutboxFailed({
        refId: item.refId,
        attempts: item.attempts,
        error: message,
        maxAttempts: config.maxAttempts,
      });
      results.push({ eventId: item.event.event_id, ok: false, error: message });
    }
  }

  return {
    ok: results.every((item) => item.ok),
    claimed: claimed.length,
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}


/**
 * Fast lane reverso isolado.
 *
 * Diferente do recovery global, este caminho só pode reclamar os eventIds
 * que acabaram de ser produzidos pela operação atual. Assim uma ação na
 * Rota A jamais acorda pendências antigas da Rota B.
 */
export async function drainReverseIntegrationEventIds(
  eventIds: string[],
  options?: { allowDeadLetter?: boolean },
) {
  const config = assertReverseRelayConfigured();
  const workerId = `reverse-fastlane-${randomUUID()}`;

  const uniqueIds = [
    ...new Set(
      eventIds
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);

  const results: Array<{
    eventId: string;
    claimed: boolean;
    ok: boolean;
    state: string;
    retryable: boolean;
    attempts?: number;
    status?: number;
    lockedAt?: string | null;
    nextAttemptAt?: string | null;
    processedAt?: string | null;
    error?: string;
  }> = [];

  for (const eventId of uniqueIds) {
    const claim = await claimReverseOutboxByEventId({
      eventId,
      workerId,
      lockMs: config.lockMs,
      // Uma ação humana/operacional explícita não precisa aguardar o
      // backoff do recovery global para tentar novamente um evento failed.
      allowFailedBeforeNextAttempt: true,
      allowDeadLetter: options?.allowDeadLetter === true,
    });

    if (claim.kind === 'not_claimed') {
      const state = claim.state;
      const alreadySent = state.status === 'sent';
      const retryable =
        state.status === 'processing' ||
        state.status === 'failed' ||
        state.status === 'pending';

      results.push({
        eventId,
        claimed: false,
        ok: alreadySent,
        state: state.status,
        retryable,
        attempts: state.attempts,
        lockedAt: state.lockedAt,
        nextAttemptAt: state.nextAttemptAt,
        processedAt: state.processedAt,
        ...(
          alreadySent
            ? {}
            : {
                error:
                  state.lastError ||
                  `Evento não disponível para claim: ${state.status}.`,
              }
        ),
      });
      continue;
    }

    const item = claim.item;

    try {
      const response = await sendOne(item.event, config);
      await markReverseOutboxSent(item.refId);

      results.push({
        eventId,
        claimed: true,
        ok: true,
        state: 'sent',
        retryable: false,
        attempts: item.attempts,
        status: response.status,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha desconhecida no fast lane reverso.';
      const dead = item.attempts >= config.maxAttempts;

      await markReverseOutboxFailed({
        refId: item.refId,
        attempts: item.attempts,
        error: message,
        maxAttempts: config.maxAttempts,
      });

      results.push({
        eventId,
        claimed: true,
        ok: false,
        state: dead ? 'dead_letter' : 'failed',
        retryable: !dead,
        attempts: item.attempts,
        error: message,
      });
    }
  }

  return {
    ok: results.every((item) => item.ok),
    requested: uniqueIds.length,
    claimed: results.filter((item) => item.claimed).length,
    sent: results.filter(
      (item) => item.claimed && item.ok,
    ).length,
    alreadySent: results.filter(
      (item) => !item.claimed && item.state === 'sent',
    ).length,
    inFlight: results.filter(
      (item) => item.state === 'processing',
    ).length,
    retryable: results.filter(
      (item) => !item.ok && item.retryable,
    ).length,
    failed: results.filter(
      (item) =>
        !item.ok &&
        item.state !== 'processing',
    ).length,
    unsettled: results.filter((item) => !item.ok).length,
    results,
  };
}
