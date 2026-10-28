/** R127 E10: experimental transactional reader. NOT wired to R36/production. */
import type {Firestore, Transaction, QueryDocumentSnapshot} from 'firebase-admin/firestore';
export type ProjectedPageItem={id:string;value:Record<string,unknown>};
/** All queries occur inside the caller's transaction, and no writes happen here. */
export async function readProjectedAreaInTransaction(db:Firestore,tx:Transaction,uid:string,area:string,pageSize=10,maxRows=40):Promise<ProjectedPageItem[]> {
 if(!/^[A-Za-z0-9_-]{8,120}$/.test(uid))throw new Error('R127_UID_INVALID');
 if(!['home','routes','deliveries','stock','purchases'].includes(area))throw new Error('R127_AREA_INVALID');
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>10||maxRows!==40)throw new Error('R127_LIMIT_INVALID');
 const ref=db.collection('staff_workspaces').doc(uid).collection(area);
 const items:ProjectedPageItem[]=[];
 let last:QueryDocumentSnapshot | undefined;
 const seen=new Set<string>();
 while(true){
  let q=ref.orderBy('__name__').limit(Math.min(pageSize,maxRows+1-items.length));
  if(last)q=q.startAfter(last);
  const snap=await tx.get(q);
  if(snap.empty)break;
  for(const d of snap.docs){
   if(seen.has(d.id))throw new Error('R127_DUPLICATE_PAGE');
   if(last&&d.id<=last.id)throw new Error('R127_OUT_OF_ORDER');
   seen.add(d.id);items.push({id:d.id,value:d.data() as Record<string,unknown>});
   if(items.length>maxRows)throw new Error('TOO_MANY_OLD_PROJECTIONS');
  }
  last=snap.docs[snap.docs.length-1];
  if(snap.size<Math.min(pageSize,maxRows+1-(items.length-snap.size)))break;
 }
 return items;
}
