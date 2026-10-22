/** V111 R35: prévia e sincronização transacional MANUAL de projeções, apenas do owner. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth,adminDb} from '@/lib/integration/server/admin';
import {isSuperadminUid} from '@/lib/access/roles';
import {stageReadPermissions} from '@/lib/access/staffProjection';
import {assessRefreshAccount,compareRefreshSnapshot,safeRefreshUid,type RefreshAccount} from '@/lib/access/staffRefreshPolicy';
import {buildFreshStaffSnapshot,readCurrentStaffSnapshot} from '@/lib/access/staffRefreshSnapshot';
import {staffRefreshProof,staffDraftFingerprint,staffAccountFingerprint} from '@/lib/access/staffRefreshProof';
import {commitSuspendedStaffRefresh} from '@/lib/access/staffRefreshCommit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ORIGINS=new Set(['https://localhost','http://localhost','capacitor://localhost']);
const CONFIRM='SINCRONIZAR SUSPENSO';
const enabled=()=>process.env.DFL_STAFF_PROJECTION_REFRESH_ENABLED==='true';
const cors=(req:NextRequest):Record<string,string>=>{
 const origin=req.headers.get('origin')||'';
 return ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','vary':'Origin'}:{};
};
const reply=(req:NextRequest,body:unknown,status=200)=>NextResponse.json(body,{status,headers:{...cors(req),'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'}});
export function OPTIONS(req:NextRequest){return ORIGINS.has(req.headers.get('origin')||'')?new NextResponse(null,{status:204,headers:cors(req)}):new NextResponse(null,{status:403});}
async function owner(req:NextRequest){const header=req.headers.get('authorization')||'';if(!header.startsWith('Bearer ')||header.length>5500)return false;try{return isSuperadminUid((await adminAuth.verifyIdToken(header.slice(7),true)).uid);}catch{return false;}}
async function verifiedAccount(uid:string){
 const ref=adminDb.collection('staff_accounts').doc(uid);
 const snap=await ref.get();if(!snap.exists)throw new Error('ACCOUNT_ABSENT');
 const account=snap.data() as RefreshAccount;
 if(assessRefreshAccount(uid,account).length)throw new Error('ACCOUNT_UNSAFE');
 const draftId=account.draftId as string;
 const [draftSnap,user]=await Promise.all([adminDb.collection('staff_access_drafts').doc(draftId).get(),adminAuth.getUser(uid)]);
 const draft=draftSnap.data();
 if(!draftSnap.exists||draft?.activation!=='not_enabled'||draft?.status!=='rascunho'||draft.role!==account.role||
    user.disabled||!user.emailVerified||!user.email||typeof draft.email!=='string'||user.email.trim().toLowerCase()!==draft.email.trim().toLowerCase()||
    JSON.stringify([...stageReadPermissions(draft.permissions)].sort())!==JSON.stringify([...(account.permissions as string[])].sort())||
    (account.role==='motoboy'&&draft.linkedMotoboyId!==account.linkedMotoboyId))throw new Error('DRAFT_MISMATCH');
 return {account,expectedDraftFingerprint:staffDraftFingerprint(draft),expectedAccountFingerprint:staffAccountFingerprint(account)};
}
type Body={operation?:unknown;targetUid?:unknown;expectedUpdatedAt?:unknown;expectedDigest?:unknown;confirmation?:unknown};
export async function POST(req:NextRequest){
 if(!(await owner(req)))return reply(req,{ok:false,error:'Acesso exclusivo do proprietário.'},403);
 let body:Body;try{body=await req.json();}catch{return reply(req,{ok:false,error:'Corpo inválido.'},400);}
 const uid=body.targetUid;
 if(!safeRefreshUid(uid)||isSuperadminUid(uid)||!['preview','refresh'].includes(String(body.operation))){return reply(req,{ok:false,error:'Operação ou UID inválido.'},400);}
 if(body.operation==='refresh'&&(!enabled()||body.confirmation!==CONFIRM||typeof body.expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedDigest)||typeof body.expectedUpdatedAt!=='string')){
  return reply(req,{ok:false,error:'Sincronização desabilitada ou confirmação ausente.'},403);
 }
 try{
  const {account,expectedDraftFingerprint,expectedAccountFingerprint}=await verifiedAccount(uid);
  if(body.operation==='preview'){
   const [before,next]=await Promise.all([readCurrentStaffSnapshot(adminDb,uid),buildFreshStaffSnapshot(adminDb,account)]);
   const plan=compareRefreshSnapshot(before,next);
   const proof=staffRefreshProof(uid,account.updatedAt,before,next);
   return reply(req,{ok:true,operation:'preview',targetUid:uid,accountUpdatedAt:account.updatedAt,
    digest:proof,refreshEnabled:enabled(),sampleOnly:true,projectionsRemainSuspended:true,...plan});
  }
  if(body.expectedUpdatedAt!==account.updatedAt)return reply(req,{ok:false,error:'A conta mudou. Refaça a prévia.'},409);
  const done=await commitSuspendedStaffRefresh(adminDb,{uid,expectedUpdatedAt:body.expectedUpdatedAt as string,
   expectedDigest:body.expectedDigest as string,expectedDraftFingerprint,expectedAccountFingerprint});
  return reply(req,{ok:true,operation:'refresh',targetUid:uid,suspended:true,syncedAt:done.syncedAt,
    applied:done.applied,summary:{totalNew:done.totalNew,totalChanges:done.totalChanges}});
 }catch(error){
  const name=error instanceof Error?error.message:'unknown';
  if(['ACCOUNT_ABSENT'].includes(name))return reply(req,{ok:false,error:'Conta não preparada.'},404);
  if(['ACCOUNT_UNSAFE','DRAFT_MISMATCH','R36_ACCOUNT_CHANGED','R36_DRAFT_CHANGED','R36_PREVIEW_STALE'].includes(name))return reply(req,{ok:false,error:'Conta, vínculo, origem ou projeções mudaram. Refaça a prévia e verifique a conta antes de sincronizar.'},409);
  if(name==='UNSAFE_PROJECTION')return reply(req,{ok:false,error:'A prévia contém campo suspeito. Nenhum documento foi alterado.'},409);
  if(name==='TOO_MANY_OLD_PROJECTIONS')return reply(req,{ok:false,error:'Há mais registros do que o limite de segurança para atualização. Revise manualmente.'},409);
  console.error('[R36] Sincronização de projeções interrompida',error instanceof Error?error.name:'unknown');
  return reply(req,{ok:false,error:'Não foi possível verificar a sincronização. Nenhum acesso foi autorizado.'},503);
 }
}
