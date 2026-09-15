import 'server-only';
import { randomUUID, createHmac } from 'node:crypto';
import { assertReverseRelayConfigured } from './reverseConfig';
import {
  claimReverseOutboxBatch,
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
