/** R35: gera SOMENTE campos permitidos; não expõe documentos originais ao funcionário. */
import type {Firestore,Query,QuerySnapshot} from 'firebase-admin/firestore';
import {projectRoute,projectDelivery,projectProduct,projectPurchase,projectHome} from './staffProjection';
import {mayProjectRouteToAccount,mayProjectDeliveryToRoute} from './staffProjectionOwnership';
import {inspectStaffProjection} from './staffProjectionGuard';
import {allowedRefreshSections,emptyRefreshSnapshot,type RefreshAccount,type RefreshItem,type RefreshSnapshot,type RefreshSection} from './staffRefreshPolicy';
const LIMIT={routes:30,deliveries:40,stock:30,purchases:30,home:1} as const;
// R127 E6: nao reconciliar com fontes potencialmente truncadas.
const R127_E6_INCOMPLETE_SOURCE = 'R127_E6_INCOMPLETE_SOURCE';
function requireCompleteSource(size:number,cap:number,section:string){
 if(size>=cap)throw new Error(`${R127_E6_INCOMPLETE_SOURCE}:${section}`);
}
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
   ? db.collection('routes').limit(31)
   : db.collection('routes').where('motoboy_id','==',linked).limit(31);
  const routeSnap=await read(routes);
  requireCompleteSource(routeSnap.size,30,'routes');
  for(const doc of routeSnap.docs){
   const data=doc.data();
   if(!mayProjectRouteToAccount(account,data))continue;
   ids.push(doc.id);
   if(allowed.has('routes'))out.routes.push({id:doc.id,value:projectRoute(data,doc.id)});
  }
 }
 if(allowed.has('deliveries')&&ids.length){
  if(ids.length>4)throw new Error(`${R127_E6_INCOMPLETE_SOURCE}:delivery_route_window`);
  const emittedDeliveryIds=new Set<string>();
  for(const routeId of ids.slice(0,4)){
   const deliveries=db.collection('deliveries').where('route_id','==',routeId).limit(11);
   const deliverySnap=await read(deliveries);
   requireCompleteSource(deliverySnap.size,10,'deliveries');
   for(const doc of deliverySnap.docs){
    const data=doc.data();
    if(!mayProjectDeliveryToRoute(data,routeId))continue;
    if(emittedDeliveryIds.has(doc.id))continue;
    emittedDeliveryIds.add(doc.id);
    out.deliveries.push({id:doc.id,value:projectDelivery(data,doc.id)});
   }
  }
 }
 if(allowed.has('stock')&&account.role!=='motoboy'){
  const rows=db.collection('stock_products').limit(31);
  const stockSnap=await read(rows);
  requireCompleteSource(stockSnap.size,30,'stock');
  out.stock=stockSnap.docs.map(doc=>({id:doc.id,value:projectProduct(doc.data(),doc.id)}));
 }
 if(allowed.has('purchases')&&account.role!=='motoboy'){
  const rows=db.collection('stock_supplies').limit(31);
  const purchasesSnap=await read(rows);
  requireCompleteSource(purchasesSnap.size,30,'purchases');
  out.purchases=purchasesSnap.docs.map(doc=>({id:doc.id,value:projectPurchase(doc.data(),doc.id)}));
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
