import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/admin';
import { drainReverseIntegrationEventIds } from '@/lib/integration/server/reverseRelay';
import { recentReverseOutboxIssues, reverseOutboxStats } from '@/lib/integration/server/reverseOutboxRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_EMAIL = 'alefejohsefe@gmail.com';

async function authorize(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const decoded = await adminAuth.verifyIdToken(header.slice(7));
  const email = String(decoded.email || '').trim().toLowerCase();
  const configured = (process.env.DFL_ADMIN_EMAILS || OWNER_EMAIL)
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!email || !configured.includes(email)) throw new Error('UNAUTHORIZED');
}

function failure(error: unknown) {
  const unauthorized = error instanceof Error && error.message === 'UNAUTHORIZED';
  return NextResponse.json(
    { ok: false, error: unauthorized ? 'Nao autorizado.' : 'Nao foi possivel consultar a recuperacao.' },
    { status: unauthorized ? 401 : 500 },
  );
}

export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    const [stats, issues] = await Promise.all([reverseOutboxStats(), recentReverseOutboxIssues()]);
    return NextResponse.json({ ok: true, stats, issues });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req);
    const body = await req.json().catch(() => ({})) as { eventId?: unknown };
    const eventId = String(body.eventId || '').trim();
    if (!eventId || eventId.length > 240) {
      return NextResponse.json({ ok: false, error: 'Evento invalido.' }, { status: 400 });
    }
    const relay = await drainReverseIntegrationEventIds([eventId], { allowDeadLetter: true });
    return NextResponse.json({ ok: relay.ok, relay }, { status: relay.ok ? 200 : 409 });
  } catch (error) {
    return failure(error);
  }
}
