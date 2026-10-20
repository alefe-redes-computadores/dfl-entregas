import type { StockProductPresentation } from '@/types';

/** Never silently drop an edited commercial presentation at save time. */
export function validateCommercialPresentations(items: StockProductPresentation[]): string | null {
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.id)) return `Forma de compra ${index + 1}: identificador duplicado.`;
    ids.add(item.id);
    // Paused historical entries are retained as-is, not rewritten or deleted.
    if (!item.active) continue;
    if (!item.label?.trim()) return `Forma de compra ${index + 1}: informe o nome da embalagem ou remova a linha.`;
    const conversion = Number(item.conversion_quantity);
    if (!Number.isFinite(conversion) || conversion <= 0) return `Forma de compra ${index + 1}: informe uma quantidade válida e maior que zero.`;
    if (conversion > 1e12) return `Forma de compra ${index + 1}: quantidade acima do limite seguro.`;
  }
  return null;
}

export function cleanCommercialPresentations(items: StockProductPresentation[]): StockProductPresentation[] {
  const error = validateCommercialPresentations(items);
  if (error) throw new Error(error);
  return items.map(item => ({ ...item, label: (item.label || '').trim() }));
}
