/** R27: intents auditaveis, SEM mutar entregas, clientes, rotas ou estoque. */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/integration/server/admin';
import { isSuperadminUid, DFL_SUPERADMIN_UID } from '@/lib/access/roles';
import { deliveryEligibleForRequest, maySubmitStaffOperation, parseStaffOperation, sameRequest, validUid } from '@/lib/access/staffOperationPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ORIGINS = new Set(['https://localhost','http://localhost','capacitor://localhost']);
const confirmReview = 'CONFERI MANUALMENTE';
function cors(req: NextRequest): Record<string,string> {
  const origin = req.headers.get('origin') || '';
  return ORIGINS.has(origin) ? {'access-control-allow-origin': origin, 'access-control-allow-methods':'GET,POST,OPTIONS', 'access-control-allow-headers':'authorization,content-type',vary:'Origin'} : {};
}
function reply(req: NextRequest, value: unknown, status=200) {
  return NextResponse.json(value,{status,headers:{...cors(req),'cache-control':'no-store, max-age=0'}});
}
export function OPTIONS(req: NextRequest) {
  if (!ORIGINS.has(req.headers.get('origin') || '')) return new NextResponse(null,{status:403});
  return new NextResponse(null,{status:204,headers:cors(req)});
}
async function identity(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ') || header.length > 5500) return null;
  try {
    const token = await adminAuth.verifyIdToken(header.slice(7),true);
    return token.uid;
  } catch {return null;}
}
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,220}$/.test(v);
function sanitizeRow(id: string, source: Record<string,unknown>) {
  return {
    id, kind: source.kind === 'delivery_confirmation' ? 'delivery_confirmation' : 'purchase_intent',
    targetId: String(source.targetId || '').slice(0,120),
    status: String(source.status || '').slice(0,20),
    actorName: String(source.actorName || 'Funcionario').slice(0,100),
    actorUid: String(source.actorUid || '').slice(0,120),
    createdAt: String(source.createdAt || ''),
    note: String(source.note || '').slice(0,120),
    quantity: typeof source.quantity === 'number' ? source.quantity : undefined,
    unit: String(source.unit || '').slice(0,12),
    resultAt: String(source.resultAt || ''),
  };
}
export async function GET(req: NextRequest) {
  const uid = await identity(req);
  if (!isSuperadminUid(uid)) return reply(req,{ok:false,error:'Acesso negado.'},403);
  try {
    const snap = await adminDb.collection('staff_operation_requests').where('status','==','pending').limit(40).get();
    const rows: ReturnType<typeof sanitizeRow>[] = (snap.docs as Array<{ id: string; data: () => Record<string,unknown> }>).map(d => sanitizeRow(d.id,d.data())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return reply(req,{ok:true,rows,limited:snap.size===40});
  } catch {
    return reply(req,{ok:false,error:'Não foi possível consultar solicitações.'},500);
  }
}
export async function POST(req: NextRequest) {
  const uid = await identity(req);
  if (!uid || !validUid(uid)) return reply(req,{ok:false,error:'Sessão inválida.'},401);
  const raw = await req.text().catch(()=> '');
  if (!raw || raw.length > 2048) return reply(req,{ok:false,error:'Solicitação inválida.'},400);
  let body: Record<string,unknown>;
  try {body=JSON.parse(raw) as Record<string,unknown>;} catch {return reply(req,{ok:false,error:'JSON inválido.'},400);}
  if (isSuperadminUid(uid)) {
    if (body.operation !== 'review' || !safeId(body.id) || !['reviewed','dismissed'].includes(String(body.decision)) || body.confirmation !== confirmReview) {
      return reply(req,{ok:false,error:'Revisão sem confirmação válida.'},400);
    }
    const id = body.id;
    try {
      const result=await adminDb.runTransaction(async tx=>{
        const ref=adminDb.collection('staff_operation_requests').doc(id);
        const snap=await tx.get(ref);
        if (!snap.exists) return 'missing';
        const v=snap.data() || {};
        if (v.status!=='pending') return 'stale';
        const lease=v.execution as Record<string,unknown>|undefined;
        if (lease && typeof lease.expiresAt==='string' && Date.parse(lease.expiresAt)>Date.now()) return 'locked';
        const now=new Date().toISOString();
        tx.update(ref,{status:body.decision,resultAt:now,reviewedByUid:DFL_SUPERADMIN_UID});
        tx.set(adminDb.collection('staff_access_audit').doc(), {action:'staff_operation_reviewed',requestId:id,decision:body.decision,actorUid:DFL_SUPERADMIN_UID,occurredAt:now});
        return 'ok';
      });
      return result==='ok' ? reply(req,{ok:true}) : reply(req,{ok:false,error:result==='missing'?'Solicitação não encontrada.':'Solicitação já tratada; atualize a fila.'},409);
    } catch {return reply(req,{ok:false,error:'Falha ao revisar solicitação.'},500);}
  }
  // Duas travas independentes: flag de backend e status ativo confirmado na transação.
  if (process.env.DFL_STAFF_OPERATION_REQUESTS_ENABLED !== 'true') {
    return reply(req,{ok:false,error:'Solicitações operacionais ainda não liberadas.'},403);
  }
  const input = parseStaffOperation(body);
  if (!input) return reply(req,{ok:false,error:'Dados de solicitação inválidos.'},400);
  const requestDocId=`${uid}__${input.requestId}`;
  const requests=adminDb.collection('staff_operation_requests').doc(requestDocId);
  try {
    const result=await adminDb.runTransaction(async tx=>{
      const accountSnap=await tx.get(adminDb.collection('staff_accounts').doc(uid));
      const account=accountSnap.data() || {};
      if (!accountSnap.exists || !maySubmitStaffOperation(account,uid,input.kind)) return 'denied' as const;
      const prior=await tx.get(requests);
      if (prior.exists) return sameRequest(prior.data() || {},input,uid) ? 'duplicate' as const : 'collision' as const;
      const section=input.kind==='delivery_confirmation'?'deliveries':'stock';
      const projected=await tx.get(adminDb.collection('staff_workspaces').doc(uid).collection(section).doc(input.targetId));
      if (!projected.exists) return 'unlisted' as const;
      let routeId='';
      let unit='';
      if (input.kind==='delivery_confirmation') {
        const deliverySnap=await tx.get(adminDb.collection('deliveries').doc(input.targetId));
        if (!deliverySnap.exists) return 'invalid' as const;
        const delivery=deliverySnap.data() || {};
        routeId=typeof delivery.route_id==='string' ? delivery.route_id : '';
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(routeId)) return 'invalid' as const;
        const routeSnap=await tx.get(adminDb.collection('routes').doc(routeId));
        if (!routeSnap.exists || !deliveryEligibleForRequest(delivery, routeSnap.data() || {}, String(account.linkedMotoboyId || ''),routeId,account.role)) return 'invalid' as const;
      } else {
        const productSnap=await tx.get(adminDb.collection('stock_products').doc(input.targetId));
        if (!productSnap.exists || productSnap.data()?.active===false) return 'invalid' as const;
        unit=typeof productSnap.data()?.unit === 'string' ? String(productSnap.data()?.unit).slice(0,12) : '';
        if (!unit) return 'invalid' as const;
      }
      const now=new Date().toISOString();
      tx.create(requests,{
        kind:input.kind,targetId:input.targetId,actorUid:uid,actorName:String(account.displayName || 'Equipe').slice(0,100),
        status:'pending',createdAt:now,requestId:input.requestId,
        ...(routeId?{routeId}:{}),...(unit?{unit}:{}),...(input.quantity?{quantity:input.quantity}:{}),
        ...(input.note?{note:input.note}:{}),
        // O campo staff jamais concede baixa, compra, valor financeiro ou escrita no estoque.
        effect:'none_owner_review_required',
      });
      return 'created' as const;
    });
    if (result==='denied' || result==='unlisted') return reply(req,{ok:false,error:'Permissão insuficiente ou registro não disponível.'},403);
    if (result==='invalid' || result==='collision') return reply(req,{ok:false,error:'Registro não elegível ou solicitação duplicada divergente.'},409);
    return reply(req,{ok:true,requestId:requestDocId,duplicate:result==='duplicate',status:'pending',effect:'none_owner_review_required'});
  } catch (e) {
    console.error('[R27] Falha ao preparar solicitação',e instanceof Error?e.name:'unknown');
    return reply(req,{ok:false,error:'Não foi possível registrar solicitação. Confira a conexão.'},500);
  }
}
