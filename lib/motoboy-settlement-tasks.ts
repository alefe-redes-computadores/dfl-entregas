import type { Delivery, Motoboy, OperationalExpense, Route } from '@/types';
import {
  operationalDateKey,
  routeBelongsToMotoboy,
} from '@/lib/motoboy-analytics';
import { isInternalOperationalMotoboy } from '@/lib/operational-exclusions';
import { routeOperationalDateKey } from '@/lib/operational-time';

export function buildPendingMotoboySettlements(input:{
  motoboys:Motoboy[];
  routes:Route[];
  deliveries:Delivery[];
  expenses:OperationalExpense[];
  dateKey?:string;
}){
  const date=input.dateKey||operationalDateKey(new Date());

  return input.motoboys
    .filter((motoboy)=>motoboy.active && !isInternalOperationalMotoboy(motoboy))
    .flatMap((motoboy)=>{
      const dayRoutes=input.routes.filter((route)=>{
        if(!routeBelongsToMotoboy(route,motoboy))return false;
        return routeOperationalDateKey(route)===date;
      });

      if(!dayRoutes.length)return [];
      if(dayRoutes.some((route)=>route.status!=='fechada'))return [];

      const routeIds=new Set(dayRoutes.map((route)=>route.id));
      const dayDeliveries=input.deliveries.filter((delivery)=>routeIds.has(delivery.route_id));

      if(!dayDeliveries.length||dayDeliveries.some((delivery)=>!delivery.completed))return [];

      const sourceId=`motoboy:${motoboy.id}:${date}`;
      if(input.expenses.some((expense)=>expense.source_id===sourceId))return [];

      return [{
        motoboy,
        date,
        routes:dayRoutes.length,
        deliveries:dayDeliveries.length,
        sourceId,
      }];
    });
}
