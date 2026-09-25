import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { reconcileReverseTrackingOutbox, type ReverseReconcileOptions } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationOutbox } from '@/lib/integration/server/reverseRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WorkerMode = 'auto' | 'tracking' | 'reports' | 'reconcile' | 'drain';
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
  const raw = req.nextUrl.searchParams.get('mode')?.trim().toLowerCase() || 'auto';
  // Compatibilidade: schedulers antigos chamavam mode=all a cada minuto.
  // Agora eles entram no modo protegido por intervalo, sem varrer a base.
  if (raw === 'all') return 'auto';
  return raw === 'auto' || raw === 'tracking' || raw === 'reports' || raw === 'reconcile' || raw === 'drain' ? raw : null;
}
function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Reverse worker failed';
}
function quota(message: string) {
  return /RESOURCE_EXHAUSTED|quota exceeded|quota/i.test(message);
}
async function stage<T>(name: string, fn: () => Promise<T>): Promise<StageResult<T>> {
  try { return { ok: true, value: await fn() }; }
  catch (error) {
    const message = messageOf(error);
    const resourceExhausted = quota(message);
    console.error(`[integration/reverse-worker/${name}]`, { error: message, resourceExhausted });
    return { ok: false, error: message, resourceExhausted };
  }
}

function saoPauloClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce<Record<string, string>>((acc, item) => { acc[item.type] = item.value; return acc; }, {});
  return { weekday: parts.weekday, hour: Number(parts.hour), dateKey: `${parts.year}-${parts.month}-${parts.day}` };
}

async function claimAutomaticWork() {
  const ref = adminDb.collection('integration_checkpoints').doc('worker_schedule_v72');
  const now = Date.now();
  const clock = saoPauloClock(new Date(now));
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const state = snapshot.data() || {};
    const lastTracking = Date.parse(typeof state.last_tracking_at === 'string' ? state.last_tracking_at : '');
    const tracking = !Number.isFinite(lastTracking) || now - lastTracking >= 15 * 60 * 1000;
    const reportKey = typeof state.last_reports_key === 'string' ? state.last_reports_key : '';
    const reports = clock.weekday === 'Tue' && clock.hour === 4 && reportKey !== clock.dateKey;
    if (tracking || reports) transaction.set(ref, {
      ...(tracking ? { last_tracking_at: new Date(now).toISOString() } : {}),
      ...(reports ? { last_reports_key: clock.dateKey, last_reports_at: new Date(now).toISOString() } : {}),
      updated_at: new Date(now).toISOString(),
    }, { merge: true });
    return { tracking, reports, clock };
  });
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const mode = modeOf(req);
  if (!mode) return NextResponse.json({ ok: false, error: 'mode inválido; use auto, tracking, reports, reconcile ou drain.' }, { status: 400 });

  const schedule = mode === 'auto' ? await claimAutomaticWork() : null;
  let reconcileOptions: ReverseReconcileOptions | null = null;
  if (mode === 'tracking' || (mode === 'auto' && schedule?.tracking)) reconcileOptions = { tracking: true, recovery: false, analytics: false, activeLimit: 40 };
  if (mode === 'reports' || (mode === 'auto' && schedule?.reports)) reconcileOptions = { tracking: false, recovery: true, analytics: true, activeLimit: 40 };
  if (mode === 'reconcile' || (mode === 'auto' && schedule?.tracking && schedule?.reports)) reconcileOptions = { tracking: true, recovery: true, analytics: true, activeLimit: 40 };

  const reconciliation = reconcileOptions
    ? await stage('reconciliation', () => reconcileReverseTrackingOutbox(reconcileOptions!))
    : null;
  // Drain continua leve e idempotente. Mesmo quando a reconciliação não está
  // no horário, eventos que já existem na outbox seguem sendo entregues.
  const relay = await stage('relay', () => drainReverseIntegrationOutbox());

  const reconciliationOk = reconciliation === null || reconciliation.ok;
  const ok = reconciliationOk && relay.ok;
  const resourceExhausted =
    (reconciliation !== null && !reconciliation.ok && reconciliation.resourceExhausted) ||
    (!relay.ok && relay.resourceExhausted);
  console.log('[integration/reverse-worker]', { mode, ok, resourceExhausted, schedule, reconcileOptions });
  return NextResponse.json(
    { ok, mode, resourceExhausted, schedule, reconcileOptions, reconciliation, relay },
    { status: ok ? 200 : resourceExhausted ? 429 : 207 },
  );
}
export const GET = run;
export const POST = run;
