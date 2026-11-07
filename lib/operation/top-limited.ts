/** R298: top-K ordenado e estável, sem ordenar o histórico completo.
 * A comparação é a mesma usada por Array.sort; empates mantêm a ordem de entrada.
 * Não modifica a coleção de origem nem faz I/O.
 */
export function topRanked<T>(items: readonly T[], requested: number, compare: (left: T, right: T) => number): T[] {
  const limit = Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 0;
  if (!limit) return [];
  const result: T[] = [];
  for (const item of items) {
    // Um item empatado com o último após atingir o limite entrou depois;
    // o sort estável original também o deixaria fora.
    if (result.length === limit && compare(item, result[result.length - 1]) >= 0) continue;
    let low = 0, high = result.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compare(item, result[middle]) < 0) high = middle;
      else low = middle + 1;
    }
    result.splice(low, 0, item);
    if (result.length > limit) result.pop();
  }
  return result;
}
