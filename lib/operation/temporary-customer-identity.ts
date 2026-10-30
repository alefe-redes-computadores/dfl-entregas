/** R195: autoriza vínculo explícito sem enriquecer cadastro nem criar duplicata. */
export function assertTemporaryCustomerBinding(input: {
  origin?: string;
  selectedId?: string;
  preferredId?: string;
  persistedId?: string;
  namesMatch: boolean;
  currentPhone?: string;
  allowedPhones: string[];
}): void {
  if (input.origin !== 'loja') throw new Error('Destino temporário permitido somente para pedidos da loja.');
  if (!input.selectedId || input.selectedId !== input.preferredId || input.selectedId !== input.persistedId) {
    throw new Error('Cliente selecionado não encontrado ou vínculo alterado. Selecione-o novamente.');
  }
  if (!input.namesMatch) throw new Error('Nome diferente do cliente selecionado. Confirme a identidade antes de salvar.');
  if (input.currentPhone && input.allowedPhones.length > 0 && !input.allowedPhones.includes(input.currentPhone)) {
    throw new Error('Telefone diverge do cliente selecionado. Confirme o vínculo antes de salvar.');
  }
}
