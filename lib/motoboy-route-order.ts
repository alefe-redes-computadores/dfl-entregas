/** Only sorts labels in rendered settlement reports. Never mutates the accounting input. */
const routeCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
export function settlementRouteOrder<T extends { label: string }>(routes: readonly T[]): T[] {
  return [...routes].sort((a, b) => routeCollator.compare(a.label, b.label));
}
