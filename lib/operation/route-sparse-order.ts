import type { Delivery } from '@/types';

/**
 * R229: documentos que efetivamente precisam ser escritos após uma mudança
 * de sequência. Preserva os metadados históricos das posições não alteradas.
 * Se a operação explicitamente altera travas, compara esse campo também.
 * Não confunde a atualização visual local com confirmação do Firestore.
 */
export function changedRouteOrderDocuments(
  previous: readonly Delivery[],
  normalized: readonly Delivery[],
  metadata?: { order_locked?: boolean },
): Delivery[] {
  const byId = new Map(previous.map((item) => [item.id, item] as const));
  return normalized.filter((candidate) => {
    const original = byId.get(candidate.id);
    if (!original) return true;
    if (original.order_index !== candidate.order_index) return true;
    return metadata?.order_locked !== undefined &&
      original.order_locked !== metadata.order_locked;
  });
}
