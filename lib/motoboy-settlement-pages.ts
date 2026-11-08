/** R299 P14: canvas Android limitado, mas dados nunca silenciosamente truncados. */
export function paginateSettlementRows<T>(rows: readonly T[], pageSize = 28): T[][] {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 72) {
    throw new Error('Limite de linhas de imagem inválido.');
  }
  if (!rows.length) return [[]];
  const pages:T[][]=[];
  for(let index=0; index<rows.length; index+=pageSize) pages.push(rows.slice(index,index+pageSize));
  return pages;
}
