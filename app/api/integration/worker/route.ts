import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { relayStageSucceeded, recoveryCheckpointEligible, shouldAttemptDailyReports, reportsCheckpointEligible } from '@/lib/integration/worker-health';
import { reconcileReverseTrackingOutbox, type ReverseReconcileOptions } from '@/lib/integration/server/reverseReconciler';
import {
  drainReverseIntegrationEventIds,
  drainReverseIntegrationOutbox,
} from '@/lib/integration/server/reverseRelay';

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
    const lastReportsKey = typeof state.last_reports_key === 'string' ? state.last_reports_key : '';
    const lastReportsAttempt = Date.parse(typeof state.last_reports_attempt_at === 'string' ? state.last_reports_attempt_at : '');
    // Apenas reservar a execução NÃO comprova que ela terminou.
    // Se o worker cair, a próxima tentativa ocorre após 30 minutos, inclusive depois das 04h.
    const reports = shouldAttemptDailyReports(clock.hour, lastReportsKey, clock.dateKey, lastReportsAttempt, now);
    const lastRecoveryAttempt = Date.parse(typeof state.status_recovery_v17_4_attempt_at === 'string' ? state.status_recovery_v17_4_attempt_at : '');
    // Uma recuperação que falhou ou encontrou página cheia não varre a base a cada minuto.
    const statusRecoveryReplay = state.status_recovery_v17_4_done !== true &&
      (!Number.isFinite(lastRecoveryAttempt) || now - lastRecoveryAttempt >= 15 * 60 * 1000);
    if (tracking || reports || statusRecoveryReplay) transaction.set(ref, {
      ...(tracking ? { last_tracking_at: new Date(now).toISOString() } : {}),
      ...(reports ? { last_reports_attempt_at: new Date(now).toISOString() } : {}),
      ...(statusRecoveryReplay ? { status_recovery_v17_4_attempt_at: new Date(now).toISOString() } : {}),
      updated_at: new Date(now).toISOString(),
    }, { merge: true });
    return { tracking, reports, statusRecoveryReplay, clock };
  });
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const mode = modeOf(req);
  if (!mode) return NextResponse.json({ ok: false, error: 'mode inválido; use auto, tracking, reports, reconcile ou drain.' }, { status: 400 });

  const scheduleStage = mode === 'auto'
    ? await stage('schedule', () => claimAutomaticWork())
    : null;

  const schedule = scheduleStage?.ok ? scheduleStage.value : null;

  let reconcileOptions: ReverseReconcileOptions | null = null;
  if (mode === 'tracking' || (mode === 'auto' && schedule?.tracking)) reconcileOptions = { tracking: true, recovery: false, analytics: false, activeLimit: 40 };
  if (mode === 'reports' || (mode === 'auto' && schedule?.reports)) reconcileOptions = { tracking: false, recovery: true, analytics: true, activeLimit: 40 };
  if (mode === 'reconcile' || (mode === 'auto' && schedule?.tracking && schedule?.reports)) reconcileOptions = { tracking: true, recovery: true, analytics: true, activeLimit: 40 };

  if (mode === 'auto' && schedule?.statusRecoveryReplay) {
    reconcileOptions = {
      ...(reconcileOptions || {
        tracking: true,
        recovery: false,
        analytics: false,
        activeLimit: 40,
      }),
      statusRecoveryReplay: true,
    };
  }

  const reconciliation = reconcileOptions
    ? await stage('reconciliation', () => reconcileReverseTrackingOutbox(reconcileOptions!))
    : null;
  const statusRecoveryEventIds =
    reconciliation && reconciliation.ok
      ? reconciliation.value.statusRecoveryReplayEventIds || []
      : [];

  const statusRecoveryRelay =
    statusRecoveryEventIds.length > 0
      ? await stage(
          'status-recovery-relay',
          () => drainReverseIntegrationEventIds(statusRecoveryEventIds),
        )
      : null;

  // Valor capturado antes da closure: o helper de checkpoint nao estreita
  // o tipo discriminado de reconciliation para TypeScript.
  const statusRecoveryReplayRead =
    reconciliation && reconciliation.ok
      ? reconciliation.value.statusRecoveryReplayRead
      : 0;

  const statusRecoveryCheckpoint =
    mode === 'auto' &&
    schedule?.statusRecoveryReplay &&
    recoveryCheckpointEligible(reconciliation, statusRecoveryRelay, 40)
      ? await stage('status-recovery-checkpoint', async () => {
          await adminDb
            .collection('integration_checkpoints')
            .doc('worker_schedule_v72')
            .set({
              status_recovery_v17_4_done: true,
              status_recovery_v17_4_at: new Date().toISOString(),
              status_recovery_v17_4_read: statusRecoveryReplayRead,
              updated_at: new Date().toISOString(),
            }, { merge: true });

          return { done: true };
        })
      : null;

  // Checkpoint de relatórios somente DEPOIS de reconciliação concluída.
  // Preserva tentativas futuras em caso de falha (sem duplicar a cada minuto).
  const reportsCheckpoint = reportsCheckpointEligible(Boolean(mode === 'auto' && schedule?.reports), reconciliation)
    ? await stage('reports-checkpoint', async () => {
        await adminDb.collection('integration_checkpoints').doc('worker_schedule_v72').set({
          last_reports_key: schedule!.clock.dateKey,
          last_reports_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { merge: true });
        return { done: true };
      })
    : null;

  // Drain global permanece somente como rede de segurança da outbox.
  const relay = await stage('relay', () => drainReverseIntegrationOutbox());

  const scheduleOk = scheduleStage === null || scheduleStage.ok;
  const reconciliationOk = reconciliation === null || (reconciliation.ok && reconciliation.value.ok === true);
  const statusRecoveryRelayOk = relayStageSucceeded(statusRecoveryRelay);
  const statusRecoveryCheckpointOk =
    statusRecoveryCheckpoint === null || statusRecoveryCheckpoint.ok;

  // A API pode executar sem exceção e ainda ter eventos aguardando relay.
  // Essa condição tem o mesmo peso que uma falha explícita da fila.
  const relayDeliveryOk = relayStageSucceeded(relay);
  const statusRecoveryNeedsReview = Boolean(
    mode === 'auto' && schedule?.statusRecoveryReplay && (
      !reconciliation?.ok ||
      reconciliation.value.ok !== true ||
      statusRecoveryReplayRead >= 40 ||
      (statusRecoveryEventIds.length > 0 && !statusRecoveryRelayOk) ||
      (statusRecoveryCheckpoint !== null && !statusRecoveryCheckpoint.ok)
    ),
  );
  const reportsCheckpointOk = reportsCheckpoint === null || reportsCheckpoint.ok;
  const ok =
    scheduleOk &&
    reconciliationOk &&
    statusRecoveryRelayOk &&
    statusRecoveryCheckpointOk &&
    reportsCheckpointOk &&
    relayDeliveryOk;
  if (relay.ok && !relayDeliveryOk) {
    console.warn('[integration/reverse-worker] Relay executado com falhas de entrega ao Site', {
      failed: relay.value.failed,
      claimed: relay.value.claimed,
    });
  }
  const resourceExhausted =
    (scheduleStage !== null && !scheduleStage.ok && scheduleStage.resourceExhausted) ||
    (reconciliation !== null && !reconciliation.ok && reconciliation.resourceExhausted) ||
    (reportsCheckpoint !== null && !reportsCheckpoint.ok && reportsCheckpoint.resourceExhausted) ||
    (!relay.ok && relay.resourceExhausted);
  console.log('[integration/reverse-worker]', { mode, ok, resourceExhausted, schedule, reconcileOptions });
  return NextResponse.json(
    {
      ok,
      mode,
      resourceExhausted,
      schedule,
      scheduleStage,
      reconcileOptions,
      reconciliation,
      statusRecoveryRelay,
      statusRecoveryCheckpoint,
      reportsCheckpoint,
      reportsNeedsReview: Boolean(mode === 'auto' && schedule?.reports && !reportsCheckpoint?.ok),
      statusRecoveryNeedsReview,
      relay,
    },
    { status: ok ? 200 : resourceExhausted ? 429 : 207 },
  );
}
export const GET = run;
export const POST = run;
