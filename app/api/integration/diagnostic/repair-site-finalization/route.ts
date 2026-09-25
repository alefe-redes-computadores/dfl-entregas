import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DELIVERY_ID = 'site-order-v1__b87JqrnHfEUrcNy190sI';
const EXTERNAL_ORDER_ID = 'b87JqrnHfEUrcNy190sI';

type Raw = Record<string, unknown>;

function equal(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function authorized(req: NextRequest) {
  const secret =
    process.env.DFL_REVERSE_WORKER_SECRET ||
    process.env.CRON_SECRET ||
    '';

  const auth = req.headers.get('authorization') || '';

  return (
    Boolean(secret) &&
    auth.startsWith('Bearer ') &&
    equal(auth.slice(7), secret)
  );
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedStatus(value: unknown) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function isFinalStatus(value: unknown) {
  const status = normalizedStatus(value);
  return status.includes('final') || status.includes('conclu');
}

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  if (req.method !== 'POST') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Use POST para executar o reparo.',
      },
      { status: 405 },
    );
  }

  const ref = adminDb.collection('deliveries').doc(DELIVERY_ID);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new Error('Delivery alvo não existe.');
    }

    const data = snap.data() as Raw;

    if (
      text(data.source_system) !== 'dfl_site' ||
      text(data.external_order_id) !== EXTERNAL_ORDER_ID
    ) {
      throw new Error(
        'Delivery alvo não corresponde à identidade DFL Site esperada.',
      );
    }

    if (!isFinalStatus(data.site_order_status)) {
      throw new Error(
        `Status do Site não é final: ${text(data.site_order_status) || '(vazio)'}`,
      );
    }

    if (data.completed === true) {
      return {
        changed: false,
        reason: 'already_completed',
        delivery_id: DELIVERY_ID,
        external_order_id: EXTERNAL_ORDER_ID,
        site_order_status: text(data.site_order_status),
        completed: true,
        completed_at: text(data.completed_at) || null,
      };
    }

    const now = new Date().toISOString();

    const completedAt =
      text(data.site_order_status_updated_at) ||
      text(data.site_order_last_event_at) ||
      now;

    tx.update(ref, {
      completed: true,
      completed_at: completedAt,
      operational_completion_source: 'dfl_site',
      operational_completion_pending_route: false,
      updated_at: now,
    });

    return {
      changed: true,
      reason: 'repaired_finalized_site_delivery',
      delivery_id: DELIVERY_ID,
      external_order_id: EXTERNAL_ORDER_ID,
      site_order_status: text(data.site_order_status),
      completed: true,
      completed_at: completedAt,
    };
  });

  return NextResponse.json({
    ok: true,
    repair: 'v49-site-finalization',
    ...result,
  });
}

export const POST = run;
export const GET = run;
