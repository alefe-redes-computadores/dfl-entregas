import type { Delivery } from '@/types';

/**
 * Gravações sequenciais por rota, com falha isolada. A segunda ação aguarda
 * a primeira e lê o estado mais recente no callback; outras rotas seguem livres.
 * Não usamos timeout: isso poderia disparar escrita sobreposta após um timeout.
 */
const routeWriteTails = new Map<string, Promise<void>>();

export async function withRouteOrderWriteLock<T>(
  routeId: string,
  write: () => Promise<T>,
): Promise<T> {
  const previous = routeWriteTails.get(routeId) || Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  const settled = current.then(() => undefined, () => undefined);
  routeWriteTails.set(routeId, settled);
  try {
    return await current;
  } finally {
    if (routeWriteTails.get(routeId) === settled) routeWriteTails.delete(routeId);
  }
}

/**
 * Reverte só os metadados de ordenação modificados pelo envio que falhou.
 * Evita restaurar a lista inteira e apagar novas baixas, clientes ou pedidos
 * recebidos durante a espera pelo Firestore.
 */
export function rollbackRouteOrderFields<T extends Delivery>(
  current: T[],
  beforeWrite: readonly T[],
  writtenIds: ReadonlySet<string>,
  attemptUpdatedAt: string,
): T[] {
  const previous = new Map(beforeWrite.map((delivery) => [delivery.id, delivery]));
  return current.map((delivery) => {
    const original = previous.get(delivery.id);
    if (!writtenIds.has(delivery.id) || !original || delivery.updated_at !== attemptUpdatedAt) {
      return delivery;
    }
    return {
      ...delivery,
      order_index: original.order_index,
      order_locked: original.order_locked,
      order_source: original.order_source,
      order_updated_at: original.order_updated_at,
      updated_at: original.updated_at,
    };
  });
}
