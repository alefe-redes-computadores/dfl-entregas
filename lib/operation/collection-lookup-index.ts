/**
 * R198: índices efêmeros por identidade do snapshot Zustand.
 * Uma mutação deve trocar a referência do array, como já ocorre nos reducers.
 * Não retém snapshots antigos: WeakMap permite coleta de lixo normal.
 * Não faz leitura ou escrita no Firestore.
 */
const customerIndexes = new WeakMap<object, Map<string, unknown>>();
const routeIndexes = new WeakMap<object, Map<string, readonly unknown[]>>();

/** A primeira ocorrência vence, reproduzindo Array.find() inclusive em dados legados. */
export function findByIdIndexed<T extends { id: string }>(
  items: readonly T[], id: string | undefined,
): T | undefined {
  if (!id) return undefined;
  let index = customerIndexes.get(items) as Map<string, T> | undefined;
  if (!index) {
    index = new Map<string, T>();
    for (const item of items) if (!index.has(item.id)) index.set(item.id, item);
    customerIndexes.set(items, index);
  }
  return index.get(id);
}

/**
 * Reconstrói O(n) apenas quando o array muda; buscas posteriores são O(1).
 * Sempre retorna uma cópia: .sort(), .reverse() e .splice() na tela NÃO
 * podem modificar o índice compartilhado com outras rotas.
 */
export function deliveriesForRouteIndexed<T extends { route_id?: string }>(
  items: readonly T[], routeId: string,
): T[] {
  let index = routeIndexes.get(items) as Map<string, T[]> | undefined;
  if (!index) {
    index = new Map<string, T[]>();
    for (const item of items) {
      const key = item.route_id;
      if (!key) continue;
      const group = index.get(key);
      if (group) group.push(item);
      else index.set(key, [item]);
    }
    routeIndexes.set(items, index);
  }
  return [...(index.get(routeId) || [])];
}
