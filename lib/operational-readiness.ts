import type { Customer, Delivery, Route } from '@/types';
import { deliveryPoint } from '@/lib/route-intelligence';

export type DeliveryLocationReadiness='located'|'address-only'|'missing-address';

export function deliveryLocationReadiness(delivery:Delivery,customer?:Customer):DeliveryLocationReadiness{
  if(deliveryPoint(delivery,customer))return'located';
  const address=delivery.address_string?.trim()||customer?.address?.trim();
  return address?'address-only':'missing-address';
}

export function buildOperationalReadiness(input:{deliveries:Delivery[];routes:Route[];customers:Customer[]}){
  const customerMap=new Map(input.customers.map(c=>[c.id,c]));
  const routeMap=new Map(input.routes.map(r=>[r.id,r]));
  const pending=input.deliveries.filter(d=>!d.completed);
  const missingAddress=pending.filter(d=>deliveryLocationReadiness(d,customerMap.get(d.customer_id))==='missing-address');
  const unconfirmedLocation=pending.filter(d=>{
    if(deliveryLocationReadiness(d,customerMap.get(d.customer_id))!=='address-only')return false;
    const route=d.route_id?routeMap.get(d.route_id):undefined;
    return Boolean(route&&route.status==='aberta'&&!route.started_at&&!route.departure_time);
  });
  const routesWithLocationReview=new Set(unconfirmedLocation.map(d=>d.route_id).filter((v):v is string=>Boolean(v)));
  return{missingAddress,unconfirmedLocation,routesWithLocationReview};
}
