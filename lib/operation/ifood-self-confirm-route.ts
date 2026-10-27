/** R126 E12: indice O(rotas + motoboys) para modo de confirmacao iFood. */
export interface IfoodSelfConfirmMotoboy {
  id: string;
  ifood_confirmation_mode?: string | null;
}
export interface IfoodSelfConfirmRoute {
  id: string;
  motoboy_id?: string | null;
}

/** Sem filtros de data/status: preserva exatamente a semantica das listas recebidas. */
export function ifoodSelfConfirmRouteIds(
  routes: readonly IfoodSelfConfirmRoute[],
  motoboys: readonly IfoodSelfConfirmMotoboy[],
): Set<string> {
  const selfConfirmMotoboys = new Set<string>();
  for (const motoboy of motoboys) {
    if (motoboy.ifood_confirmation_mode === 'motoboy') selfConfirmMotoboys.add(motoboy.id);
  }
  const ids = new Set<string>();
  for (const route of routes) {
    if (route.motoboy_id && selfConfirmMotoboys.has(route.motoboy_id)) ids.add(route.id);
  }
  return ids;
}
