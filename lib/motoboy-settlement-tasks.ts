import type { Delivery, Motoboy, OperationalExpense, Route } from '@/types';
import {
  operationalDateKey,
  routeBelongsToMotoboy,
} from '@/lib/motoboy-analytics';
import { isInternalOperationalMotoboy } from '@/lib/operational-exclusions';
import { routeOperationalDateKey } from '@/lib/operational-time';
import { activeRouteDeliveries } from '@/lib/route-closure-eligibility';

export function buildPendingMotoboySettlements(input:{
  motoboys:Motoboy[];
  routes:Route[];
  deliveries:Delivery[];
  expenses:OperationalExpense[];
  dateKey?:string;
}){
  const date=input.dateKey||operationalDateKey(new Date());
  // O fechamento operacional e o acerto devem usar a mesma autoridade:
  // cancelamento comercial fica no histórico, mas não vira pendência nem diária.
  const dayRoutes=input.routes.filter((route)=>routeOperationalDateKey(route)===date);
  const activeByRoute=new Map<string,Delivery[]>();
  for(const delivery of activeRouteDeliveries(input.deliveries)){
    if(!activeByRoute.has(delivery.route_id))activeByRoute.set(delivery.route_id,[]);
    activeByRoute.get(delivery.route_id)!.push(delivery);
  }
  const settledSources=new Set(input.expenses.map((expense)=>expense.source_id).filter(Boolean));
  return input.motoboys
    .filter((motoboy)=>motoboy.active && !isInternalOperationalMotoboy(motoboy))
    .flatMap((motoboy)=>{
      const linkedRoutes=dayRoutes.filter((route)=>routeBelongsToMotoboy(route,motoboy));
      if(!linkedRoutes.length||linkedRoutes.some((route)=>route.status!=='fechada'))return [];
      const dayDeliveries=linkedRoutes.flatMap((route)=>activeByRoute.get(route.id)||[]);
      // Apenas cancelamentos não geram acerto automático. É necessária
      // pelo menos uma entrega real, e todas devem estar concluídas.
      if(!dayDeliveries.length||dayDeliveries.some((delivery)=>!delivery.completed))return [];
      const sourceId=`motoboy:${motoboy.id}:${date}`;
      if(settledSources.has(sourceId))return [];
      return [{motoboy,date,routes:linkedRoutes.length,deliveries:dayDeliveries.length,sourceId}];
    });
}
