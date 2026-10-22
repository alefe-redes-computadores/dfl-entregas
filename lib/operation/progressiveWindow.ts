/** R45: pagina apenas apresentacao; filtros, totais e validacoes usam a colecao integral. */
export const OPERATION_FIRST_BATCH = 40;
export const OPERATION_BATCH = 40;
export function progressiveCount(total: number, requested: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safeTotal = Math.floor(total);
  if (!Number.isFinite(requested)) return Math.min(safeTotal, OPERATION_FIRST_BATCH);
  return Math.min(safeTotal, Math.max(OPERATION_FIRST_BATCH, Math.floor(requested)));
}
export function nextProgressiveCount(total: number, shown: number): number {
  return progressiveCount(total, progressiveCount(total, shown) + OPERATION_BATCH);
}
