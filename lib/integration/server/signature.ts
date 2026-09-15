import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function integrationSignature(body: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

function safeEqual(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertSignedIntegrationRequest(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  eventId: string | null;
  expectedEventId: string;
}) {
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if (!secret) throw new Error('DFL_INTEGRATION_SIGNING_SECRET não configurado.');
  if (!input.timestamp || !input.signature || !input.eventId) throw new Error('Assinatura de integração ausente.');
  if (input.eventId !== input.expectedEventId) throw new Error('x-dfl-event-id diverge do envelope.');

  const parsed = Date.parse(input.timestamp);
  if (!Number.isFinite(parsed) || Math.abs(Date.now() - parsed) > 5 * 60 * 1000) {
    throw new Error('Timestamp da integração expirado ou inválido.');
  }

  const expected = `sha256=${integrationSignature(input.body, input.timestamp, secret)}`;
  if (!safeEqual(input.signature, expected)) throw new Error('Assinatura de integração inválida.');
}
