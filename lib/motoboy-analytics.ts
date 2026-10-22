// lib/motoboy-analytics.ts
import type { Delivery, Motoboy, MotoboyPaymentRule, MotoboySettlementAdjustment, Route } from '@/types';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { activeRouteDeliveries } from '@/lib/route-closure-eligibility';

export type ValeInput = MotoboySettlementAdjustment;
export const normalizeName=(value?:string)=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const operationalDateFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'});
export const operationalDateKey=(value:Date|string)=>operationalDateFormatter.format(new Date(value));
// A competência é fixada na criação da rota, nunca no horário de saída/conclusão.
// Os eventos preservam seus timestamps próprios para auditoria.
export const routeOperationalDate=(route:Route)=>route.operational_date
  ? `${route.operational_date}T12:00:00-03:00`
  : route.created_at||route.started_at||route.departure_time||route.updated_at;

export function routeBelongsToMotoboy(route:Route,motoboy:Motoboy):boolean {
  if(route.motoboy_id)return route.motoboy_id===motoboy.id;
  return normalizeName(route.motoboy_name)===normalizeName(motoboy.name);
}

export function getMotoboyRoutes(motoboy:Motoboy,routes:Route[]):Route[]{return routes.filter(route=>routeBelongsToMotoboy(route,motoboy));}

export function calculateMotoboyFee(rule:MotoboyPaymentRule|undefined,deliveryCount:number){
  if(!rule)return {amount:0,description:'Regra de pagamento não configurada'};
  if(rule.type==='fixed')return {amount:rule.fixed_amount||0,description:`Diária fixa: R$ ${(rule.fixed_amount||0).toFixed(2).replace('.',',')}`};
  if(rule.type==='per_delivery'){const rate=rule.delivery_fee||0;return {amount:deliveryCount*rate,description:`${deliveryCount} entregas × R$ ${rate.toFixed(2).replace('.',',')}`};}
  const fixed=rule.fixed_amount||0;const threshold=rule.threshold||0;const extraFee=rule.extra_fee||0;const extras=Math.max(0,deliveryCount-threshold);
  return {amount:fixed+(extras*extraFee),description:extras?`Base R$ ${fixed.toFixed(2).replace('.',',')} + ${extras} extras × R$ ${extraFee.toFixed(2).replace('.',',')}`:`Base até ${threshold} entregas: R$ ${fixed.toFixed(2).replace('.',',')}`};
}

export function deliveryCashCollected(delivery:Delivery){
  if(delivery.payment_method!=='dinheiro'||delivery.is_paid)return 0;
  // `change_for` é quanto o cliente entregou antes do troco, não quanto ficou
  // com o motoboy. O caixa retido corresponde ao valor do pedido.
  return Math.max(0,Number(delivery.value)||0);
}

export function getMotoboyDayData(
  motoboy:Motoboy,
  date:string,
  routes:Route[],
  deliveries:Delivery[],
  vales:ValeInput[]=[],
  cashHandedOver:boolean|number=true,
  carry:{storeCredit?:number;motoboyCredit?:number}={},
){
  const dayRoutes=getMotoboyRoutes(motoboy,routes).filter(route=>route.operational_date?route.operational_date===date:(routeOperationalDate(route)?operationalDateKey(routeOperationalDate(route)! as string)===date:false));
  const routeIds=new Set(dayRoutes.map(route=>route.id));
  const completedDeliveries=activeRouteDeliveries(deliveries).filter(delivery=>routeIds.has(delivery.route_id)&&delivery.completed===true);
  const completedByRoute=new Map<string,Delivery[]>();
  for(const delivery of completedDeliveries){
    const group=completedByRoute.get(delivery.route_id);
    if(group)group.push(delivery);else completedByRoute.set(delivery.route_id,[delivery]);
  }
  // Uma mesma morada em duas rotas são duas paradas físicas distintas.
  const completedStops=dayRoutes.flatMap(route=>
    groupDeliveriesByStop(completedByRoute.get(route.id)||[])
  );
  const physicalDeliveryCount=completedStops.length;
  const orderCount=completedDeliveries.length;
  const groupedOrderCount=Math.max(0,orderCount-physicalDeliveryCount);
  const routeBreakdown=dayRoutes.map((route,index)=>{
    const routeDeliveries=completedByRoute.get(route.id)||[];
    const routeStops=groupDeliveriesByStop(routeDeliveries);
    return {
      routeId:route.id,
      label:route.name?.trim()||`Rota ${index+1}`,
      orderCount:routeDeliveries.length,
      physicalDeliveryCount:routeStops.length,
      groupedOrderCount:Math.max(0,routeDeliveries.length-routeStops.length),
    };
  }).filter(item=>item.orderCount>0);
  const cashDeliveries=completedDeliveries.filter(delivery=>delivery.payment_method==='dinheiro'&&!delivery.is_paid);
  const cashCollected=cashDeliveries.reduce((sum,delivery)=>sum+deliveryCashCollected(delivery),0);
  const cashTendered=cashDeliveries.reduce((sum,delivery)=>{
    const charge=deliveryCashCollected(delivery);
    return sum+Math.max(charge,Number(delivery.change_for)||0);
  },0);
  const cashChange=Math.max(0,cashTendered-cashCollected);
  // Regra operacional da DFL: o troco é resolvido pela loja. No acerto, a
  // responsabilidade física do motoboy é tudo que ele recebeu dos clientes,
  // e não apenas o valor econômico dos pedidos.
  const cashInHand=cashTendered;
  const fee=calculateMotoboyFee(motoboy.payment_rule,physicalDeliveryCount);
  const deductions=vales.filter(item=>item.direction!=='addition').reduce((sum,item)=>sum+item.amount,0);
  const additions=vales.filter(item=>item.direction==='addition').reduce((sum,item)=>sum+item.amount,0);
  const totalVales=deductions;
  const totalAdditions=additions;
  const liquidFee=Math.max(0,fee.amount-deductions+additions);
  const cashHandedOverAmount=typeof cashHandedOver==='number'
    ? Math.min(cashInHand,Math.max(0,Number(cashHandedOver)||0))
    : cashHandedOver?cashInHand:0;
  const retainedCash=Math.max(0,cashInHand-cashHandedOverAmount);
  const priorStoreCredit=Math.max(0,Number(carry.storeCredit)||0);
  const priorMotoboyCredit=Math.max(0,Number(carry.motoboyCredit)||0);
  const difference=retainedCash+priorStoreCredit-liquidFee-priorMotoboyCredit;
  const storeCredit=Math.max(0,difference);
  const motoboyCredit=Math.max(0,-difference);
  const settlementDirection:'store_credit'|'motoboy_credit'|'settled'=storeCredit>0?'store_credit':motoboyCredit>0?'motoboy_credit':'settled';
  return {
    routes:dayRoutes,
    completedRoutes:dayRoutes.filter(route=>route.status==='fechada').length,
    deliveries:completedDeliveries,
    completedStops,
    physicalDeliveryCount,
    orderCount,
    groupedOrderCount,
    routeBreakdown,
    cashCollected,
    cashTendered,
    cashChange,
    cashInHand,
    cashHandedOverAmount,
    retainedCash,
    fee,
    totalVales,
    totalAdditions,
    liquidFee,
    priorStoreCredit,
    priorMotoboyCredit,
    storeCredit,
    motoboyCredit,
    settlementDirection,
    mustReturn:storeCredit>0,
    balance:storeCredit||motoboyCredit,
  };
}
