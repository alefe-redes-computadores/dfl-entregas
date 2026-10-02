import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { drainReverseIntegrationEventIds } from '@/lib/integration/server/reverseRelay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    await adminAuth.verifyIdToken(authorization.slice(7));
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let routeId = '';

  try {
    const body = await req.json() as { routeId?: unknown };
    routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
  } catch {
    routeId = '';
  }

  if (!routeId) {
    return NextResponse.json(
      { ok: false, error: 'routeId obrigatório' },
      { status: 400 },
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
      reconciliation,
      relay,
    };

    console.info(
      '[integration/route-kick]',
      JSON.stringify({
        routeId,
        siteDeliveries: reconciliation.siteDeliveries,
        candidates: reconciliation.candidates,
        created: reconciliation.created,
        existing: reconciliation.existing,
        requested: relay.requested,
        claimed: relay.claimed,
        sent: relay.sent,
        failed: relay.failed,
      }),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[integration/route-kick]', error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'route kick failed',
      },
      { status: 500 },
    );
  }
}
