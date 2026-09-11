// lib/motoboy-analytics.ts
import type { Delivery, Motoboy, MotoboyPaymentRule, Route } from '@/types';

export interface ValeInput { id: string; description: string; amount: number; }
export const normalizeName=(value?:string)=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
export const operationalDateKey=(value:Date|string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const routeOperationalDate=(route:Route)=>route.started_at||route.departure_time||route.created_at||route.updated_at;

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
  const orderValue=Number(delivery.value)||0;
  const tendered=Number(delivery.change_for)||0;
  return tendered>0?Math.max(orderValue,tendered):orderValue;
}

export function getMotoboyDayData(motoboy:Motoboy,date:string,routes:Route[],deliveries:Delivery[],vales:ValeInput[]=[],cashHandedOver=true){
  const dayRoutes=getMotoboyRoutes(motoboy,routes).filter(route=>{const value=routeOperationalDate(route);return value?operationalDateKey(value)===date:false;});
  const routeIds=new Set(dayRoutes.map(route=>route.id));
  const completedDeliveries=deliveries.filter(delivery=>routeIds.has(delivery.route_id)&&delivery.completed===true);
  const cashCollected=completedDeliveries.reduce((sum,delivery)=>sum+deliveryCashCollected(delivery),0);
  const fee=calculateMotoboyFee(motoboy.payment_rule,completedDeliveries.length);
  const totalVales=vales.reduce((sum,vale)=>sum+vale.amount,0);
  const liquidFee=Math.max(0,fee.amount-totalVales);
  const difference=cashCollected-liquidFee;
  return {routes:dayRoutes,completedRoutes:dayRoutes.filter(route=>route.status==='fechada').length,deliveries:completedDeliveries,cashCollected,fee,totalVales,liquidFee,mustReturn:!cashHandedOver&&difference>0,balance:cashHandedOver?liquidFee:Math.abs(difference)};
}
