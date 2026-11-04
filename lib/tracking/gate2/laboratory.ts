/** R251 Gate2 — synthetic, deterministic, no Firestore/network/PII. */
import { projectPublicTracking, validatePublicProjection, type Raw, type TrackingEvent, type PublicProjection, type TrackingKind } from '../gate1/core';

export type TrackingLabCase = {
  id: string; title: string; description: string; expected_status: string;
  expect_progress: boolean; expect_terminal: boolean; projection: PublicProjection;
};
const NOW = Date.parse('2026-11-04T18:00:00.000Z');
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();
const ev = (kind: TrackingKind, minutesAgo: number, n: number): TrackingEvent => ({
  id:`lab_evt_${n}`, event_id:`lab_evt_${n}`, kind, at:at(minutesAgo),
  actor_uid:null,source:kind==='received'||kind==='preparing'||kind==='ready'||kind==='cancelled'?'dfl_site':'dfl_entregas',
  revision:n,causation_id:n>1?`lab_evt_${n-1}`:null,
});
const BASE: Raw = {id:'LABORDER001', external_order_id:'LAB0001', source_system:'dfl_site', origin:'loja',
  customer_name:'FICTICIO', phone:'00000000000', address_string:'ENDERECO-FICTICIO',
  value:125, payment_method:'pix', created_at:at(8), route_id:'', completed:false, fulfillment_mode:'delivery'};
const ROUTE:Raw = {id:'LABROUTE001',status:'aberta',started_at:at(4),updated_at:at(4),motoboy_name:'Entregador Exemplo'};
const other=(id:string,index:number,location:string,complete=false):Raw=>({id,route_id:'LABROUTE001', order_index:index,address_string:location,completed:complete,fulfillment_mode:'delivery'});
const withRoute=(d:Raw,index=2):Raw=>({...d,route_id:'LABROUTE001',order_index:index,address_string:'LOCAL-FICTICIO-CLIENTE'});
function make(id:string,title:string,description:string,delivery:Raw,route:Raw|null,events:TrackingEvent[],extra?:{now?:number;confirmedAt?:string;routeDeliveries?:Raw[];reconciling?:boolean;showPosition?:boolean}):TrackingLabCase {
  const projection = projectPublicTracking({delivery,route,routeDeliveries:extra?.routeDeliveries||[],ledgerEvents:events,
    now:extra?.now??NOW,confirmedAt:extra?.confirmedAt||at(3),reconciling:extra?.reconciling,showPosition:extra?.showPosition??true,showCourier:true});
  if(!validatePublicProjection(projection))throw new Error(`R251 fixture inválida: ${id}`);
  return {id,title,description,expected_status:projection.status,expect_progress:projection.progress!==null,
    expect_terminal:projection.terminal,projection};
}
const routeDeliveries=(target:Raw)=>[other('LABOTHER01',1,'LOCAL-FICTICIO-TERCEIRO',true),target,other('LABOTHER02',3,'LOCAL-FICTICIO-OUTRO')];
export const TRACKING_LAB_CASES: readonly TrackingLabCase[] = [
  make('received','Pedido recebido','O Site recebeu o pedido. Não há aceite comercial nem despacho.',{...BASE,site_order_status:'Pendente'},null,[ev('received',8,1)]),
  make('scheduled','Agendamento','Pedido agendado não equivale a aceite.',{...BASE,site_order_status:'Agendado',scheduled_for:at(-60)},null,[ev('received',8,1),ev('scheduled',6,2)]),
  make('preparing','Em preparo','Transição comercial confirmada pelo Site, sem rota.',{...BASE,site_order_status:'Em Produção'},null,[ev('received',8,1),ev('preparing',5,2)]),
  make('ready','Pronto','Produto pronto não significa que saiu para entrega.',{...BASE,site_order_status:'Pronto'},null,[ev('received',8,1),ev('ready',3,2)]),
  make('assigned','Alocado, não despachado','A entrega pertence a uma rota, mas a rota ainda não saiu.',withRoute(BASE),{...ROUTE,started_at:undefined,updated_at:at(5)},[ev('received',8,1),ev('assigned',5,2)],{routeDeliveries:routeDeliveries(withRoute(BASE))}),
  make('departed','Saiu para entrega','Despacho confirmado, mas a posição física atual não foi comprovada.',withRoute(BASE),ROUTE,[ev('received',8,1),ev('out_for_delivery',4,2)],{routeDeliveries:routeDeliveries(withRoute(BASE))}),
  make('grouped','Pedidos no mesmo endereço','Pedidos agrupados contam uma parada física, sem expor terceiros.',withRoute(BASE),ROUTE,[ev('received',8,1),ev('out_for_delivery',4,2)],{routeDeliveries:[other('LABOTHER01',1,'LOCAL-FICTICIO-TERCEIRO',true),withRoute(BASE),other('LABOTHER03',2,'LOCAL-FICTICIO-CLIENTE'),other('LABOTHER02',4,'LOCAL-FICTICIO-OUTRO')]}),
  make('reordered','Rota reorganizada','Ao reordenar, números incertos desaparecem até reconciliação.',withRoute(BASE),{...ROUTE,updated_at:at(0)},[ev('received',8,1),ev('out_for_delivery',4,2),ev('reorganized',0,3)],{routeDeliveries:routeDeliveries(withRoute(BASE))}),
  make('reconciling','Sincronização pendente','Uma reconciliação ainda em curso remove o progresso e marca freshness.',withRoute(BASE),ROUTE,[ev('received',8,1),ev('out_for_delivery',4,2)],{routeDeliveries:routeDeliveries(withRoute(BASE)),reconciling:true}),
  make('delivered','Entrega concluída','Conclusão individual confirmada é terminal e não exibe rota ativa.',{...withRoute(BASE),completed:true,completed_at:at(1)},ROUTE,[ev('received',8,1),ev('out_for_delivery',4,2),ev('delivered',1,3)],{routeDeliveries:routeDeliveries(withRoute(BASE))}),
  make('cancelled','Pedido cancelado','Cancelamento é terminal. Sem posição ou mensagens.',{...BASE,site_order_status:'Cancelado'},null,[ev('received',8,1),ev('cancelled',1,2)]),
  make('pickup','Retirada pronta','Retirada não possui rota nem motoboy no acompanhamento.',{...BASE,fulfillment_mode:'pickup',site_order_status:'Pronto'},null,[ev('received',8,1),ev('ready',1,2)]),
  make('stale','Atualização antiga','Sem evidência atual, freshness fica stale e não mostra progresso.',{...BASE,created_at:at(100),site_order_status:'Pendente'},null,[ev('received',100,1)],{confirmedAt:at(100)}),
  make('incident','Intercorrência','Tentativa sem conclusão não é pedido entregue.',{...BASE,delivery_attempts:[{id:'LAB_ATTEMPT'}]},null,[ev('received',8,1)]),
];
export const TRACKING_LAB_CONTRACT='dfl.tracking.gate2.lab' as const;
export function laboratoryReport(){return {contract:TRACKING_LAB_CONTRACT,version:1,simulated:true,
  scenario_count:TRACKING_LAB_CASES.length,all_valid:TRACKING_LAB_CASES.every(c=>validatePublicProjection(c.projection)),
  real_messaging:false,public_access_enabled:false,generated_from:'synthetic_fixtures_only'} as const;}
