import type { Customer, Delivery } from '@/types';
import { extractLatLngFromMapsUrl } from '@/lib/maps';

/** One pass through actionable deliveries; route exceptions always take priority. */
export function classifyHomeExceptions(pending: readonly Delivery[], customers: readonly Customer[], routeIds: ReadonlySet<string>) {
  const customerById = new Map(customers.map(item => [item.id, item]));
  const unassigned: Delivery[] = [];
  const corruptLinks: Delivery[] = [];
  const noAddress: Delivery[] = [];
  const addressOnly: Delivery[] = [];
  for (const item of pending) {
    if (!item.route_id) { unassigned.push(item); continue; }
    if (!routeIds.has(item.route_id)) { corruptLinks.push(item); continue; }
    const customer = item.customer_id ? customerById.get(item.customer_id) : undefined;
    const address = item.address_string?.trim() || customer?.address?.trim() || '';
    if (!address) { noAddress.push(item); continue; }
    if (!/\b\d{1,5}\b/.test(address) && !extractLatLngFromMapsUrl(item.maps_link || customer?.maps_link)) {
      addressOnly.push(item);
    }
  }
  return { unassigned, corruptLinks, noAddress, addressOnly };
}
