import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationOutbox } from '@/lib/integration/server/reverseRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WorkerMode = 'all' | 'reconcile' | 'drain';
type StageResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string; resourceExhausted: boolean };

function equal(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function authorized(req: NextRequest) {
  const secret = process.env.DFL_REVERSE_WORKER_SECRET || process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  return Boolean(secret) && auth.startsWith('Bearer ') && equal(auth.slice(7), secret);
}
function modeOf(req: NextRequest): WorkerMode | null {
  const raw = req.nextUrl.searchParams.get('mode')?.trim().toLowerCase() || 'all';
  return raw === 'all' || raw === 'reconcile' || raw === 'drain' ? raw : null;
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Reverse worker failed';
}
function quota(message: string) {
  return /RESOURCE_EXHAUSTED|quota exceeded|quota/i.test(message);
}
async function stage<T>(name: string, fn: () => Promise<T>): Promise<StageResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    const message = messageOf(error);
    const resourceExhausted = quota(message);
    console.error(`[integration/reverse-worker/${name}]`, { error: message, resourceExhausted });
    return { ok: false, error: message, resourceExhausted };
  }
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const mode = modeOf(req);
  if (!mode) return NextResponse.json({ ok: false, error: 'mode inválido; use all, reconcile ou drain.' }, { status: 400 });

  const reconciliation = mode === 'drain'
    ? null
    : await stage('reconciliation', () => reconcileReverseTrackingOutbox());

  // Independente: falhar a reconciliação não impede o envio do que já está na outbox.
  const relay = mode === 'reconcile'
    ? null
    : await stage('relay', () => drainReverseIntegrationOutbox());

  const reconciliationOk = reconciliation === null || reconciliation.ok;
  const relayOk = relay === null || relay.ok;
  const ok = reconciliationOk && relayOk;

  const resourceExhausted =
    (reconciliation !== null && !reconciliation.ok && reconciliation.resourceExhausted) ||
    (relay !== null && !relay.ok && relay.resourceExhausted);

  console.log('[integration/reverse-worker]', { mode, ok, resourceExhausted });
  return NextResponse.json(
    { ok, mode, resourceExhausted, reconciliation, relay },
    { status: ok ? 200 : resourceExhausted ? 429 : 207 },
  );
}
export const GET = run;
export const POST = run;
