/** R287 — a data da URL é a autoridade do primeiro render de Entregas e Rotas. */
export function validDatedOperationKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function datedOperationKey(urlDate: string | null, selectedDate: string): string {
  return validDatedOperationKey(urlDate) ? urlDate : selectedDate;
}

/** Preserva os demais filtros ao trocar de dia, sem recarregar a página. */
export function datedOperationHref(path: '/entregas' | '/rotas', currentQuery: string, date: string): string {
  if (!validDatedOperationKey(date)) throw new Error('Data operacional inválida');
  const params = new URLSearchParams(currentQuery);
  params.set('date', date);
  return `${path}?${params.toString()}`;
}
