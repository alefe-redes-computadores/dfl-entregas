/** DFL R228-R2: priorização conservadora para NOVAS entregas.
 * Uma rota já despachada só pode ser escolhida por decisão explícita.
 * Não altera vínculos históricos nem a autoridade do Firebase. */
import type { Route } from '@/types';
import { routeStartedAt } from '@/lib/operational-time';

export type NewDeliveryRouteReason =
  | 'single_assembling'
  | 'remembered_assembling'
  | 'multiple_assembling'
  | 'all_departed'
  | 'no_open_routes';

export function prioritizeOpenRoutesForNewDelivery(routes: readonly Route[]): Route[] {
  return [...routes].sort((a, b) =>
    Number(Boolean(routeStartedAt(a))) - Number(Boolean(routeStartedAt(b))) ||
    (a.name || '').localeCompare(b.name || '', 'pt-BR') || a.id.localeCompare(b.id),
  );
}

export function recommendRouteForNewDelivery(
  openRoutes: readonly Route[],
  rememberedId?: string | null,
): { routeId: string; reason: NewDeliveryRouteReason } {
  const assembling = openRoutes.filter((route) => route.status === 'aberta' && !routeStartedAt(route));
  if (assembling.length === 1) return { routeId: assembling[0].id, reason: 'single_assembling' };
  if (assembling.length > 1) {
    const remembered = assembling.find((route) => route.id === rememberedId);
    return remembered
      ? { routeId: remembered.id, reason: 'remembered_assembling' }
      : { routeId: '', reason: 'multiple_assembling' };
  }
  return { routeId: '', reason: openRoutes.length ? 'all_departed' : 'no_open_routes' };
}
