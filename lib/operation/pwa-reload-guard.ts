/** R231: uma nova versão do PWA não deve descartar edição ou aguardar
 * confirmação de uma operação crítica. Política pura; nenhum replay/remoto. */
export type PwaReloadContext = {
  pendingWrites: number;
  unverifiedWrites: number;
  editingForm: boolean;
};
export function mayApplyPwaUpdate(input: PwaReloadContext): boolean {
  return Number.isFinite(input.pendingWrites) && input.pendingWrites === 0 &&
    Number.isFinite(input.unverifiedWrites) && input.unverifiedWrites === 0 &&
    input.editingForm === false;
}
