/** R99: busca normalizada, independente de renderização e sem I/O. */
export const normalizeOperationSearch = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Todos os termos podem aparecer em ordem diferente. Nenhum dado é persistido. */
export function matchesOperationSearch(haystack: unknown, query: unknown): boolean {
  const rawQuery = String(query ?? '').trim();
  if (!rawQuery) return true;
  const rawHaystack = String(haystack ?? '');
  const digits = rawQuery.replace(/\D/g, '');
  if (digits.length >= 3 && /^[\d\s()+.\-]+$/.test(rawQuery)) {
    return rawHaystack.replace(/\D/g, '').includes(digits);
  }
  const normalized = normalizeOperationSearch(rawHaystack);
  return normalizeOperationSearch(rawQuery).split(/\s+/).filter(Boolean)
    .every((term) => normalized.includes(term));
}
