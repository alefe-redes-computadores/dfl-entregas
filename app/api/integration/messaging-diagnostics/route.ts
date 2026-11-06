import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { reverseRelayConfig } from '@/lib/integration/server/reverseConfig';
import { reverseOutboxStats, recentReverseOutboxIssues } from '@/lib/integration/server/reverseOutboxRepository';
import { planManualMessage, type ManualDeliveryRecord, type ManualRouteRecord } from '@/lib/integration/manualMessagingPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NATIVE_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);
function headers(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'cache-control': 'private, no-store, max-age=0',
    ...(NATIVE_ORIGINS.has(origin) ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      vary: 'Origin',
    } : {}),
  };
}
const answer = (req: NextRequest, body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: headers(req) });
export async function OPTIONS(req: NextRequest) {
  return NATIVE_ORIGINS.has(req.headers.get('origin') || '')
    ? new NextResponse(null, { status: 204, headers: headers(req) })
    : new NextResponse(null, { status: 403 });
}
function explainError(message: string | null) {
  const value=String(message||'').toLowerCase().slice(0,240);
  if(!value)return {code:'no_detail',detail:'Sem motivo registrado. Verifique o diagnóstico.',retryable:false};
  if(/401|403|unauthoriz|forbidden|token|assinatura|permission/.test(value))
    return {code:'auth_block',detail:'Autorização ou assinatura inválida; corrigir configuração.',retryable:false};
  if(/invalid|missing|telefone|phone|sem dados|cancel|consent|unsupported/.test(value))
    return {code:'data_block',detail:'Dados ou regra de negócio impeditivos; corrigir a origem.',retryable:false};
  if(/config|secret|env|not configured/.test(value))
    return {code:'config_block',detail:'Configuração incompleta; repetir não resolve.',retryable:false};
  if(/timeout|abort|network|fetch|502|503|500|504|429|offline/.test(value))
    return {code:'transient',detail:'Falha possivelmente temporária; consulte os dados antes de qualquer reenvio.',retryable:true};
  return {code:'unknown',detail:'Causa não classificada; requer conferência técnica.',retryable:false};
}
function reason(result: ReturnType<typeof planManualMessage>) {
  return result.eligible ? 'eligible_by_policy' : result.reason;
}
export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return answer(req, { ok: false, error: 'AUTH_REQUIRED' }, 401);
  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (!isSuperadminUid(decoded.uid)) return answer(req, { ok: false, error: 'FORBIDDEN' }, 403);
  } catch { return answer(req, { ok: false, error: 'AUTH_REQUIRED' }, 401); }

  const rawId = req.nextUrl.searchParams.get('deliveryId') || '';
  if (rawId && !/^dfl-[A-Za-z0-9-]{12,120}$/.test(rawId))
    return answer(req, { ok: false, error: 'INVALID_DELIVERY_ID' }, 400);

  try {
    const reverse = reverseRelayConfig();
    const activationRaw = process.env.DFL_MANUAL_MESSAGING_ACTIVATED_AT?.trim() || '';
    const activationMs = Date.parse(activationRaw);
    const activationValid = Boolean(activationRaw) && Number.isFinite(activationMs);
    const manualEnabled = process.env.DFL_MANUAL_MESSAGING_ENABLED === 'true' && activationValid;
    const diagnostics: {
      present: boolean;
      created: string;
      routeStarted: string;
      completed: string;
      createdAfterActivation: boolean;
      sendingPermitted: boolean;
    } | null = rawId ? {
      present: false, created: 'delivery_not_found', routeStarted: 'delivery_not_found',
      completed: 'delivery_not_found', createdAfterActivation: false, sendingPermitted: false,
    } : null;

    if (rawId && diagnostics) {
      const deliverySnap = await adminDb.collection('deliveries').doc(rawId).get();
      if (deliverySnap.exists) {
        const delivery = { ...deliverySnap.data(), id: deliverySnap.id } as ManualDeliveryRecord & { route_id?: string };
        let route: ManualRouteRecord | null = null;
        if (typeof delivery.route_id === 'string' && /^[A-Za-z0-9_-]{8,160}$/.test(delivery.route_id)) {
          const snap = await adminDb.collection('routes').doc(delivery.route_id).get();
          if (snap.exists) route = snap.data() as ManualRouteRecord;
        }
        const created = Date.parse(String(delivery.created_at || delivery.createdAt || ''));
        const after = activationValid && Number.isFinite(created) && created >= activationMs;
        diagnostics.present = true;
        diagnostics.created = reason(planManualMessage({ delivery, reason: 'created' }));
        diagnostics.routeStarted = reason(planManualMessage({ delivery, reason: 'route_started', route }));
        diagnostics.completed = reason(planManualMessage({ delivery, reason: 'delivery_completed', route }));
        diagnostics.createdAfterActivation = after;
        diagnostics.sendingPermitted = manualEnabled && after && diagnostics.created === 'eligible_by_policy';
      }
    }

    // Aggregate Firestore counts only. Never expose names, phone numbers,
    // raw payloads, tokens, URLs, or per-order reverse outbox identifiers.
    const [outbox, rawIssues] = await Promise.all([reverseOutboxStats(), recentReverseOutboxIssues(12)]);
    const issues=rawIssues.map(issue=>({
      eventType:issue.eventType.slice(0,60),status:issue.status,
      attempts:Math.min(99,Math.max(0,Math.trunc(issue.attempts))),
      updatedAt:issue.updatedAt,
      failure:explainError(issue.lastError),
    }));
    return answer(req, {
      ok: true, checkedAt: new Date().toISOString(),
      gates: {
        manualEnabled, manualActivationValid: activationValid,
        manualSiteTargetConfigured: Boolean(process.env.DFL_SITE_INTEGRATION_URL?.trim() && process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim()),
        reverseRelayEnabled: reverse.enabled,
        reverseRelayConfigured: Boolean(reverse.targetUrl && reverse.signingSecret),
      },
      reverseOutbox: outbox, issues,
      delivery: diagnostics,
      note: 'Consulta somente leitura. Um evento sent na ponte não confirma envio nem entrega no WhatsApp.',
    });
  } catch {
    return answer(req, { ok: false, error: 'DIAGNOSTIC_UNAVAILABLE' }, 503);
  }
}
