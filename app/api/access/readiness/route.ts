/** R29 - preflight OWNER somente leitura. Não atualiza projeções nem concede login. */
import {NextRequest,NextResponse} from 'next/server';
import type {QueryDocumentSnapshot,DocumentData} from 'firebase-admin/firestore';
import {adminDb,adminAuth} from '@/lib/integration/server/admin';
import {isSuperadminUid} from '@/lib/access/roles';
import {auditStaffAccount,blankSamples,READINESS_SECTIONS,type ReadinessAccount,type ReadinessSummary} from '@/lib/access/staffReadinessPolicy';
import {isIsolatedStaffOrigin} from '@/lib/access/staffOrigin';
import {inspectStaffProjection} from '@/lib/access/staffProjectionGuard';
import {mapBounded,STAFF_PROBE_CONCURRENCY,summarizeStaffReadBudget,acquireStaffAuditPermit,STAFF_AUDIT_MIN_GAP_MS} from '@/lib/access/staffReadBudget';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const ACCOUNT_LIMIT=30,REQUEST_LIMIT=100;
function cors(req:NextRequest):Record<string,string>{
  const origin=req.headers.get('origin')||'';
  return ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization','vary':'Origin'}:{};
}
function reply(req:NextRequest,data:unknown,status=200){
  return NextResponse.json(data,{status,headers:{...cors(req),'cache-control':'private, no-store, max-age=0'}});
}
export function OPTIONS(req:NextRequest){return ORIGINS.has(req.headers.get('origin')||'')?
  new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});}
async function authorized(req:NextRequest){
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||header.length>5500)return false;
  try{return isSuperadminUid((await adminAuth.verifyIdToken(header.slice(7),true)).uid);}catch{return false;}
}
export async function GET(req:NextRequest){
  if(!(await authorized(req)))return reply(req,{ok:false,error:'Somente o administrador pode auditar acessos.'},403);
  const admission=acquireStaffAuditPermit('readiness');
  if(!admission.allowed)return NextResponse.json({ok:false,error:'Auditoria em andamento ou solicitada há poucos segundos. Tente novamente em instantes.'},{status:429,headers:{...cors(req),'cache-control':'private, no-store, max-age=0','retry-after':String(admission.retryAfterSeconds)}});
  try{
    // Leitura limitada e sob demanda. Sem onSnapshot, timer ou query global do cliente.
    const [accountsSnap,requestsSnap]=await Promise.all([
      adminDb.collection('staff_accounts').limit(ACCOUNT_LIMIT+1).get(),
      adminDb.collection('staff_operation_requests').limit(REQUEST_LIMIT+1).get(),
    ]);
    const now=Date.now();
    // Antes: Promise.all criava ate 150 consultas Firestore simultaneas.
    // R38: prepara apenas pares autorizados e executa no maximo quatro consultas em paralelo.
    const profiles=accountsSnap.docs.slice(0,ACCOUNT_LIMIT).map((doc:QueryDocumentSnapshot<DocumentData>)=>({
      uid:doc.id,profile:auditStaffAccount(doc.id,doc.data(),now),
    }));
    const tasks=profiles.flatMap(({uid,profile},index)=>READINESS_SECTIONS.map(area=>({uid,index,area}))
      .filter(({area})=>profile.sections.includes(area)));
    const snapshots=await mapBounded(tasks,STAFF_PROBE_CONCURRENCY,({uid,area})=>
      adminDb.collection('staff_workspaces').doc(uid).collection(area).limit(1).get());
    const accounts:ReadinessAccount[]=profiles.map(({profile})=>({
      ...profile,samples:blankSamples(),projectionRisks:{},projectionsChecked:0,
    }));
    let projectedDocs=0;
    tasks.forEach((task,i)=>{
      const first=snapshots[i].docs[0];
      accounts[task.index].samples[task.area]=Boolean(first);
      if(!first)return;
      projectedDocs++;
      accounts[task.index].projectionsChecked++;
      const findings=inspectStaffProjection(first.data());
      if(!findings.clean)accounts[task.index].projectionRisks[task.area]=findings.risks;
    });
    const rows:DocumentData[]=requestsSnap.docs.slice(0,REQUEST_LIMIT).map((doc:QueryDocumentSnapshot<DocumentData>)=>doc.data());
    const pending=rows.filter(x=>x.status==='pending');
    const hasLease=(x:Record<string,unknown>)=>{
      const e=x.execution as Record<string,unknown>|undefined;
      return e&&typeof e.expiresAt==='string'&&Number.isFinite(Date.parse(e.expiresAt))&&Date.parse(e.expiresAt)>now;
    };
    const staffOrigin=process.env.NEXT_PUBLIC_DFL_STAFF_ORIGIN;
    const projectionHealth={
      sampled:accounts.reduce((sum,a)=>sum+a.projectionsChecked,0),
      unsafe:accounts.reduce((sum,a)=>sum+Object.keys(a.projectionRisks).length,0),
      unknown:accountsSnap.size>ACCOUNT_LIMIT?1:0,
    };
    const summary:ReadinessSummary={
      ok:true,checkedAt:new Date(now).toISOString(),
      accountSampleLimit:ACCOUNT_LIMIT,accountsTruncated:accountsSnap.size>ACCOUNT_LIMIT,requestsTruncated:requestsSnap.size>REQUEST_LIMIT,
      accounts,projectionHealth,readBudget:summarizeStaffReadBudget(accountsSnap.size,requestsSnap.size,tasks.length,projectedDocs),requests:{sampled:rows.length,pending:pending.length,inFlight:pending.filter(hasLease).length,closed:rows.length-pending.length},
      flags:{
        staffPortal:process.env.NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED==='true',
        staffRequests:process.env.DFL_STAFF_OPERATION_REQUESTS_ENABLED==='true',
        canonicalApply:process.env.DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED==='true',
        projectionRefresh:process.env.DFL_STAFF_PROJECTION_REFRESH_ENABLED==='true',
        originsSeparated:Boolean(staffOrigin && isIsolatedStaffOrigin(staffOrigin)),
      },
      auditGuard:{mode:'instance_only',minGapSeconds:STAFF_AUDIT_MIN_GAP_MS/1000,scopes:2},
      productionRules:'nao_verificadas_pela_api',emulatorRules:'execucao_manual',
    };
    return reply(req,summary);
  }catch(error){
    console.error('[R29] Preflight leitura nao concluida',error instanceof Error?error.name:'unknown');
    return reply(req,{ok:false,error:'Não foi possível consultar o diagnóstico no servidor. Nenhuma configuração foi alterada.'},503);
  }finally{admission.release();}
}
