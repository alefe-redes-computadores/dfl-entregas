/** R35: gera SOMENTE campos permitidos; não expõe documentos originais ao funcionário. */
import type {Firestore,Query,QuerySnapshot} from 'firebase-admin/firestore';
import {projectRoute,projectDelivery,projectProduct,projectPurchase,projectHome} from './staffProjection';
import {inspectStaffProjection} from './staffProjectionGuard';
import {allowedRefreshSections,emptyRefreshSnapshot,type RefreshAccount,type RefreshItem,type RefreshSnapshot,type RefreshSection} from './staffRefreshPolicy';
const LIMIT={routes:30,deliveries:40,stock:30,purchases:30,home:1} as const;
function assertItems(rows:RefreshItem[],area:RefreshSection){
 if(rows.length>LIMIT[area])throw new Error('SECTION_LIMIT');
 if(rows.some(r=>!r.id||r.id.includes('/')||!inspectStaffProjection(r.value).clean))throw new Error('UNSAFE_PROJECTION');
}
type SafeQueryReader=(query:Query)=>Promise<QuerySnapshot>;
const standardRead:SafeQueryReader=(query)=>query.get();
export async function buildFreshStaffSnapshot(db:Firestore,account:RefreshAccount,read:SafeQueryReader=standardRead):Promise<RefreshSnapshot>{
 const out=emptyRefreshSnapshot();
 const allowed=new Set(allowedRefreshSections(account));
 const linked=typeof account.linkedMotoboyId==='string'?account.linkedMotoboyId:'';
 const ids:string[]=[];
 if((linked||account.role==='operacao')&&(allowed.has('routes')||allowed.has('deliveries'))){
  // Operacao tem visao logistica global limitada; motoboy e personalizado ficam restritos ao vinculo.
  const routes=account.role==='operacao'
   ? db.collection('routes').limit(30)
   : db.collection('routes').where('motoboy_id','==',linked).limit(30);
  for(const doc of (await read(routes)).docs){ids.push(doc.id);if(allowed.has('routes'))out.routes.push({id:doc.id,value:projectRoute(doc.data(),doc.id)});}
 }
 if(allowed.has('deliveries')&&ids.length){
  for(const routeId of ids.slice(0,4)){
   const deliveries=db.collection('deliveries').where('route_id','==',routeId).limit(10);
   for(const doc of (await read(deliveries)).docs)out.deliveries.push({id:doc.id,value:projectDelivery(doc.data(),doc.id)});
  }
 }
 if(allowed.has('stock')&&account.role!=='motoboy'){
  const rows=db.collection('stock_products').limit(30);
  out.stock=(await read(rows)).docs.map(doc=>({id:doc.id,value:projectProduct(doc.data(),doc.id)}));
 }
 if(allowed.has('purchases')&&account.role!=='motoboy'){
  const rows=db.collection('stock_supplies').limit(30);
  out.purchases=(await read(rows)).docs.map(doc=>({id:doc.id,value:projectPurchase(doc.data(),doc.id)}));
 }
 if(allowed.has('home'))out.home=[{id:'overview',value:projectHome({routes:out.routes.length,deliveries:out.deliveries.length,stock:out.stock.length,purchases:out.purchases.length})}];
 for(const area of Object.keys(out) as RefreshSection[]){
  if(!allowed.has(area)&&out[area].length)throw new Error('CROSS_PERMISSION');
  assertItems(out[area],area);
 }
 return out;
}
export async function readCurrentStaffSnapshot(db:Firestore,uid:string,read:SafeQueryReader=standardRead):Promise<RefreshSnapshot>{
 const out=emptyRefreshSnapshot();
 for(const area of Object.keys(out) as RefreshSection[]){
  const snap=db.collection('staff_workspaces').doc(uid).collection(area).limit(41);
  const snapshot=await read(snap);
  if(snapshot.size>40)throw new Error('TOO_MANY_OLD_PROJECTIONS');
  out[area]=snapshot.docs.map(doc=>({id:doc.id,value:doc.data() as RefreshItem['value']}));
 }
 return out;
}
