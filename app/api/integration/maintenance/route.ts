import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkpoint = adminDb.collection('integration_checkpoints').doc('worker_schedule_v72');
const MANUAL_COOLDOWN_MS = 30 * 60 * 1000;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida';
}

function quota(message: string) {
  return /RESOURCE_EXHAUSTED|quota exceeded|quota/i.test(message);
}

async function authorize(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const decoded = await adminAuth.verifyIdToken(header.slice(7));
  if (!decoded.email) throw new Error('UNAUTHORIZED');
  const allowlist = (process.env.DFL_ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(decoded.email.toLowerCase())) throw new Error('UNAUTHORIZED');
  return { uid: decoded.uid, email: decoded.email };
}

function publicState(data: DocumentData | undefined) {
  const state = data || {};
  return {
    lastTrackingAt: typeof state.last_tracking_at === 'string' ? state.last_tracking_at : null,
    lastReportsAt: typeof state.last_reports_at === 'string' ? state.last_reports_at : null,
    lastReportsKey: typeof state.last_reports_key === 'string' ? state.last_reports_key : null,
    lastManualAt: typeof state.last_manual_at === 'string' ? state.last_manual_at : null,
    lastManualStatus: typeof state.last_manual_status === 'string' ? state.last_manual_status : null,
    lastManualDurationMs: typeof state.last_manual_duration_ms === 'number' ? state.last_manual_duration_ms : null,
    lastManualProcessed: typeof state.last_manual_processed === 'number' ? state.last_manual_processed : null,
    lastManualError: typeof state.last_manual_error === 'string' ? state.last_manual_error : null,
    lastWorkerStatus: typeof state.last_worker_status === 'string' ? state.last_worker_status : null,
    lastWorkerAt: typeof state.last_worker_at === 'string' ? state.last_worker_at : null,
    lastQuotaAt: typeof state.last_quota_at === 'string' ? state.last_quota_at : null,
    nextAutomaticReports: 'terça-feira às 04:00',
    manualCooldownMinutes: 30,
  };
}

export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    const snapshot = await checkpoint.get();
    return NextResponse.json({ ok: true, state: publicState(snapshot.data()) });
  } catch (error) {
    const unauthorized = messageOf(error) === 'UNAUTHORIZED';
    return NextResponse.json({ ok: false, error: unauthorized ? 'Não autorizado.' : 'Não foi possível consultar o monitor.' }, { status: unauthorized ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  let actor: { uid: string; email: string };
  try {
    actor = await authorize(req);
  } catch {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const now = Date.now();
  const claimed = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(checkpoint);
    const state = snapshot.data() || {};
    const runningUntil = Date.parse(typeof state.manual_running_until === 'string' ? state.manual_running_until : '');
    const lastManual = Date.parse(typeof state.last_manual_at === 'string' ? state.last_manual_at : '');
    if (Number.isFinite(runningUntil) && runningUntil > now) return { ok: false, reason: 'running' as const, state };
    if (Number.isFinite(lastManual) && now - lastManual < MANUAL_COOLDOWN_MS) return { ok: false, reason: 'cooldown' as const, state };
    transaction.set(checkpoint, {
      manual_running_until: new Date(now + 10 * 60 * 1000).toISOString(),
      last_manual_status: 'running',
      last_manual_actor: actor.email,
      updated_at: new Date(now).toISOString(),
    }, { merge: true });
    return { ok: true as const };
  });

  if (!claimed.ok) {
    return NextResponse.json({ ok: false, reason: claimed.reason, error: claimed.reason === 'running' ? 'A atualização já está em andamento.' : 'Aguarde 30 minutos antes de atualizar novamente.', state: publicState(claimed.state) }, { status: 429 });
  }

  const started = Date.now();
  try {
    const result = await reconcileReverseTrackingOutbox({ tracking: false, recovery: true, analytics: true, activeLimit: 40 });
    const processed = result.analyticsNativeCandidates + result.recentCompletedRecoveries;
    const finishedAt = new Date().toISOString();
    await checkpoint.set({
      last_manual_at: finishedAt,
      last_reports_at: finishedAt,
      last_manual_status: 'success',
      last_manual_duration_ms: Date.now() - started,
      last_manual_processed: processed,
      last_manual_error: null,
      manual_running_until: null,
      updated_at: finishedAt,
    }, { merge: true });
    return NextResponse.json({ ok: true, processed, durationMs: Date.now() - started, state: publicState((await checkpoint.get()).data()) });
  } catch (error) {
    const message = messageOf(error);
    const exhausted = quota(message);
    const finishedAt = new Date().toISOString();
    await checkpoint.set({
      last_manual_at: finishedAt,
      last_manual_status: exhausted ? 'quota' : 'error',
      last_manual_duration_ms: Date.now() - started,
      last_manual_error: exhausted ? 'Limite temporário do banco atingido.' : message.slice(0, 300),
      ...(exhausted ? { last_quota_at: finishedAt } : {}),
      manual_running_until: null,
      updated_at: finishedAt,
    }, { merge: true });
    return NextResponse.json({ ok: false, resourceExhausted: exhausted, error: exhausted ? 'O banco pediu uma pausa. Nenhum relatório existente foi apagado.' : 'A atualização falhou, mas os relatórios existentes foram preservados.' }, { status: exhausted ? 429 : 500 });
  }
}
