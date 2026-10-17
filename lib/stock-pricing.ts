import type { StockProduct, StockSupplier, StockSupply } from '@/types';
import { comparableBaseUnitCost } from '@/lib/stock-commercial-health';

export type StockPriceInsight = {
  product: StockProduct;
  samples: number;
  median: number;
  lowest: number;
  latest: number;
  bestSupplier?: string;
  savingPercent?: number;
  confidence: 'baixa' | 'média' | 'alta';
};

type PriceObservation = { price: number; supplier: string; date: number };
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};

/** O histórico é indexado em uma passagem, sem filtrar todas as compras para cada produto. */
export function buildStockPriceInsights(
  products: StockProduct[],
  supplies: StockSupply[],
  suppliers: StockSupplier[],
): StockPriceInsight[] {
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const history = new Map<string, PriceObservation[]>();
  for (const supply of supplies) {
    if (supply.status !== 'recebido' && supply.status !== 'conferido') continue;
    const supplier = supplierNames.get(supply.supplier_id || '') || supply.supplier || 'Fornecedor não informado';
    const timestamp = new Date(supply.occurred_at || supply.created_at).getTime();
    for (const item of supply.items) {
      if (!item.stock_product_id) continue;
      const price = comparableBaseUnitCost(item);
      if (price === null || !Number.isFinite(price) || price <= 0) continue;
      const observations = history.get(item.stock_product_id) || [];
      observations.push({ price, supplier, date: timestamp });
      history.set(item.stock_product_id, observations);
    }
  }
  const insights: StockPriceInsight[] = [];
  for (const product of products) {
    const observations = history.get(product.id);
    if (!observations?.length) continue;
    observations.sort((a, b) => b.date - a.date);
    const prices = observations.map((item) => item.price);
    const bySupplier = new Map<string, number[]>();
    for (const row of observations) {
      const values = bySupplier.get(row.supplier) || [];
      values.push(row.price);
      bySupplier.set(row.supplier, values);
    }
    let bestSupplier: string | undefined;
    let bestPrice = Infinity;
    for (const [name, values] of bySupplier) {
      const candidate = median(values);
      if (candidate < bestPrice) {
        bestPrice = candidate;
        bestSupplier = name;
      }
    }
    const typicalPrice = median(prices);
    insights.push({
      product,
      samples: observations.length,
      median: typicalPrice,
      lowest: Math.min(...prices),
      latest: observations[0].price,
      bestSupplier,
      savingPercent: typicalPrice > 0 && bestSupplier
        ? Math.max(0, (typicalPrice - bestPrice) / typicalPrice * 100)
        : 0,
      confidence: observations.length >= 8 ? 'alta' : observations.length >= 3 ? 'média' : 'baixa',
    });
  }
  return insights.sort((a, b) => (b.savingPercent || 0) - (a.savingPercent || 0));
}
