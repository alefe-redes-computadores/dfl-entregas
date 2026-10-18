import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { traceSummary, type TraceEvent } from '@/lib/integration/messageTrace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_EMAIL = 'alefejohsefe@gmail.com';
const MAX_EVENTS = 50;
const NATIVE_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')?.trim() || '';
  return NATIVE_ORIGINS.has(origin) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization',
    'access-control-max-age': '600',
    'vary': 'Origin',
  } : {};
}

function json(req: NextRequest, body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, { ...init, headers: { ...init?.headers, ...corsHeaders(req) } });
}

export async function OPTIONS(req: NextRequest) {
  if (!NATIVE_ORIGINS.has(req.headers.get('origin')?.trim() || '')) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function safeError(value: unknown): string | null {
  const message = asText(value);
  if (!message) return null;
  const match = message.match(/HTTP\s*(\d{3})/i);
  if (match) return `Site respondeu HTTP ${match[1]}. Consulte os logs protegidos para os detalhes.`;
  if (/abort|timeout|timed out/i.test(message)) return 'Tempo limite esgotado ao contatar o Site.';
  if (/network|fetch|ECONN|ENOTFOUND|EAI_AGAIN|DNS/i.test(message)) return 'Falha de rede entre Entregas e Site.';
  return 'Falha no relay. Consulte os logs protegidos para detalhes.';
}

async function authorize(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const decoded = await adminAuth.verifyIdToken(header.slice(7));
  const email = String(decoded.email || '').trim().toLowerCase();
  const configured = (process.env.DFL_ADMIN_EMAILS || OWNER_EMAIL)
    .split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (!email || !configured.includes(email)) throw new Error('UNAUTHORIZED');
}

function safeId(raw: string) {
  const id = raw.trim().replace(/^#/, '');
  // O ID inteiro é obrigatório: um código abreviado não identifica um pedido com segurança.
  if (id.length < 9 || id.length > 160 || /[\/\?#\s]/.test(id)) return null;
  return id;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  try {
    await authorize(req);
  } catch {
    return json(req, { ok: false, error: 'Não autorizado.' }, { status: 401 });
  }
  const id = safeId(req.nextUrl.searchParams.get('id') || '');
  if (!id) {
    return json(req, { ok: false, error: 'Informe o ID COMPLETO do pedido do Site ou da entrega (não apenas o sufixo mostrado no card).' }, { status: 400 });
  }

  try {
    const deliveries = adminDb.collection('deliveries');
    // Somente leituras sob demanda: 1 documento + busca exata limitada.
    const direct = await deliveries.doc(id).get();
    const matched = direct.exists
      ? [direct]
      : (await deliveries.where('external_order_id', '==', id).limit(2).get()).docs;
    if (matched.length !== 1) {
      return json(req, { ok: false, readOnly: true, error: matched.length ? 'ID corresponde a mais de uma entrega. Informe o ID da entrega.' : 'Entrega não localizada com este ID inteiro.' }, { status: matched.length ? 409 : 404 });
    }
    const doc = matched[0];
    const data = doc.data() || {};
    if (data.source_system !== 'dfl_site' || !asText(data.external_order_id)) {
      return json(req, { ok: false, readOnly: true, error: 'Essa entrega não está vinculada a um pedido do DFL Site.' }, { status: 422 });
    }

    const outbox = await adminDb.collection('integration_outbox')
      .where('entity_id', '==', doc.id).limit(MAX_EVENTS).get();
    const events: TraceEvent[] = outbox.docs
      .filter(item => item.data().source_system === 'dfl_entregas')
      .map(item => {
        const event = item.data();
        return {
          eventId: asText(event.event_id) || item.id,
          eventType: asText(event.event_type) || 'unknown',
          status: asText(event.status) || 'unknown',
          attempts: Math.max(0, Number(event.attempts) || 0),
          occurredAt: asText(event.occurred_at),
          processedAt: asText(event.processed_at),
          lastError: safeError(event.last_error),
        };
      }).sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''));

    const completed = data.completed === true;
    return json(req, {
      ok: true,
      readOnly: true,
      whatsappVerified: false,
      diagnosticScope: 'entregas_to_site_only',
      delivery: {
        id: doc.id,
        siteOrderId: asText(data.external_order_id),
        routeId: asText(data.route_id),
        completed,
      },
      summary: traceSummary(events, completed),
      events,
      sample: { examined: outbox.size, limit: MAX_EVENTS, incomplete: outbox.size >= MAX_EVENTS },
      nextStep: 'Quando o relay estiver sent, consultar no DFL Site integration_notification_intents e, depois, o worker da VPS. Não reenviar automaticamente.',
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('[message-trace] Falha na leitura administrativa', error instanceof Error ? error.message : 'unknown');
    return json(req, { ok: false, readOnly: true, error: 'Não foi possível consultar o diagnóstico deste pedido.' }, { status: 500 });
  }
}
