/**
 * V111 R24: suspensao administrativa fail-closed; NUNCA concede ativacao.
 * Admin SDK contorna regras Firestore: verifica UID fixo e revogacao do token do ator.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid, DFL_SUPERADMIN_UID } from '@/lib/access/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);
const UID = /^[A-Za-z0-9_-]{8,120}$/;
const SECTIONS = ['home', 'routes', 'deliveries', 'stock', 'purchases'] as const;
const CONFIRMATION = 'REVOGAR E LIMPAR ACESSO';

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return ORIGINS.has(origin)
    ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      vary: 'Origin',
    }
    : {};
}
function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { ...cors(req), 'cache-control': 'private, no-store' },
  });
}
export function OPTIONS(req: NextRequest) {
  if (!ORIGINS.has(req.headers.get('origin') || '')) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: cors(req) });
}
async function authorized(req: NextRequest): Promise<boolean> {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const claims = await adminAuth.verifyIdToken(header.slice(7), true);
    return isSuperadminUid(claims.uid);
  } catch {
    return false;
  }
}
type Body = {
  operation?: unknown;
  targetUid?: unknown;
  expectedUpdatedAt?: unknown;
  confirmation?: unknown;
};
function validBody(value: Body): value is Body & {targetUid: string} {
  return typeof value.targetUid === 'string' && UID.test(value.targetUid)
    && !isSuperadminUid(value.targetUid);
}

/** Remove somente as projecoes permitidas, nao as colecoes originais da loja. */
async function purgeWorkspace(uid: string): Promise<number> {
  let deleted = 0;
  for (const section of SECTIONS) {
    const col = adminDb.collection('staff_workspaces').doc(uid).collection(section);
    // Nao supor apenas 40 docs: restos de versoes antigas tambem sao eliminados.
    for (let pass = 0; pass < 30; pass += 1) {
      const snap = await col.limit(150).get();
      if (snap.empty) break;
      const batch = adminDb.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += snap.size;
      if (pass === 29) throw new Error('PURGE_INCOMPLETE');
    }
  }
  return deleted;
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return json(req, {ok:false,error:'Acesso administrativo não autorizado.'}, 403);
  let body: Body;
  try { body = await req.json() as Body; } catch { return json(req,{ok:false,error:'Solicitação inválida.'},400); }
  if (!validBody(body) || !['inspect','revoke'].includes(String(body.operation))) {
    return json(req,{ok:false,error:'UID ou operação inválidos.'},400);
  }
  const ref = adminDb.collection('staff_accounts').doc(body.targetUid);
  try {
    if (body.operation === 'inspect') {
      const account = await ref.get();
      if (!account.exists) return json(req,{ok:false,error:'UID não possui acesso preparado.'},404);
      const record = account.data() || {};
      return json(req, {
        ok:true,
        account: {
          uid: body.targetUid,
          displayName: String(record.displayName || '').slice(0,100),
          role: String(record.role || 'desconhecido').slice(0,30),
          status: record.status === 'active' ? 'active' : 'suspended',
          updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
        },
      });
    }
    if (body.confirmation !== CONFIRMATION || typeof body.expectedUpdatedAt !== 'string') {
      return json(req,{ok:false,error:'Confirme a revogação após consultar o cadastro atualizado.'},400);
    }
    // PRIMEIRO suspende e remove permissoes de forma atomica. Mesmo se a limpeza
    // ou a API do Auth falhar depois, novas leituras pelo Firestore sao negadas.
    const outcome = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 'missing' as const;
      const before = snap.data() || {};
      if (before.updatedAt !== body.expectedUpdatedAt) return 'stale' as const;
      if (before.uid !== body.targetUid) return 'invalid' as const;
      const now = new Date().toISOString();
      tx.update(ref, {
        status: 'suspended',
        permissions: [],
        linkedMotoboyId: null,
        linkedMemberId: null,
        updatedAt: now,
        revokedAt: now,
        revokedByUid: DFL_SUPERADMIN_UID,
      });
      tx.set(adminDb.collection('staff_access_audit').doc(), {
        action:'access_revoked', targetUid:body.targetUid,
        actorUid:DFL_SUPERADMIN_UID, occurredAt:now,
        previousStatus:before.status === 'active' ? 'active' : 'suspended',
      });
      return 'suspended' as const;
    });
    if (outcome === 'missing') return json(req,{ok:false,error:'Conta não encontrada.'},404);
    if (outcome === 'stale') return json(req,{ok:false,error:'Cadastro alterado. Consulte novamente antes de revogar.'},409);
    if (outcome === 'invalid') return json(req,{ok:false,error:'Identidade da conta inconsistente.'},409);
    const warnings: string[] = [];
    try {
      await adminAuth.revokeRefreshTokens(body.targetUid);
    } catch {
      warnings.push('Tokens: a revogação no Firebase Auth precisa ser repetida. A conta permanece suspensa.');
    }
    let removed = 0;
    try {
      removed = await purgeWorkspace(body.targetUid);
    } catch {
      warnings.push('Projeções: limpeza parcial ou indisponível. A conta permanece suspensa, sem acesso pelos Rules.');
    }
    return json(req,{ok:warnings.length===0, suspended:true, removed, warnings,
      ...(warnings.length?{error:'Acesso suspenso; há pendências de limpeza que exigem nova tentativa.'}:{})},warnings.length?207:200);
  } catch (error) {
    console.error('[R24] Falha administrativa de revogação', error instanceof Error ? error.name : 'unknown');
    return json(req,{ok:false,error:'Não foi possível confirmar a revogação. Consulte novamente o estado da conta.'},500);
  }
}
