import type { Customer, Delivery } from '@/types';
import { distanceMeters, extractLatLngFromMapsUrl, type LatLngPoint } from '@/lib/maps';

export type RouteStop = { delivery: Delivery; customer?: Customer; point: LatLngPoint | null };

const createdTime = (delivery: Delivery) => {
  const time = new Date(delivery.created_at || delivery.createdAt || delivery.updated_at || 0).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};

export const deliveryPoint = (delivery: Delivery, customer?: Customer) =>
  extractLatLngFromMapsUrl(delivery.maps_link) || extractLatLngFromMapsUrl(customer?.maps_link);

function nearest(origin: LatLngPoint, stops: RouteStop[]) {
  const remaining = [...stops]; const result: RouteStop[] = []; let cursor = origin;
  while (remaining.length) {
    remaining.sort((a,b) => {
      // Dentro de um mesmo bolsão (até 250 m), quem foi cadastrado primeiro
      // permanece primeiro; a diferença pequena de GPS não troca os pedidos.
      if (distanceMeters(a.point!, b.point!) <= 250) {
        const registered = createdTime(a.delivery) - createdTime(b.delivery);
        if (registered) return registered;
      }
      const distance = distanceMeters(cursor, a.point!) - distanceMeters(cursor, b.point!);
      return distance || createdTime(a.delivery) - createdTime(b.delivery) || a.delivery.id.localeCompare(b.delivery.id);
    });
    const next = remaining.shift()!; result.push(next); cursor = next.point!;
  }
  return result;
}

/** Urgência vence distância; sem coordenadas e empates preservam a ordem de cadastro. */
export function buildSmartRouteOrder(origin: LatLngPoint, stops: RouteStop[]) {
  const urgent = stops.filter(item => item.delivery.is_urgent).sort((a,b) => createdTime(a.delivery)-createdTime(b.delivery));
  const normal = stops.filter(item => !item.delivery.is_urgent);
  const movable = normal.filter(item => !item.delivery.order_locked);
  const precise = movable.filter(item => item.point);
  const approximate = movable.filter(item => !item.point).sort((a,b) => createdTime(a.delivery)-createdTime(b.delivery));
  const optimized = [...nearest(origin, precise), ...approximate];
  const merged = normal.map(item => item.delivery.order_locked ? item : optimized.shift()!);
  return [...urgent, ...merged];
}

export function neighborMetadata(stops: RouteStop[], thresholdMeters = 250) {
  const result = new Map<string, { position: number; total: number }>();
  const visited = new Set<string>();
  for (const stop of stops) {
    if (visited.has(stop.delivery.id)) continue;
    const group = stops.filter(candidate => {
      if (candidate.delivery.id === stop.delivery.id) return true;
      if (!stop.point || !candidate.point) return false;
      return distanceMeters(stop.point, candidate.point) <= thresholdMeters;
    });
    if (group.length < 2) continue;
    group.forEach((item,index) => { visited.add(item.delivery.id); result.set(item.delivery.id,{position:index+1,total:group.length}); });
  }
  return result;
}
