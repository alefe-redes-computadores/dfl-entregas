/** R84: sequência de confirmação iFood POR ROTA, após sucesso HUMANO no portal.
 * Não lê iframe, não presume sucesso externo nem altera confirmação financeira.
 */
export type IfoodRouteCandidate={
 id:string;route_id?:string;origin?:string;ifood_id?:string;confirmation_code?:string;
 completed?:boolean;order_index?:number;operational_dismissed_at?:string;
 site_order_status?:string;fulfillment_mode?:string;
};
const digits=(v:unknown)=>typeof v==='string'?v.replace(/\D/g,''):'';
export function nextIfoodRouteConfirmation(
 deliveries:readonly IfoodRouteCandidate[],currentId:string,
):IfoodRouteCandidate|null{
 const current=deliveries.find(d=>d.id===currentId);
 if(!current||current.origin!=='ifood'||!current.route_id)return null;
 const queue=deliveries.filter(d=>
   d.id!==currentId && d.route_id===current.route_id && d.origin==='ifood' &&
   d.completed!==true && !d.operational_dismissed_at &&
   !/cancel|finaliz/i.test(d.site_order_status||'') &&
   digits(d.ifood_id).length===8 && digits(d.confirmation_code).length===4
 );
 const rank=(d:IfoodRouteCandidate)=>typeof d.order_index==='number'&&Number.isFinite(d.order_index)?d.order_index:Number.MAX_SAFE_INTEGER;
 return [...queue].sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id))[0]||null;
}
