/** R127 E5: guardas puros para projeções. Sem side effects nem Firestore. */
type Raw = Record<string, unknown>;
export type ProjectionOwner = {role?:unknown; linkedMotoboyId?:unknown};
const as = (x:unknown):Raw|null => x!==null && typeof x==='object' && !Array.isArray(x) ? x as Raw : null;
const id = (x:unknown): x is string => typeof x==='string' && x.length>0 && x.length<=120 && !x.includes('/');
export function mayProjectRouteToAccount(account:ProjectionOwner, route:unknown):boolean {
 const r=as(route); if(!r)return false;
 if(account.role==='operacao')return true;
 return (account.role==='motoboy'||account.role==='personalizado') && id(account.linkedMotoboyId) &&
   id(r.motoboy_id) && r.motoboy_id===account.linkedMotoboyId;
}
export function mayProjectDeliveryToRoute(delivery:unknown,routeId:string):boolean {
 const d=as(delivery);
 return !!d && id(routeId) && d.route_id===routeId;
}
