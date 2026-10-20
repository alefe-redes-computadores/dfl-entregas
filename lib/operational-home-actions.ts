/**
 * Contagem de códigos no trecho em execução. Código coletado não significa
 * confirmação externa no iFood; a Central de Confirmações é independente.
 */
import type { Delivery } from '@/types';

export function routeIfoodCodeProgress(
  deliveries: readonly Delivery[],
  openRouteIds: ReadonlySet<string>,
) {
  let active = 0;
  let collected = 0;
  for (const delivery of deliveries) {
    if (delivery.origin !== 'ifood' || !delivery.route_id || !openRouteIds.has(delivery.route_id)) continue;
    active++;
    if ((delivery.confirmation_code || '').replace(/\D/g, '').length === 4) collected++;
  }
  return { active, collected, missing: active - collected };
}
