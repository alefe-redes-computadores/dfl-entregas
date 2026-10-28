/** R127 E12: shadow transactional adapter. NOT connected to R36 or production. */
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {readProjectedAreaInTransaction} from './staffRefreshTransactionPagerExperimental';
import {REFRESH_SECTIONS,type RefreshSnapshot,type RefreshItem} from './staffRefreshPolicy';
export async function readShadowStaffSnapshotInTransaction(db:Firestore,tx:Transaction,uid:string):Promise<RefreshSnapshot>{
 const result={} as RefreshSnapshot;
 for(const area of REFRESH_SECTIONS){
  const projected=await readProjectedAreaInTransaction(db,tx,uid,area,10,40);
  result[area]=projected.map((row):RefreshItem=>{
   const value=row.value;
   const keys=Object.keys(value);
   if(keys.some(k=>!['title','subtitle','status'].includes(k))
       ||keys.length!==3
       ||typeof value.title!=='string'||typeof value.subtitle!=='string'||typeof value.status!=='string'
       ||value.title.length>120||value.subtitle.length>180||value.status.length>32)
    throw new Error('R127_SHADOW_PROJECTION_UNSAFE');
   return {id:row.id,value:{title:value.title,subtitle:value.subtitle,status:value.status}};
  });
 }
 return result;
}
