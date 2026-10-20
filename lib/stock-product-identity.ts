/** Identidade conservadora para aviso de nome duplicado no cadastro local. */
export function canonicalStockProductName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
