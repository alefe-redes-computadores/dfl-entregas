/**
 * R229-R3: a seta do swipe à esquerda deve chamar o MESMO handler da
 * baixa/desfazer existente. Não altera pagamento, estoque ou operação.
 * Os limites de distância / ângulo continuam no detector de toque do card.
 */
export function canSwipeCompleteOrUndo(pendingCount: number, completedCount: number): boolean {
  return Number.isInteger(pendingCount) && pendingCount >= 0 &&
    Number.isInteger(completedCount) && completedCount >= 0 &&
    (pendingCount > 0 || completedCount > 0);
}
