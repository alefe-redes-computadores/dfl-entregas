/**
 * R61 — Rollback otimista granular. Uma falha de rede não pode restaurar um
 * snapshot inteiro e apagar alterações concorrentes de OUTROS registros.
 *
 * Os marcadores por referência evitam desfazer uma versão mais recente do
 * mesmo registro. Não implementa serialização entre dispositivos nem altera
 * a autoridade do Firebase.
 */
export interface IdEntity { id: string }

export function rollbackAddedEntity<T extends IdEntity>(
  current: readonly T[], optimistic: T,
): T[] {
  return current.filter((item) => item.id !== optimistic.id || item !== optimistic);
}

export function rollbackUpdatedEntity<T extends IdEntity>(
  current: readonly T[], previous: T, optimistic: T,
): T[] {
  return current.map((item) => item.id === previous.id && item === optimistic ? previous : item);
}

/** Reinsere uma exclusão falha sem sobrescrever alterações concorrentes. */
export function rollbackDeletedEntity<T extends IdEntity>(
  current: readonly T[], previous: T | undefined, previousIndex: number,
): T[] {
  if (!previous || current.some((item) => item.id === previous.id)) return [...current];
  const next = [...current];
  next.splice(Math.min(Math.max(previousIndex, 0), next.length), 0, previous);
  return next;
}

/** Desfaz somente entradas deste lote que ainda são a versão otimista original. */
export function rollbackAddedEntities<T extends IdEntity>(
  current: readonly T[], optimisticBatch: readonly T[],
): T[] {
  const optimisticById = new Map(optimisticBatch.map((item) => [item.id, item]));
  return current.filter((item) => optimisticById.get(item.id) !== item);
}

/** Desfaz apenas entidades do lote que continuam exatamente na versão otimista. */
export function rollbackUpdatedEntities<T extends IdEntity>(
  current: readonly T[], previous: readonly T[], optimisticBatch: readonly T[],
): T[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const optimisticById = new Map(optimisticBatch.map((item) => [item.id, item]));
  return current.map((item) => optimisticById.get(item.id) === item
    ? previousById.get(item.id) ?? item
    : item);
}
