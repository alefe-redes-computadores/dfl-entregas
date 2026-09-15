import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reverseRelayConfig } from '@/lib/integration/server/reverseConfig';
import { drainReverseIntegrationOutbox } from '@/lib/integration/server/reverseRelay';
import { reverseOutboxStats } from '@/lib/integration/server/reverseOutboxRepository';
import { reconcileReverseTrackingOutbox } from '@/lib/integration/server/reverseReconciler';

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
      if (text.trim()) body = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
    }

    const shouldReconcile = body.reconcile !== false;
    const shouldDrain = body.drain !== false;

    const reconciliation = shouldReconcile
      ? await reconcileReverseTrackingOutbox()
      : null;
    const relay = shouldDrain
      ? await drainReverseIntegrationOutbox()
      : null;

    const failed = relay?.failed || 0;
    return NextResponse.json(
      { ok: failed === 0, reconciliation, relay },
      { status: failed ? 207 : 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no pipeline reverso.';
    console.error('[integration/reverse-pipeline]', message);
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 });
  }
}
