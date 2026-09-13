import type { Customer, Delivery } from '@/types';
import { distanceMeters, extractLatLngFromMapsUrl, type LatLngPoint } from '@/lib/maps';
import { deliveryStopKey } from '@/lib/route-stops';

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
  const groupMap = new Map<
    string,
    {
      key: string;
      items: RouteStop[];
      representative: RouteStop;
      urgent: boolean;
      locked: boolean;
    }
  >();

  [...stops]
    .sort(
      (a, b) =>
        createdTime(a.delivery) - createdTime(b.delivery) ||
        a.delivery.id.localeCompare(b.delivery.id),
    )
    .forEach((stop) => {
      const key = deliveryStopKey(stop.delivery);
      const current = groupMap.get(key);

      if (current) {
        current.items.push(stop);
        current.urgent ||= stop.delivery.is_urgent === true;
        current.locked ||= stop.delivery.order_locked === true;
        if (!current.representative.point && stop.point) {
          current.representative = stop;
        }
        return;
      }

      groupMap.set(key, {
        key,
        items: [stop],
        representative: stop,
        urgent: stop.delivery.is_urgent === true,
        locked: stop.delivery.order_locked === true,
      });
    });

  const physicalStops = [...groupMap.values()];
  const urgent = physicalStops
    .filter((group) => group.urgent)
    .sort(
      (a, b) =>
        createdTime(a.representative.delivery) -
        createdTime(b.representative.delivery),
    );

  const normal = physicalStops.filter((group) => !group.urgent);
  const movable = normal.filter((group) => !group.locked);
  const precise = movable.filter((group) => group.representative.point);
  const approximate = movable
    .filter((group) => !group.representative.point)
    .sort(
      (a, b) =>
        createdTime(a.representative.delivery) -
        createdTime(b.representative.delivery),
    );

  const neighborhoods = new Map<string, typeof precise>();

  precise.forEach((group) => {
    const key = groupKey(group.representative);
    neighborhoods.set(key, [
      ...(neighborhoods.get(key) || []),
      group,
    ]);
  });

  const neighborhoodGroups = [...neighborhoods.entries()].map(
    ([key, groups]) => ({
      key,
      groups,
      center: centroid(
        groups.map((group) => group.representative),
      ),
    }),
  );

  const optimized: typeof precise = [];
  let cursor = origin;

  while (neighborhoodGroups.length) {
    neighborhoodGroups.sort(
      (a, b) =>
        distanceMeters(cursor, a.center) -
          distanceMeters(cursor, b.center) ||
        a.key.localeCompare(b.key),
    );

    const neighborhood = neighborhoodGroups.shift()!;
    const orderedRepresentatives = nearest(
      cursor,
      neighborhood.groups.map((group) => group.representative),
    );

    orderedRepresentatives.forEach((stop) => {
      const group = neighborhood.groups.find(
        (candidate) =>
          candidate.key === deliveryStopKey(stop.delivery),
      );
      if (group) optimized.push(group);
    });

    const last = orderedRepresentatives[orderedRepresentatives.length - 1];
    if (last?.point) cursor = last.point;
  }

  const queue = [...optimized, ...approximate];
  const merged = normal.map((group) =>
    group.locked ? group : queue.shift()!,
  );

  return [...urgent, ...merged].flatMap((group) =>
    group.items.sort(
      (a, b) =>
        createdTime(a.delivery) - createdTime(b.delivery) ||
        a.delivery.id.localeCompare(b.delivery.id),
    ),
  );
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
