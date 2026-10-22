// DFL V111 R51 — projeção local, sem consultas e sem persistência.
// Mantém a regra legada: route.motoboy_id tem prioridade absoluta;
// somente rotas sem ID podem usar nome normalizado.
import type { Delivery, Motoboy, Route } from '@/types';
import { normalizeName } from '@/lib/motoboy-analytics';

export interface MotoboyOverviewRow {
  motoboy: Motoboy;
  routeCount: number;
  deliveryCount: number;
  completed: number;
}

function addIndex(index: Map<string, number[]>, key: string, row: number): void {
  const found = index.get(key);
  if (found) found.push(row);
  else index.set(key, [row]);
}

export function buildMotoboyOverview(
  motoboys: readonly Motoboy[],
  routes: readonly Route[],
  deliveries: readonly Delivery[],
): MotoboyOverviewRow[] {
  const rows = motoboys.map((motoboy) => ({motoboy, routeCount: 0, deliveryCount: 0, completed: 0}));
  const rowsById = new Map<string, number[]>();
  const rowsByLegacyName = new Map<string, number[]>();
  for (let i = 0; i < motoboys.length; i++) {
    addIndex(rowsById, motoboys[i].id, i);
    addIndex(rowsByLegacyName, normalizeName(motoboys[i].name), i);
  }

  // Um único percurso pelas rotas identifica quais perfis as enxergam.
  // Set deduplica o ID físico da rota para não contar sua entrega duas
  // vezes se dados antigos tiverem rotas repetidas com o mesmo ID.
  const deliveryOwners = new Map<string, Set<number>>();
  for (const route of routes) {
    const owners = route.motoboy_id
      ? rowsById.get(route.motoboy_id)
      : rowsByLegacyName.get(normalizeName(route.motoboy_name));
    if (!owners) continue;
    let routeOwners = deliveryOwners.get(route.id);
    if (!routeOwners) {
      routeOwners = new Set<number>();
      deliveryOwners.set(route.id, routeOwners);
    }
    for (const index of owners) {
      rows[index].routeCount++;
      routeOwners.add(index);
    }
  }

  // Mantém os filtros financeiros e a atribuição: somente route_id.
  // Não considera completed como pagamento recebido.
  for (const delivery of deliveries) {
    const owners = deliveryOwners.get(delivery.route_id);
    if (!owners) continue;
    for (const index of owners) {
      rows[index].deliveryCount++;
      if (delivery.completed) rows[index].completed++;
    }
  }
  return rows;
}
