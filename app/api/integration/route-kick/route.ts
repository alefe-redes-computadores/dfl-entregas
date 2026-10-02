import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationEventIds } from '@/lib/integration/server/reverseRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NATIVE_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
]);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')?.trim() || '';

  if (!NATIVE_ORIGINS.has(origin)) return {};

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(req),
  });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')?.trim() || '';

  if (!NATIVE_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return json(
      req,
      { ok: false, error: 'Unauthorized' },
      401,
    );
  }

  try {
    await adminAuth.verifyIdToken(authorization.slice(7));
  } catch {
    return json(
      req,
      { ok: false, error: 'Unauthorized' },
      401,
    );
  }

  let routeId = '';
  let reason = 'unspecified';

  try {
    const body = await req.json() as {
      routeId?: unknown;
      reason?: unknown;
    };
    routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
    reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 64)
        : 'unspecified';
  } catch {
    routeId = '';
    reason = 'unspecified';
  }

  if (!routeId) {
    return json(
      req,
      { ok: false, error: 'routeId obrigatório' },
      400,
    );
  }

  try {
    /*
     * Fast lane operacional.
     *
     * Executa somente quando uma ação humana inicia uma rota.
     * Não adiciona timer, listener ou polling.
     *
     * analytics=false é intencional:
     * iniciar rota não deve acordar relatórios.
     */
    const reconciliation =
      await reconcileReverseTrackingOutbox({
        tracking: true,
        recovery: false,
        analytics: false,
        activeLimit: 40,
        routeId,
      });

    const relay = await drainReverseIntegrationEventIds(
      reconciliation.eventIds,
    );

    const result = {
      ok: reconciliation.ok && relay.ok,
      routeId,
      reason,
      reconciliation,
      relay,
    };

    console.info(
      '[integration/route-kick]',
      JSON.stringify({
        routeId,
        reason,
        siteDeliveries: reconciliation.siteDeliveries,
        candidates: reconciliation.candidates,
        created: reconciliation.created,
        existing: reconciliation.existing,
        requested: relay.requested,
        claimed: relay.claimed,
        sent: relay.sent,
        failed: relay.failed,
        inFlight: relay.inFlight,
        retryable: relay.retryable,
        unsettled: relay.unsettled,
      }),
    );

    return json(
      req,
      result,
      result.ok ? 200 : 207,
    );
  } catch (error) {
    console.error('[integration/route-kick]', error);

    return json(
      req,
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'route kick failed',
      },
      500,
    );
  }
}
