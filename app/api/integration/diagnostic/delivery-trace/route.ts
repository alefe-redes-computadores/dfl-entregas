import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SUFFIX = 'W00LYSZA';
const QUERY_LIMIT = 200;

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

  return Boolean(secret) &&
    auth.startsWith('Bearer ') &&
    equal(auth.slice(7), secret);
}

function suffixOf(req: NextRequest) {
  const raw =
    req.nextUrl.searchParams.get('suffix') ||
    DEFAULT_SUFFIX;

  const suffix = raw
    .replace(/^#/, '')
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{6,12}$/.test(suffix)) {
    throw new Error('Sufixo inválido.');
  }

  return suffix;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function scalar(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return '[timestamp]';
    }
  }

  return undefined;
}

function deliveryView(id: string, data: Raw) {
  return {
    delivery_id: id,
    external_order_id: scalar(data.external_order_id),
    source_system: scalar(data.source_system),

    customer_name:
      scalar(data.customer_name) ??
      scalar(data.client_name) ??
      scalar(data.name),

    completed: scalar(data.completed),
    completed_at: scalar(data.completed_at),

    route_id: scalar(data.route_id),
    order_index: scalar(data.order_index),
    stop_group_id: scalar(data.stop_group_id),

    site_order_status: scalar(data.site_order_status),
    site_order_status_updated_at:
      scalar(data.site_order_status_updated_at),

    operational_completion_source:
      scalar(data.operational_completion_source),

    operational_completion_pending_route:
      scalar(data.operational_completion_pending_route),

    created_at: scalar(data.created_at),
    updated_at: scalar(data.updated_at),
    order_updated_at: scalar(data.order_updated_at),
  };
}

function routeView(id: string, data: Raw) {
  return {
    route_id: id,
    name: scalar(data.name),
    status: scalar(data.status),

    motoboy_id: scalar(data.motoboy_id),
    motoboy_name: scalar(data.motoboy_name),

    started_at: scalar(data.started_at),
    departure_time: scalar(data.departure_time),
    end_time: scalar(data.end_time),

    created_at: scalar(data.created_at),
    updated_at: scalar(data.updated_at),
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const suffix = suffixOf(req);

    /*
     * READ ONLY.
     *
     * Duas consultas rigidamente limitadas:
     * - até 200 deliveries dfl_site ainda ativas;
     * - até 200 deliveries dfl_site concluídas.
     *
     * Não existe escrita, reconciliação ou relay nesta rota.
     */
    const [activeSnap, completedSnap, generalSnap] = await Promise.all([
      adminDb
        .collection('deliveries')
        .where('source_system', '==', 'dfl_site')
        .where('completed', '==', false)
        .limit(QUERY_LIMIT)
        .get(),

      adminDb
        .collection('deliveries')
        .where('source_system', '==', 'dfl_site')
        .where('completed', '==', true)
        .limit(QUERY_LIMIT)
        .get(),

      // V48 ghost trace: amostra operacional limitada, sem scan histórico.
      adminDb
        .collection('deliveries')
        .limit(QUERY_LIMIT)
        .get(),
    ]);

    const docs = new Map<
      string,
      FirebaseFirestore.QueryDocumentSnapshot
    >();

    for (const doc of [...activeSnap.docs, ...completedSnap.docs]) {
      docs.set(doc.id, doc);
    }

    // Inclui a amostra geral apenas para localizar registros legados/manuais
    // que não tenham source_system=dfl_site.
    for (const doc of generalSnap.docs) {
      docs.set(doc.id, doc);
    }

    const allDocs = [...docs.values()];

    const matches = allDocs.filter((doc) => {
      const data = doc.data() as Raw;
      const externalOrderId =
        text(data.external_order_id).trim().toUpperCase();
      const deliveryId = doc.id.trim().toUpperCase();

      return (
        externalOrderId.endsWith(suffix) ||
        deliveryId.endsWith(suffix)
      );
    });

    const activeSiteDeliveries = activeSnap.docs.map((doc) =>
      deliveryView(doc.id, doc.data() as Raw)
    );

    const sourceCounts: Record<string, number> = {};
    for (const doc of generalSnap.docs) {
      const data = doc.data() as Raw;
      const source = text(data.source_system).trim() || '(sem source_system)';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }

    const results = [];

    for (const doc of matches) {
      const data = doc.data() as Raw;
      const routeId = text(data.route_id).trim();

      let route = null;

      if (routeId) {
        const routeSnap =
          await adminDb.collection('routes').doc(routeId).get();

        route = routeSnap.exists
          ? routeView(routeSnap.id, routeSnap.data() as Raw)
          : {
              route_id: routeId,
              missing: true,
            };
      }

      results.push({
        delivery: deliveryView(doc.id, data),
        route,
      });
    }

    return NextResponse.json(
      {
        ok: matches.length > 0,
        read_only: true,
        target_suffix: suffix,

        scan: {
          active_limit: QUERY_LIMIT,
          completed_limit: QUERY_LIMIT,
          active_read: activeSnap.size,
          completed_read: completedSnap.size,
          general_limit: QUERY_LIMIT,
          general_read: generalSnap.size,
          unique_deliveries_read: docs.size,
        },

        active_site_deliveries: activeSiteDeliveries,
        general_source_counts: sourceCounts,
        matches: results,

        error:
          matches.length === 0
            ? 'Delivery do pedido alvo não encontrada na janela limitada.'
            : null,
      },
      { status: matches.length > 0 ? 200 : 404 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha no diagnóstico.';

    console.error(
      '[integration/diagnostic/delivery-trace]',
      message,
    );

    return NextResponse.json(
      {
        ok: false,
        read_only: true,
        error: message,
      },
      { status: 500 },
    );
  }
}
