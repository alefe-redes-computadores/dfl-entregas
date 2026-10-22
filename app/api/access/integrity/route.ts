/** R33: tomografia por UID, estritamente read-only e owner-only. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth,adminDb} from '@/lib/integration/server/admin';
import {isSuperadminUid} from '@/lib/access/roles';
import {safeUid} from '@/lib/access/staffReadinessPolicy';
import {acquireStaffAuditPermit} from '@/lib/access/staffReadBudget';
import {
  assessProjection,tallyFindings,INTEGRITY_AREAS,INTEGRITY_SAMPLE_LIMIT,INTEGRITY_SOURCE_READ_BUDGET,
  type IntegrityArea,type IntegrityAreaStats,type IntegrityFinding,type IntegritySummary,type AccountView,
} from '@/lib/access/staffIntegrityPolicy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const SOURCE_COLLECTION:Partial<Record<IntegrityArea,string>>={routes:'routes',deliveries:'deliveries',stock:'stock_products',purchases:'stock_supplies'};
function cors(req:NextRequest):Record<string,string>{
  const origin=req.headers.get('origin')||'';
  return ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization','vary':'Origin'}:{};
}
function reply(req:NextRequest,body:unknown,status=200){return NextResponse.json(body,{status,headers:{...cors(req),'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'}});}
export function OPTIONS(req:NextRequest){return ORIGINS.has(req.headers.get('origin')||'')?new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});}
async function owner(req:NextRequest):Promise<boolean>{
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||header.length>5500)return false;
  try{return isSuperadminUid((await adminAuth.verifyIdToken(header.slice(7),true)).uid);}catch{return false;}
}
export async function GET(req:NextRequest){
  if(!(await owner(req)))return reply(req,{ok:false,error:'Acesso restrito ao administrador.'},403);
  const uid=new URL(req.url).searchParams.get('uid');
  if(!safeUid(uid)||isSuperadminUid(uid))return reply(req,{ok:false,error:'UID inválido para auditoria.'},400);
  const admission=acquireStaffAuditPermit('integrity');
  if(!admission.allowed)return NextResponse.json({ok:false,error:'Já existe uma conferência profunda em andamento ou muito recente. Tente novamente em instantes.'},{status:429,headers:{...cors(req),'cache-control':'private, no-store, max-age=0','retry-after':String(admission.retryAfterSeconds)}});
  try{
    const staffRef=adminDb.collection('staff_accounts').doc(uid);
    const snapshot=await staffRef.get();
    if(!snapshot.exists)return reply(req,{ok:false,error:'Cadastro ainda não preparado no servidor.'},404);
    const raw=snapshot.data()||{};
    const account:AccountView={uid,role:typeof raw.role==='string'?raw.role:'',status:typeof raw.status==='string'?raw.status:'',permissions:raw.permissions,linkedMotoboyId:raw.linkedMotoboyId};
    // Um documento de staff + 5 consultas de no maximo 13 itens e ate 75 leituras-fonte.
    // Cache de promessas impede repeticao da mesma rota quando ha varias entregas.
    let budget=INTEGRITY_SOURCE_READ_BUDGET;
    const memo=new Map<string,Promise<Record<string,unknown>|null>>();
    async function readSource(collection:string,id:string):Promise<Record<string,unknown>|null>{
      if(!id||id.includes('/')||id.length>180)return null;
      const key=collection+'/'+id;
      const previous=memo.get(key);if(previous)return previous;
      if(budget<=0)throw new Error('READ_BUDGET_EXCEEDED');
      budget--;
      const pending=adminDb.collection(collection).doc(id).get().then(s=>s.exists?(s.data()||{}):null);
      memo.set(key,pending);return pending;
    }
    const areas:IntegrityAreaStats[]=[];
    for(const area of INTEGRITY_AREAS){
      const snap=await adminDb.collection('staff_workspaces').doc(uid).collection(area).limit(INTEGRITY_SAMPLE_LIMIT+1).get();
      const items=snap.docs.slice(0,INTEGRITY_SAMPLE_LIMIT);
      const all:IntegrityFinding[]=[];
      for(const row of items){
        const data=row.data();
        const sourceCollection=SOURCE_COLLECTION[area];
        const original=sourceCollection?await readSource(sourceCollection,row.id):null;
        let route:Record<string,unknown>|null=null;
        if(area==='deliveries'&&account.role==='motoboy'&&original && typeof original.route_id==='string'){
          route=await readSource('routes',original.route_id);
        }
        all.push(...assessProjection(area,data,account,original,row.id,route));
      }
      areas.push({area,sampled:items.length,truncated:snap.size>INTEGRITY_SAMPLE_LIMIT,findings:tallyFindings(all)});
    }
    const now=new Date().toISOString();
    const name=typeof raw.displayName==='string'?raw.displayName.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,90):'Equipe';
    const result:IntegritySummary={
      ok:true,checkedAt:now,uid,displayName:name,role:account.role,status:account.status,
      staffLinked:typeof raw.linkedMotoboyId==='string'&&raw.linkedMotoboyId.trim().length>0,
      sampleLimit:INTEGRITY_SAMPLE_LIMIT,sourceReadBudget:INTEGRITY_SOURCE_READ_BUDGET,
      areas,totals:{scanned:areas.reduce((n,a)=>n+a.sampled,0),alerts:areas.reduce((n,a)=>n+Object.values(a.findings).reduce((x,y)=>x+(y||0),0),0),truncatedAreas:areas.filter(x=>x.truncated).length},
      verification:'sample_only',eligibleForActivation:false,rulesProduction:'not_checked',
    };
    return reply(req,result);
  }catch(error){
    console.error('[R33] Auditoria por UID não concluída',error instanceof Error?error.name:'unknown');
    return reply(req,{ok:false,error:'Não foi possível concluir a conferência. Nenhuma configuração foi alterada.'},503);
  }finally{admission.release();}
}
