import { NextRequest, NextResponse } from 'next/server';
import { isIntegrationEventEnvelope } from '@/lib/integration/contracts';
import { consumeDflSiteOrderCreatedPersisted } from '@/lib/integration/server/siteOrderPersistence';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Falha de integração.';
  console.error('[integration/inbound]', message);
  return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status });
}

export async function POST(request: NextRequest) {
  let body = '';
  try {
    body = await request.text();
    if (!body || body.length > 512_000) return errorResponse(new Error('Payload vazio ou grande demais.'), 413);

    const event = JSON.parse(body) as unknown;
    if (!isIntegrationEventEnvelope(event)) return errorResponse(new Error('Envelope de integração inválido.'), 400);

    assertSignedIntegrationRequest({
      body,
      timestamp: request.headers.get('x-dfl-timestamp'),
      signature: request.headers.get('x-dfl-signature'),
      eventId: request.headers.get('x-dfl-event-id'),
      expectedEventId: event.event_id,
    });

    if (event.source_system !== 'dfl_site') return errorResponse(new Error('source_system não permitido neste endpoint.'), 400);

    if (event.event_type === 'order.created') {
      const result = await consumeDflSiteOrderCreatedPersisted(event);
      return NextResponse.json({ ok: true, accepted: true, ...result }, { status: result.already_processed ? 200 : 201 });
    }

    if (event.event_type === 'order.updated') {
      // Contrato reconhecido, mas sincronização de status é deliberadamente posterior.
      return NextResponse.json({ ok: false, accepted: false, deferred: true, error: 'order.updated ainda não habilitado.' }, { status: 422 });
    }

    return errorResponse(new Error(`event_type não suportado no inbound: ${event.event_type}`), 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const authFailure = /assinatura|timestamp|SIGNING_SECRET/i.test(message);
    return errorResponse(error, authFailure ? 401 : 400);
  }
}
