/** DFL R87: exceções de uma parada sem Firestore nem efeitos colaterais. */
export type OperationalCardIssue = {kind:'route'|'address'; deliveryId:string; label:string; detail:string};
export type OperationalCardCandidate = {id:string; route_id?:string|null; address_string?:string|null; customer_id?:string|null; fulfillment_mode?:string|null; completed?:boolean};
const VIRTUAL_ROUTES=new Set(['rota-aguardando-vinculo','rota-resgate-recuperada']);
export function firstActionableCardIssue(items:readonly OperationalCardCandidate[],routeId:string, customerAddress?: (id?:string)=>string|undefined):OperationalCardIssue|null {
  const pending=items.filter(d=>!d.completed&&(!d.fulfillment_mode||d.fulfillment_mode==='delivery'));
  const routeIssue=pending.find(d=>VIRTUAL_ROUTES.has(routeId)||!d.route_id);
  if(routeIssue)return {kind:'route',deliveryId:routeIssue.id,label:'Rota pendente',detail:'Vincule o pedido a uma rota real antes de concluir a entrega.'};
  const addressIssue=pending.find(d=>!(d.address_string?.trim()||customerAddress?.(d.customer_id||undefined)?.trim()));
  if(addressIssue)return {kind:'address',deliveryId:addressIssue.id,label:'Endereço pendente',detail:'Confira o destino deste pedido antes de iniciar ou concluir a parada.'};
  return null;
}
