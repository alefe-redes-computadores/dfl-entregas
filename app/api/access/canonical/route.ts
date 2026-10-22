/** R28: reconcilia solicitações com operações REAIS feitas pelos fluxos canônicos do OWNER.
 * Não dá baixa por Admin SDK, não altera saldos nem concede acesso de funcionário.
 */
import {randomUUID} from 'node:crypto';
import {NextRequest, NextResponse} from 'next/server';
import {adminAuth, adminDb} from '@/lib/integration/server/admin';
import {isSuperadminUid, DFL_SUPERADMIN_UID} from '@/lib/access/roles';
import {
  canonicalRequestId, canonicalSourceId, eligibleDeliveryClaim,
  verifiedCanonicalDelivery, verifyIntegratedSupply, existingOutcome,
} from '@/lib/access/staffCanonicalPolicy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const NATIVE_ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const CONFIRM='APLICAR FLUXO CANONICO';
const SECONDS=180;
function cors(req:NextRequest):Record<string,string>{
  const origin=req.headers.get('origin')||'';
  return NATIVE_ORIGINS.has(origin)?{
    'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization,content-type',vary:'Origin',
  }:{};
}
function json(req:NextRequest,value:unknown,status=200){
  return NextResponse.json(value,{status,headers:{...cors(req),'cache-control':'private, no-store'}});
}
export function OPTIONS(req:NextRequest){
  return NATIVE_ORIGINS.has(req.headers.get('origin')||'')?
    new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});
}
async function owner(req:NextRequest):Promise<boolean>{
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||header.length>5500)return false;
  try{return isSuperadminUid((await adminAuth.verifyIdToken(header.slice(7),true)).uid);}catch{return false;}
}
function parseBody(value:unknown):{action:string;id:string;token?:string;supplyId?:string}|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(!['claim_delivery','complete_delivery','verify_purchase'].includes(String(v.action))||!canonicalRequestId(v.id))return null;
  if(v.action==='complete_delivery'&&!(typeof v.token==='string'&&/^[0-9a-f-]{36}$/.test(v.token)))return null;
  if(v.action==='verify_purchase'&&!canonicalSourceId(v.supplyId))return null;
  return {action:String(v.action),id:v.id,token:typeof v.token==='string'?v.token:undefined,supplyId:typeof v.supplyId==='string'?v.supplyId:undefined};
}
export async function POST(req:NextRequest){
  if(!(await owner(req)))return json(req,{ok:false,error:'Somente o administrador pode reconciliar operações.'},403);
  if(process.env.DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true')return json(req,{ok:false,error:'Execução canônica da equipe ainda não homologada.'},403);
  const raw=await req.text().catch(()=> '');
  if(!raw||raw.length>1024)return json(req,{ok:false,error:'Corpo inválido.'},400);
  let body:ReturnType<typeof parseBody>;
  try{body=parseBody(JSON.parse(raw));}catch{return json(req,{ok:false,error:'JSON inválido.'},400);}
  if(!body)return json(req,{ok:false,error:'Solicitação ou operação inválida.'},400);
  const id=body.id;
  const ref=adminDb.collection('staff_operation_requests').doc(id);
  try{
    if(body.action==='claim_delivery'){
      const token=randomUUID();
      const outcome=await adminDb.runTransaction(async tx=>{
        const reqSnap=await tx.get(ref);
        if(!reqSnap.exists)return null;
        const request=reqSnap.data()||{};
        if(request.kind!=='delivery_confirmation'||!canonicalSourceId(request.targetId)||!canonicalSourceId(request.routeId)||
          !canonicalRequestId(request.actorUid))return null;
        const accRef=adminDb.collection('staff_accounts').doc(request.actorUid as string);
        const deliveryRef=adminDb.collection('deliveries').doc(request.targetId as string);
        const routeRef=adminDb.collection('routes').doc(request.routeId as string);
        const [accSnap,deliverySnap,routeSnap]=await Promise.all([tx.get(accRef),tx.get(deliveryRef),tx.get(routeRef)]);
        if(!accSnap.exists||!deliverySnap.exists||!routeSnap.exists)return null;
        const now=Date.now();
        if(!eligibleDeliveryClaim(request,accSnap.data()||{},deliverySnap.data()||{},routeSnap.data()||{},now))return null;
        const issuedAt=new Date(now).toISOString();
        tx.update(ref,{execution:{token,issuedAt,expiresAt:new Date(now+SECONDS*1000).toISOString(),issuedByUid:DFL_SUPERADMIN_UID}});
        return {token,routeId:request.routeId,targetId:request.targetId,expiresAt:new Date(now+SECONDS*1000).toISOString()};
      });
      if(!outcome)return json(req,{ok:false,error:'Entrega, vínculo ou estado mudou; atualize e confira manualmente.'},409);
      return json(req,{ok:true,...outcome});
    }
    if(body.action==='complete_delivery'){
      const token=body.token!;
      const outcome=await adminDb.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)return 'missing' as const;
        const request=snap.data()||{};
        if(existingOutcome(request,'delivery',String(request.targetId||'')))return 'already' as const;
        if(request.kind!=='delivery_confirmation'||!canonicalSourceId(request.targetId))return 'invalid' as const;
        const deliverySnap=await tx.get(adminDb.collection('deliveries').doc(request.targetId as string));
        if(!deliverySnap.exists||!verifiedCanonicalDelivery(request,deliverySnap.data()||{},token,Date.now()))return 'invalid' as const;
        const now=new Date().toISOString();
        tx.update(ref,{status:'applied',effect:'owner_canonical_delivery',appliedAt:now,appliedByUid:DFL_SUPERADMIN_UID,execution:null});
        tx.set(adminDb.collection('staff_access_audit').doc(),{
          action:'staff_delivery_applied_canonical',requestId:id,deliveryId:request.targetId,
          actorUid:DFL_SUPERADMIN_UID,occurredAt:now,
        });
        return 'applied' as const;
      });
      return outcome==='applied'||outcome==='already'?json(req,{ok:true,applied:true,duplicate:outcome==='already'}):
        json(req,{ok:false,error:'A baixa canônica ainda não foi comprovada. Confira a entrega antes de tentar novamente.'},409);
    }
    const supplyId=body.supplyId!;
    const outcome=await adminDb.runTransaction(async tx=>{
      const reqSnap=await tx.get(ref);
      if(!reqSnap.exists)return 'missing' as const;
      const request=reqSnap.data()||{};
      if(existingOutcome(request,'purchase',supplyId))return 'already' as const;
      if(request.status!=='pending'||request.kind!=='purchase_intent'||!canonicalSourceId(request.targetId))return 'invalid' as const;
      const supplyRef=adminDb.collection('stock_supplies').doc(supplyId);
      const receiptRef=adminDb.collection('staff_canonical_receipts').doc(`${supplyId}__${request.targetId}`);
      const [supplySnap,receiptSnap]=await Promise.all([tx.get(supplyRef),tx.get(receiptRef)]);
      if(!supplySnap.exists||receiptSnap.exists)return 'invalid' as const;
      const checked=verifyIntegratedSupply(request,supplySnap.data()||{},Date.now());
      if(!checked)return 'invalid' as const;
      // Cada linha da compra precisa ter a entrada correspondente confirmada no ledger.
      const movementRefs=checked.itemIds.map(item=>adminDb.collection('stock_movements').doc(`supply-${supplyId}-${item}`));
      const movements=await Promise.all(movementRefs.map(m=>tx.get(m)));
      if(movements.some((m,i)=>!m.exists||m.data()?.supply_id!==supplyId||m.data()?.product_id!==request.targetId||m.data()?.type!=='entrada'||
          typeof m.data()?.quantity!=='number'||Math.abs(Number(m.data()?.quantity)-(supplySnap.data()?.items as Array<{id:string;quantity:number}>).find(x=>x.id===checked.itemIds[i])!.quantity)>0.0005))return 'invalid' as const;
      const now=new Date().toISOString();
      tx.create(receiptRef,{requestId:id,targetId:request.targetId,supplyId,recordedAt:now});
      tx.update(ref,{status:'linked',effect:'owner_integrated_supply_verified',linkedSupplyId:supplyId,linkedAt:now,linkedByUid:DFL_SUPERADMIN_UID,verifiedQuantity:checked.quantity});
      tx.set(adminDb.collection('staff_access_audit').doc(),{
        action:'staff_purchase_linked_canonical',requestId:id,supplyId,
        actorUid:DFL_SUPERADMIN_UID,occurredAt:now,
      });
      return 'linked' as const;
    });
    return outcome==='linked'||outcome==='already'?json(req,{ok:true,linked:true,duplicate:outcome==='already'}):
      json(req,{ok:false,error:'Compra não integrada, ledger divergente ou comprovante já vinculado. Revise no estoque.'},409);
  }catch(e){
    console.error('[R28] Reconciliacao canonica interrompida',e instanceof Error?e.name:'unknown');
    return json(req,{ok:false,error:'Não foi possível confirmar o registro no servidor. Verifique antes de repetir.'},500);
  }
}
