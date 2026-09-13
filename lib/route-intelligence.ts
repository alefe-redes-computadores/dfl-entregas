import type { Customer, Delivery } from '@/types';
import { distanceMeters, extractLatLngFromMapsUrl, type LatLngPoint } from '@/lib/maps';

export type RouteStop = { delivery: Delivery; customer?: Customer; point: LatLngPoint | null };

const createdTime = (delivery: Delivery) => {
  const time = new Date(delivery.created_at || delivery.createdAt || delivery.updated_at || 0).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

const normalizeKey = (value?: string) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const neighborhoodOf = (stop: RouteStop) => {
  if (stop.customer?.neighborhood?.trim()) return stop.customer.neighborhood.trim();
  const address = stop.delivery.address_string || stop.customer?.address || '';
  const parts = address.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
};
const groupKey = (stop: RouteStop) => normalizeKey(neighborhoodOf(stop)) || `__${stop.delivery.id}`;

export const deliveryPoint = (delivery: Delivery, customer?: Customer) =>
  extractLatLngFromMapsUrl(delivery.maps_link) || extractLatLngFromMapsUrl(customer?.maps_link);

const centroid = (items: RouteStop[]): LatLngPoint => {
  const points = items.map(item => item.point!).filter(Boolean);
  return { lat: points.reduce((sum,p)=>sum+p.lat,0)/points.length, lng: points.reduce((sum,p)=>sum+p.lng,0)/points.length };
};

function nearest(origin: LatLngPoint, stops: RouteStop[]) {
  const remaining=[...stops]; const result:RouteStop[]=[]; let cursor=origin;
  while(remaining.length){
    remaining.sort((a,b)=>distanceMeters(cursor,a.point!)-distanceMeters(cursor,b.point!) || createdTime(a.delivery)-createdTime(b.delivery) || a.delivery.id.localeCompare(b.delivery.id));
    const next=remaining.shift()!; result.push(next); cursor=next.point!;
  }
  return result;
}

/**
 * Organizador operacional V2.
 * Mesmo bairro forma um bloco contínuo; bairros são escolhidos pela proximidade
 * do centróide e, dentro do bloco, as casas seguem vizinho mais próximo.
 * Urgência vence a ordem normal; travas mantêm o slot; sem coordenadas preserva cadastro.
 * Distância aqui é geométrica, nunca quilometragem rodoviária.
 */
export function buildSmartRouteOrder(origin: LatLngPoint, stops: RouteStop[]) {
  const urgent=stops.filter(i=>i.delivery.is_urgent).sort((a,b)=>createdTime(a.delivery)-createdTime(b.delivery));
  const normal=stops.filter(i=>!i.delivery.is_urgent);
  const movable=normal.filter(i=>!i.delivery.order_locked);
  const precise=movable.filter(i=>i.point);
  const approximate=movable.filter(i=>!i.point).sort((a,b)=>createdTime(a.delivery)-createdTime(b.delivery));
  const map=new Map<string,RouteStop[]>();
  precise.forEach(stop=>{const key=groupKey(stop); map.set(key,[...(map.get(key)||[]),stop]);});
  const groups=[...map.entries()].map(([key,items])=>({key,items,center:centroid(items)}));
  const optimized:RouteStop[]=[]; let cursor=origin;
  while(groups.length){
    groups.sort((a,b)=>distanceMeters(cursor,a.center)-distanceMeters(cursor,b.center) || Math.min(...a.items.map(i=>createdTime(i.delivery)))-Math.min(...b.items.map(i=>createdTime(i.delivery))) || a.key.localeCompare(b.key));
    const group=groups.shift()!; const ordered=nearest(cursor,group.items); optimized.push(...ordered); cursor=ordered[ordered.length-1].point!;
  }
  const queue=[...optimized,...approximate];
  const merged=normal.map(item=>item.delivery.order_locked?item:queue.shift()!);
  return [...urgent,...merged];
}

export function neighborMetadata(stops: RouteStop[], thresholdMeters=250) {
  const result=new Map<string,{position:number;total:number}>(); const visited=new Set<string>();
  for(const stop of stops){
    if(visited.has(stop.delivery.id)) continue;
    const group=stops.filter(candidate=>candidate.delivery.id===stop.delivery.id || (!!stop.point && !!candidate.point && distanceMeters(stop.point,candidate.point)<=thresholdMeters));
    if(group.length<2) continue;
    group.forEach((item,index)=>{visited.add(item.delivery.id);result.set(item.delivery.id,{position:index+1,total:group.length});});
  }
  return result;
}
