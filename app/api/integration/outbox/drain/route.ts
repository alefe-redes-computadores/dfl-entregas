import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reverseRelayConfig } from '@/lib/integration/server/reverseConfig';
import { drainReverseIntegrationOutbox } from '@/lib/integration/server/reverseRelay';
import { reverseOutboxStats } from '@/lib/integration/server/reverseOutboxRepository';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';
import { reverseDrainOutcome } from '@/lib/integration/drain-outcome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function equal(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request: NextRequest) {
  const secret = reverseRelayConfig().triggerSecret;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') && equal(auth.slice(7), secret);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const config = reverseRelayConfig();
  return NextResponse.json({
    ok: true,
    enabled: config.enabled,
    targetConfigured: Boolean(config.targetUrl),
    reconciliationSupported: true,
    stats: await reverseOutboxStats(),
  });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    let body: { reconcile?: boolean; drain?: boolean } = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return NextResponse.json({ ok: false, error: 'Corpo JSON deve ser um objeto.' }, { status: 400 });
        }
        const input = parsed as Record<string, unknown>;
        if ((input.reconcile !== undefined && typeof input.reconcile !== 'boolean') ||
            (input.drain !== undefined && typeof input.drain !== 'boolean')) {
          return NextResponse.json({ ok: false, error: 'reconcile e drain devem ser booleanos.' }, { status: 400 });
        }
        body = { reconcile: input.reconcile as boolean | undefined, drain: input.drain as boolean | undefined };
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
    }

    const shouldReconcile = body.reconcile !== false;
    const shouldDrain = body.drain !== false;
    if (!shouldReconcile && !shouldDrain) {
      return NextResponse.json({ ok: false, error: 'Nenhuma etapa solicitada.' }, { status: 400 });
    }

    const reconciliation = shouldReconcile
      ? await reconcileReverseTrackingOutbox()
      : null;
    const relay = shouldDrain
      ? await drainReverseIntegrationOutbox()
      : null;

    // A execução sem exceção não significa que a reconciliação ou o relay
    // tenham concluído com sucesso. Preserve 207 como contrato legada da API,
    // mas nunca anuncie ok:true quando houver falha ou pendência interna.
    const outcome = reverseDrainOutcome(reconciliation, relay);
    return NextResponse.json(
      { ok: outcome.ok, reconciliation, relay },
      { status: outcome.httpStatus },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no pipeline reverso.';
    console.error('[integration/reverse-pipeline]', message);
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}
