import type { Delivery } from '@/types';

/** Uma única gravação de sequência por rota e por sessão. Outras rotas não bloqueiam. */
const activeWrites = new Set<string>();

export async function withRouteOrderWriteLock<T>(
  routeId: string,
  write: () => Promise<T>,
): Promise<T> {
  if (activeWrites.has(routeId)) {
    throw new Error('Uma mudança de sequência desta rota ainda está sendo salva.');
  }
  activeWrites.add(routeId);
  try {
    return await write();
  } finally {
    activeWrites.delete(routeId);
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
