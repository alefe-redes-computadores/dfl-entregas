import type { StockProduct } from '@/types';
import { stockProductCategory, stockCategoryOrder } from '@/lib/stock-categories';

/** R299 P14: a fila conserva exatamente a ordem visível do Estoque. */
export function nextStockReviewTarget(
  products: readonly StockProduct[],
  queueIds: readonly string[],
  currentId: string,
  skipCategory = false,
): StockProduct | null {
  const byId = new Map(products.filter(p => p.active).map(p => [p.id, p]));
  const ids = queueIds.length ? [...new Set(queueIds)] : [...byId.keys()];
  const currentIndex = ids.indexOf(currentId);
  if (currentIndex < 0) return null;
  const current = byId.get(currentId);
  if (!current) return null;
  const category = stockProductCategory(current.name, current.category);
  for (let index = currentIndex + 1; index < ids.length; index += 1) {
    const candidate = byId.get(ids[index]);
    if (!candidate) continue;
    if (skipCategory && stockProductCategory(candidate.name, candidate.category) === category) continue;
    return candidate;
  }
  return null;
}

export type QuickStockFilter = 'todos' | 'zerados' | 'minimo' | 'alto' | 'compra_hoje';

export function filterStockCountProducts(
  products: readonly StockProduct[],
  options: {
    query: string;
    category: string;
    filter: QuickStockFilter;
    onlyUnreviewed: boolean;
    reviewed: Readonly<Record<string, boolean>>;
    purchasedTodayIds: ReadonlySet<string>;
  },
): Array<{ category: string; items: StockProduct[] }> {
  const needle = options.query.trim().toLocaleLowerCase('pt-BR');
  const groups = new Map<string, StockProduct[]>();
  for (const product of products) {
    if (!product.active) continue;
    const category = stockProductCategory(product.name, product.category);
    const qty = Number(product.current_quantity);
    const minimum = Math.max(0, Number(product.minimum_quantity) || 0);
    const ideal = Math.max(minimum, Number(product.ideal_quantity) || 0);
    if (options.category !== 'todas' && category !== options.category) continue;
    if (needle && !`${product.name} ${category}`.toLocaleLowerCase('pt-BR').includes(needle)) continue;
    if (options.onlyUnreviewed && options.reviewed[product.id]) continue;
    if (options.filter === 'zerados' && qty > 0) continue;
    if (options.filter === 'minimo' && (qty <= 0 || qty > minimum)) continue;
    if (options.filter === 'alto' && qty <= ideal) continue;
    if (options.filter === 'compra_hoje' && !options.purchasedTodayIds.has(product.id)) continue;
    const current = groups.get(category) || [];
    current.push(product);
    groups.set(category, current);
  }
  return [...groups].sort(([a],[b]) => stockCategoryOrder(a)-stockCategoryOrder(b) || a.localeCompare(b,'pt-BR'))
    .map(([category,items]) => ({ category, items: [...items].sort((a,b) => a.name.localeCompare(b.name,'pt-BR')) }));
}

/** Não inclui compras pendentes de ontem ou saídas avulsas. */
export function purchasedStockIdsToday(
  supplies: readonly { occurred_at: string; stock_reversed_at?: string; items: readonly {stock_product_id?: string}[] }[],
  todayKey: string,
  dayKey: (raw: string) => string,
): Set<string> {
  const ids = new Set<string>();
  for (const supply of supplies) {
    if (supply.stock_reversed_at || dayKey(supply.occurred_at) !== todayKey) continue;
    for (const item of supply.items) if (item.stock_product_id) ids.add(item.stock_product_id);
  }
  return ids;
}
