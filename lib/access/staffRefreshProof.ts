/** R36: hash estável de TODO o estado observado, sem enviar dados à interface. */
import {createHash} from 'node:crypto';
import {REFRESH_SECTIONS,type RefreshSnapshot,type RefreshAccount} from './staffRefreshPolicy';
function stable(value:unknown):unknown {
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
 return value;
}
function orderedRows(snapshot:RefreshSnapshot){
 return REFRESH_SECTIONS.map(area=>[area,snapshot[area].map(row=>({id:row.id,value:stable(row.value)})).sort((a,b)=>a.id.localeCompare(b.id))]);
}
export function staffRefreshProof(uid:string,version:unknown,before:RefreshSnapshot,next:RefreshSnapshot){
 return createHash('sha256').update(JSON.stringify({v:36,uid,version,before:orderedRows(before),next:orderedRows(next)})).digest('hex');
}
/** Contrato sem efeitos, compartilhado entre prévia e commit transacional. */
export function staffDraftFingerprint(draft:Record<string,unknown>){
 return JSON.stringify(stable({activation:draft.activation,status:draft.status,role:draft.role,email:draft.email,
  permissions:draft.permissions,linkedMotoboyId:draft.linkedMotoboyId}));
}

export function staffAccountFingerprint(account:RefreshAccount){
 return JSON.stringify(stable({uid:account.uid,status:account.status,role:account.role,permissions:account.permissions,
  linkedMotoboyId:account.linkedMotoboyId,draftId:account.draftId,updatedAt:account.updatedAt}));
}
