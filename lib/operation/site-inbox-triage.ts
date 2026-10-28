import type { Delivery, Route } from '@/types';

/** Pure presentation helpers: no Firestore, storage, scheduling or network. */
export type SiteTriageRow = {
  delivery: Pick<Delivery, 'id' | 'customer_name' | 'external_order_id' | 'order_id' | 'phone' | 'address_string' | 'observation'>;
  state: string;
  duplicate?: boolean;
};

function searchable(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function searchSiteInboxRows<T extends SiteTriageRow>(rows: readonly T[], query: string, focusId?: string | null): T[] {
  const needle = searchable(query);
  const visible = needle ? rows.filter(({ delivery }) => searchable([
    delivery.id, delivery.customer_name, delivery.external_order_id,
    delivery.order_id, delivery.phone, delivery.address_string,
    delivery.observation,
  ].filter(Boolean).join(' ')).includes(needle)) : [...rows];
  if (!focusId) return visible;
  const index = visible.findIndex(row => row.delivery.id === focusId);
  if (index <= 0) return visible;
  return [visible[index], ...visible.slice(0, index), ...visible.slice(index + 1)];
}

/** Counts existing unfinished deliveries per open destination; no implied capacity limit. */
export function openRouteWorkload(
  deliveries: readonly Pick<Delivery, 'route_id' | 'completed'>[],
  routes: readonly Pick<Route, 'id'>[],
): ReadonlyMap<string, number> {
  const openIds = new Set(routes.map(route => route.id));
  const load = new Map<string, number>();
  for (const item of deliveries) {
    const id = item.route_id;
    if (!id || item.completed || !openIds.has(id)) continue;
    load.set(id, (load.get(id) || 0) + 1);
  }
  return load;
}

/** UI preflight only; Firestore transaction remains authoritative and fail-closed. */
export function siteAllocationPreflight(input: {
  row?: Pick<SiteTriageRow, 'state' | 'duplicate'>;
  selectedRouteId: string;
  existingRouteIds: readonly string[];
  newMode: boolean;
  routeName: string;
  motoboyId: string;
  activeMotoboyIds: readonly string[];
  address: string;
}): string | null {
  if (!input.row) return 'Pedido não está mais na Caixa. Atualize e confira o status.';
  if (input.row.duplicate) return 'Possível duplicidade: confira o pedido no Site antes de vincular.';
  if (input.row.state !== 'pronto') return 'Pedido não está liberado para rota. Confira o status comercial.';
  if (!input.address.trim()) return 'Confirme o endereço antes de vincular à rota.';
  if (input.newMode) {
    if (!input.routeName.trim()) return 'Informe o nome da nova rota.';
    if (!input.motoboyId) return 'Escolha o motoboy responsável.';
    if (!input.activeMotoboyIds.includes(input.motoboyId)) return 'Motoboy não está mais ativo. Escolha novamente.';
    return null;
  }
  if (!input.selectedRouteId) return 'Escolha uma rota aberta.';
  if (!input.existingRouteIds.includes(input.selectedRouteId)) return 'A rota mudou ou já saiu. Escolha outra rota aberta.';
  return null;
}
