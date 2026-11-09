/** R300 P3 — aggregation for picking beverages, never an inventory write.
 * Every source order remains visible. Unknown/ambiguous strings go to manual
 * review instead of guessing a quantity or silently dropping a drink.
 */
import { parseBeverageTokens } from '@/lib/operation/beverage-normalization';

export type RouteDrinkSource = {
  id: string;
  name: string;
  drinks: string;
};
export type RouteDrinkItem = {
  name: string;
  qty: number;
  orders: Array<{ id: string; name: string; qty: number }>;
};
export type RouteDrinkReview = {
  items: RouteDrinkItem[];
  unknown: RouteDrinkSource[];
  totalUnits: number;
  orderCount: number;
};

export function aggregateRouteBeverages(sources: readonly RouteDrinkSource[]): RouteDrinkReview {
  const grouped = new Map<string, RouteDrinkItem>();
  const unknown: RouteDrinkSource[] = [];
  let orderCount = 0;

  for (const source of sources) {
    const text = String(source.drinks || '').trim();
    if (!text) continue;
    orderCount += 1;
    const tokens = parseBeverageTokens(text);
    if (!tokens.length) {
      unknown.push({ id: source.id, name: source.name, drinks: text.slice(0, 240) });
      continue;
    }
    for (const token of tokens) {
      const previous = grouped.get(token.name);
      if (previous) {
        previous.qty += token.qty;
        previous.orders.push({ id: source.id, name: source.name, qty: token.qty });
      } else {
        grouped.set(token.name, {
          name: token.name,
          qty: token.qty,
          orders: [{ id: source.id, name: source.name, qty: token.qty }],
        });
      }
    }
  }

  return {
    items: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    unknown,
    totalUnits: [...grouped.values()].reduce((sum, item) => sum + item.qty, 0),
    orderCount,
  };
}
