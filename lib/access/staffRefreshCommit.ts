/** R36: commit único, relendo fonte, rascunho e projeções DENTRO da transação Firestore. */
import type {Firestore,Query,QuerySnapshot} from 'firebase-admin/firestore';
import {DFL_SUPERADMIN_UID} from './roles';
import {assessRefreshAccount,compareRefreshSnapshot,sameProjectedValue,REFRESH_SECTIONS,type RefreshAccount} from './staffRefreshPolicy';
import {buildFreshStaffSnapshot,readCurrentStaffSnapshot} from './staffRefreshSnapshot';
import {staffRefreshProof,staffDraftFingerprint,staffAccountFingerprint} from './staffRefreshProof';
export type RefreshCommitRequest={uid:string;expectedUpdatedAt:string;expectedDigest:string;expectedDraftFingerprint:string;expectedAccountFingerprint:string};
export type RefreshCommitResult={suspended:true;syncedAt:string;applied:boolean;totalNew:number;totalChanges:number};
export async function commitSuspendedStaffRefresh(db:Firestore,req:RefreshCommitRequest):Promise<RefreshCommitResult>{
 const accountRef=db.collection('staff_accounts').doc(req.uid);
 return db.runTransaction(async tx=>{
  const accountDoc=await tx.get(accountRef);
  const account=accountDoc.data() as RefreshAccount|undefined;
  if(!account||assessRefreshAccount(req.uid,account).length||account.updatedAt!==req.expectedUpdatedAt||staffAccountFingerprint(account)!==req.expectedAccountFingerprint)throw new Error('R36_ACCOUNT_CHANGED');
  const draftDoc=await tx.get(db.collection('staff_access_drafts').doc(account.draftId as string));
  const draft=draftDoc.data();
  if(!draftDoc.exists||!draft||draft.activation!=='not_enabled'||draft.status!=='rascunho'||draft.role!==account.role||
   (account.role==='motoboy'&&draft.linkedMotoboyId!==account.linkedMotoboyId)||
   staffDraftFingerprint(draft)!==req.expectedDraftFingerprint)throw new Error('R36_DRAFT_CHANGED');
  // Firestore: a leitura de cada query original participa da transação e é reavaliada no retry.
  const read=(q:Query):Promise<QuerySnapshot>=>tx.get(q);
  const next=await buildFreshStaffSnapshot(db,account,read);
  const before=await readCurrentStaffSnapshot(db,req.uid,read);
  if(staffRefreshProof(req.uid,account.updatedAt,before,next)!==req.expectedDigest)throw new Error('R36_PREVIEW_STALE');
  const plan=compareRefreshSnapshot(before,next);
  const now=new Date().toISOString();
  if(plan.totalChanges===0)return {suspended:true as const,syncedAt:now,applied:false,totalNew:plan.totalNew,totalChanges:0};
  // TODAS as leituras precedem a primeira escrita; atualiza apenas deltas.
  for(const area of REFRESH_SECTIONS){
   const collection=db.collection('staff_workspaces').doc(req.uid).collection(area);
   const previous=new Map(before[area].map(row=>[row.id,row.value]));
   const fresh=new Map(next[area].map(row=>[row.id,row.value]));
   for(const id of previous.keys())if(!fresh.has(id))tx.delete(collection.doc(id));
   for(const [id,value] of fresh)if(!previous.has(id)||!sameProjectedValue(previous.get(id),value))tx.set(collection.doc(id),value);
  }
  tx.update(accountRef,{status:'suspended',updatedAt:now,lastProjectionRefreshAt:now});
  tx.set(db.collection('staff_access_audit').doc(),{
   action:'projection_refresh_suspended',targetUid:req.uid,actorUid:DFL_SUPERADMIN_UID,
   occurredAt:now,counts:Object.fromEntries(REFRESH_SECTIONS.map(section=>[section,next[section].length])),
  });
  return {suspended:true as const,syncedAt:now,applied:true,totalNew:plan.totalNew,totalChanges:plan.totalChanges};
 });
}
