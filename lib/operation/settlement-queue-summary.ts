/** R146: resumo operacional, sem criar acertos ou gravar despesas. */
export type SettlementQueueItem = { sourceId: string; routes: number; deliveries: number };
export function settlementQueueSummary(items: readonly SettlementQueueItem[]) {
  const seen = new Set<string>();
  let routes = 0;
  let deliveries = 0;
  for (const item of items) {
    if (!item.sourceId || seen.has(item.sourceId)) continue;
    seen.add(item.sourceId);
    routes += Number.isFinite(item.routes) ? Math.max(0, item.routes) : 0;
    deliveries += Number.isFinite(item.deliveries) ? Math.max(0, item.deliveries) : 0;
  }
  return { people: seen.size, routes, deliveries };
}
