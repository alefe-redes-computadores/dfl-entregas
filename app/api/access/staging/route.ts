/**
 * R23: Verificação e PREPARAÇÃO de funcionários. Nunca ativa uma conta.
 * Firebase Admin SDK contorna as Rules: owner UID + token revogado são obrigatórios.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid, DFL_SUPERADMIN_UID } from '@/lib/access/roles';
import {
  projectDelivery, projectHome, projectProduct, projectPurchase, projectRoute, stageReadPermissions,
  type ProjectedStaffRow,
} from '@/lib/access/staffProjection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);
const CONFIRM = 'PREPARAR SEM LIBERAR LOGIN';
const ID = /^[A-Za-z0-9_-]{8,120}$/;
const sections = ['home', 'routes', 'deliveries', 'stock', 'purchases'] as const;
type Section = typeof sections[number];
type Item = { id: string; value: ProjectedStaffRow };
type Snapshot = Record<Section, Item[]>;
function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return ORIGINS.has(origin) ? {
    'access-control-allow-origin': origin, 'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization,content-type', 'vary':'Origin',
  } : {};
}
function reply(req: NextRequest, data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { ...cors(req), 'cache-control': 'no-store' } });
}
export function OPTIONS(req: NextRequest) {
  if (!ORIGINS.has(req.headers.get('origin') || '')) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: cors(req) });
}
async function ownerAuth(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const token = await adminAuth.verifyIdToken(header.slice(7), true);
    return isSuperadminUid(token.uid);
  } catch { return false; }
}
function safeEmail(email: string) {
  const [local, host] = email.split('@');
  return `${local.slice(0, 2)}***@${host || '***'}`;
}
const lower = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
function draftDigest(draft: DocumentData): string {
  const canonical = {name:draft.name,email:draft.email,role:draft.role,permissions:draft.permissions,status:draft.status,updatedAt:draft.updatedAt,linkedMotoboyId:draft.linkedMotoboyId,linkedMemberId:draft.linkedMemberId};
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
function emptySnapshot(): Snapshot {
  return { home:[], routes:[], deliveries:[], stock:[], purchases:[] };
}
async function buildSnapshot(draft: DocumentData): Promise<Snapshot> {
  const perms = stageReadPermissions(draft.permissions);
  const allowed = (permission: string) => perms.includes(permission as typeof perms[number]);
  const out = emptySnapshot();
  const linked = typeof draft.linkedMotoboyId === 'string' ? draft.linkedMotoboyId.trim() : '';
  if (draft.role === 'motoboy' && !linked) throw new Error('Motoboy sem cadastro vinculado.');
  const routeIds: string[] = [];
  if ((allowed('routes_read') || allowed('deliveries_read')) && linked) {
    const snapshot = await adminDb.collection('routes').where('motoboy_id', '==', linked).limit(30).get();
    for (const doc of snapshot.docs) {
      routeIds.push(doc.id);
      if (allowed('routes_read')) out.routes.push({ id: doc.id, value: projectRoute(doc.data(), doc.id) });
    }
  }
  // LIMITAÇÃO INTENCIONAL: consulta somente rotas associadas pelo ID do motoboy,
  // nunca por nome aproximado; no máximo 4 rotas x 10 entregas por preview.
  if (allowed('deliveries_read') && routeIds.length) {
    for (const routeId of routeIds.slice(0, 4)) {
      const snap = await adminDb.collection('deliveries').where('route_id', '==', routeId).limit(10).get();
      for (const doc of snap.docs) out.deliveries.push({ id: doc.id, value: projectDelivery(doc.data(), doc.id) });
    }
  }
  if (allowed('stock_read') && draft.role !== 'motoboy') {
    const snap = await adminDb.collection('stock_products').limit(30).get();
    out.stock = snap.docs.map(doc => ({id:doc.id, value:projectProduct(doc.data(),doc.id)}));
  }
  if (allowed('purchases_read') && draft.role !== 'motoboy') {
    const snap = await adminDb.collection('stock_supplies').limit(30).get();
    out.purchases = snap.docs.map(doc => ({id:doc.id, value:projectPurchase(doc.data(),doc.id)}));
  }
  if (draft.role === 'compras') {out.routes = []; out.deliveries = [];}
  if (allowed('home')) out.home = [{id:'overview',value:projectHome({routes:out.routes.length,deliveries:out.deliveries.length,stock:out.stock.length,purchases:out.purchases.length})}];
  return out;
}
export async function POST(req: NextRequest) {
  if (!(await ownerAuth(req))) return reply(req, {ok:false,error:'Acesso administrativo não autorizado.'}, 403);
  let body: {operation?: unknown; draftId?: unknown; targetUid?: unknown; confirmation?: unknown; expectedDigest?: unknown};
  try { body = await req.json(); } catch {return reply(req,{ok:false,error:'Solicitação inválida.'},400);}
  const { operation, draftId, targetUid } = body;
  if (!['verify','preview','stage'].includes(String(operation)) ||
      typeof draftId !== 'string' || !ID.test(draftId) ||
      typeof targetUid !== 'string' || !ID.test(targetUid) || isSuperadminUid(targetUid)) {
    return reply(req,{ok:false,error:'Identificadores inválidos.'},400);
  }
  try {
    const snap = await adminDb.collection('staff_access_drafts').doc(draftId).get();
    if (!snap.exists) return reply(req,{ok:false,error:'Rascunho não encontrado.'},404);
    const draft = snap.data()!;
    if (draft.activation !== 'not_enabled' || draft.status !== 'rascunho' ||
        !['motoboy','compras','operacao','personalizado'].includes(draft.role) ||
        !lower(draft.email)) return reply(req,{ok:false,error:'Rascunho incompleto ou suspenso.'},409);
    const user = await adminAuth.getUser(targetUid);
    if (user.disabled || !user.email || !user.emailVerified || lower(user.email) !== lower(draft.email)) {
      return reply(req,{ok:false,error:'UID, e-mail verificado ou estado da conta não correspondem ao cadastro.'},409);
    }
    const verified = {uid:user.uid,displayName:draft.name, emailMasked:safeEmail(user.email), emailVerified:true};
    if (operation === 'verify') return reply(req,{ok:true,verified, accountStatus:'não ativado'});
    const digest = draftDigest(draft);
    if (operation === 'stage' && body.expectedDigest !== digest) return reply(req,{ok:false,error:'Rascunho alterado desde a prévia. Refaça a conferência.'},409);
    const projection = await buildSnapshot(draft);
    const counts = Object.fromEntries(sections.map(section=>[section,projection[section].length]));
    if (operation === 'preview') return reply(req,{ok:true,verified,counts,accountStatus:'não ativado',digest});
    if (body.confirmation !== CONFIRM) return reply(req,{ok:false,error:'Confirmação de preparação ausente.'},400);
    // Bloqueia a substituição de uma conta já ativa ou de UID vinculado a outro rascunho.
    const accountRef = adminDb.collection('staff_accounts').doc(user.uid);
    const existing = await accountRef.get();
    if (existing.exists && (existing.data()?.status !== 'suspended' || existing.data()?.draftId !== draftId)) {
      return reply(req,{ok:false,error:'UID já possui vínculo ou autorização diferente.'},409);
    }
    const old = await Promise.all(sections.map(section =>
      adminDb.collection('staff_workspaces').doc(user.uid).collection(section).limit(50).get()));
    const batch = adminDb.batch();
    old.forEach(section=>section.docs.forEach(doc=>batch.delete(doc.ref)));
    for (const section of sections) {
      for (const row of projection[section]) {
        batch.set(adminDb.collection('staff_workspaces').doc(user.uid).collection(section).doc(row.id), row.value);
      }
    }
    // DOIS TRAVAMENTOS: status suspenso + porta do app desligada + Rules owner-only.
    batch.set(accountRef, {
      uid:user.uid, draftId, displayName:String(draft.name).slice(0,120),
      role:draft.role,status:'suspended', permissions:stageReadPermissions(draft.permissions),
      ...(typeof draft.linkedMotoboyId==='string' && draft.linkedMotoboyId?{linkedMotoboyId:draft.linkedMotoboyId}:{}),
      ...(typeof draft.linkedMemberId==='string' && draft.linkedMemberId?{linkedMemberId:draft.linkedMemberId}:{}),
      updatedAt:new Date().toISOString(),
    });
    batch.set(adminDb.collection('staff_access_audit').doc(), {
      action:'staged_no_activation',targetId:draftId,targetUid:user.uid,
      actorUid:DFL_SUPERADMIN_UID,
      occurredAt:new Date().toISOString(),counts,
    });
    await batch.commit();
    return reply(req,{ok:true,verified,counts,staged:true,accountStatus:'suspended'});
  } catch (e) {
    // Nunca refletir token, e-mail completo nem detalhes internos do Admin SDK.
    console.error('[R23] Preparação administrativa não concluída', e instanceof Error ? e.name : 'unknown');
    return reply(req,{ok:false,error:'Não foi possível concluir a homologação. Verifique a configuração do servidor.'},500);
  }
}
