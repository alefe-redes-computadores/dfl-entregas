/**
 * R225 — atalhos aritméticos puros para o estoque; nenhuma gravação e nenhuma
 * integração remota. O atalho "Tudo" SEMPRE escolhe a unidade-base.
 * Assim, o saldo de 3,4 kg é informado como 3,4 kg, e nunca como 3,4 fardos.
 */
export function fullStockQuantityInput(balance: number): string {
  if (!Number.isFinite(balance) || balance <= 0) return '';
  // Estoque atual utiliza precisão até quatro casas (roundStockQuantity).
  return Number(balance.toFixed(4)).toLocaleString('pt-BR', {
    useGrouping: false,
    maximumFractionDigits: 4,
  });
}

export function canShortcutAllStock(type: string, mode: string, balance: number): boolean {
  return (type === 'saida' || type === 'perda') && mode === 'moved' &&
    Number.isFinite(balance) && balance > 0;
}

/** Aviso explicável da projeção ANTES de salvar. Nunca altera saldo ou metas. */
export function movementStockSignal(
  type: string,
  after: number,
  minimum: number | undefined | null,
): string | null {
  if (!['saida', 'perda', 'contagem', 'ajuste', 'entrada'].includes(type)) return null;
  if (!Number.isFinite(after) || after < 0) return null;
  if (after === 0) return 'O estoque ficará zerado';
  if (typeof minimum === 'number' && Number.isFinite(minimum) && minimum > 0 && after < minimum) {
    return 'Saldo projetado abaixo do mínimo';
  }
  return null;
}
