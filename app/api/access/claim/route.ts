/** R41: safe account linking request, NOT permission activation. */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid } from '@/lib/access/roles';
import { claimableDraft, claimableIdentity, claimOriginAllowed } from '@/lib/access/staffClaimPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ID = /^[A-Za-z0-9_-]{8,120}$/;
const OWNER_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);
const reply = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } });
function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  if (OWNER_ORIGINS.has(origin) || claimOriginAllowed(origin, req.nextUrl.origin)) return {
    'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'Origin',
  };
  return {};
}
export function OPTIONS(req: NextRequest) {
  const headers = cors(req);
  return new NextResponse(null, { status: headers['access-control-allow-origin'] ? 204 : 403, headers });
}
async function actor(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || header.length > 5500) return null;
  try { return await adminAuth.verifyIdToken(header.slice(7), true); } catch { return null; }
}
/** Staff submits only its own verified Google identity; draft assignment is decided server-side. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  if (!claimOriginAllowed(origin, req.nextUrl.origin) || process.env.DFL_STAFF_LINK_REQUESTS_ENABLED !== 'true') {
    return reply({ ok:false, error:'Solicitações de vínculo indisponíveis.' }, 403, cors(req));
  }
  const token = await actor(req);
  if (!token || token.firebase?.sign_in_provider !== 'google.com' || !claimableIdentity(token.uid, token.email, token.email_verified === true, false)) {
    return reply({ ok:false, error:'Entre com um e-mail Google verificado.' }, 403, cors(req));
  }
  try {
    // Firebase Auth is authoritative, not email/role/UID in a request body.
    const person = await adminAuth.getUser(token.uid);
    if (!claimableIdentity(person.uid, person.email, person.emailVerified, person.disabled) ||
        !person.providerData.some(provider => provider.providerId === 'google.com') ||
        person.email!.toLowerCase() !== token.email!.toLowerCase()) {
      return reply({ ok:false, error:'Conta Google não validada.' }, 403, cors(req));
    }
    const email = person.email!.trim().toLowerCase();
    const drafts = await adminDb.collection('staff_access_drafts').where('email', '==', email).limit(2).get();
    if (drafts.docs.length !== 1 || !claimableDraft({ ...drafts.docs[0].data(), id:drafts.docs[0].id }, email)) {
      return reply({ ok:false, error:'Seu cadastro não está pronto. Solicite um convite ao administrador.' }, 403, cors(req));
    }
    const draftId = drafts.docs[0].id;
    const draftRef = adminDb.collection('staff_access_drafts').doc(draftId);
    const accountRef = adminDb.collection('staff_accounts').doc(token.uid);
    const ref = adminDb.collection('staff_link_requests').doc(token.uid);
    // R64: all three authority checks run inside the same Firestore transaction.
    // A stale invitation cannot be written after the owner revokes that draft.
    const outcome = await adminDb.runTransaction(async tx => {
      const freshDraft = await tx.get(draftRef);
      const account = await tx.get(accountRef);
      const old = await tx.get(ref);
      if (!freshDraft.exists || !claimableDraft({...freshDraft.data(),id:draftId},email)) return 'invitation_changed' as const;
      if (account.exists && (account.data()?.draftId !== draftId || account.data()?.status === 'active')) return 'bound' as const;
      if (old.exists) {
        const previous = old.data() || {};
        if (previous.uid !== token.uid || previous.email !== email || previous.draftId !== draftId) return 'collision' as const;
        // Idempotence is permanent while pending: never resurrect a reviewed or revoked request.
        return previous.status === 'pending' ? 'already_pending' as const : 'already_resolved' as const;
      }
      const now = new Date().toISOString();
      tx.create(ref, { uid:token.uid, draftId, email, status:'pending', createdAt:now, updatedAt:now });
      return 'created' as const;
    });
    if (outcome === 'invitation_changed') return reply({ok:false,error:'Convite alterado ou revogado. Solicite ao administrador uma nova conferência.'},409,cors(req));
    if (outcome === 'bound' || outcome === 'collision' || outcome === 'already_resolved') {
      return reply({ok:false,error:'Vínculo já analisado ou associado a outro cadastro. Consulte o administrador.'},409,cors(req));
    }
    return reply({ok:true,state:'pending',message:outcome === 'created' ? 'Pedido recebido. Aguarde a homologação do administrador.' : 'Solicitação já recebida. Aguarde a conferência.'},200,cors(req));
  } catch (error) {
    console.error('[R41] Vínculo não registrado', error instanceof Error ? error.name : 'unknown');
    return reply({ok:false,error:'Serviço de vínculo temporariamente indisponível.'}, 503, cors(req));
  }
}
/** Owner-only: explicit, bounded lookup of pending requests for a selected draft. */
export async function GET(req: NextRequest) {
  const token = await actor(req);
  if (!token || !isSuperadminUid(token.uid)) return reply({ok:false,error:'Acesso administrativo negado.'},403,cors(req));
  const draftId = req.nextUrl.searchParams.get('draftId') || '';
  if (!ID.test(draftId)) return reply({ok:false,error:'Cadastro inválido.'},400,cors(req));
  try {
    const draft = await adminDb.collection('staff_access_drafts').doc(draftId).get();
    if (!draft.exists || draft.data()?.status !== 'rascunho' || draft.data()?.activation !== 'not_enabled') {
      return reply({ok:false,error:'Cadastro não disponível.'},409,cors(req));
    }
    const email = draft.data()?.email;
    if (typeof email !== 'string' || !email) return reply({ok:false,error:'Cadastro sem e-mail.'},409,cors(req));
    const results = await adminDb.collection('staff_link_requests').where('email','==',email.trim().toLowerCase()).limit(10).get();
    const claims = results.docs.filter(d=>d.data().draftId === draftId && d.data().status === 'pending' && ID.test(d.id))
      .map(d=>({uid:d.id,receivedAt: typeof d.data().updatedAt === 'string' ? d.data().updatedAt : ''}))
      .sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
    return reply({ok:true,claims},200,cors(req));
  } catch (error) {
    console.error('[R41] Consulta administrativa de vínculos indisponível',error instanceof Error?error.name:'unknown');
    return reply({ok:false,error:'Não foi possível consultar solicitações.'},503,cors(req));
  }
}
