import type {
  StockProduct,
  StockSupply,
} from '@/types';

export interface ShoppingPriceSignal {
  samples: number;
  median: number | null;
  latest: number | null;
  lowest: number | null;
  current: number;
  deltaPercent: number | null;
  tone: 'good' | 'neutral' | 'bad' | 'unknown';
  label: string;
}

const median = (values: number[]) => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function shoppingPriceSignal(
  product: StockProduct,
  supplies: StockSupply[],
  current: number,
): ShoppingPriceSignal {
  const rows = supplies
    .flatMap((supply) =>
      supply.items.map((item) => ({
        supply,
        item,
      })),
    )
    .filter(
      ({ supply, item }) =>
        item.stock_product_id === product.id &&
        Boolean(supply.stock_integrated_at) &&
        !supply.stock_reversed_at &&
        Number(item.unit_price) > 0,
    )
    .sort(
      (a, b) =>
        new Date(b.supply.occurred_at).getTime() -
        new Date(a.supply.occurred_at).getTime(),
    );

  const values = rows
    .map(({ item }) => Number(item.unit_price))
    .filter((value) => value > 0);

  const historicalMedian = median(values);
  const latest = values[0] ?? null;
  const lowest = values.length
    ? Math.min(...values)
    : null;

  const deltaPercent =
    historicalMedian && current > 0
      ? ((current - historicalMedian) /
          historicalMedian) *
        100
      : null;

  let tone: ShoppingPriceSignal['tone'] =
    'unknown';
  let label = 'Sem histórico comparável';

  if (deltaPercent !== null) {
    if (deltaPercent <= -5) {
      tone = 'good';
      label = `${Math.abs(deltaPercent).toFixed(
        0,
      )}% abaixo da mediana`;
    } else if (deltaPercent >= 8) {
      tone = 'bad';
      label = `${deltaPercent.toFixed(
        0,
      )}% acima da mediana`;
    } else {
      tone = 'neutral';
      label = 'Dentro da faixa histórica';
    }
  }

  return {
    samples: values.length,
    median: historicalMedian,
    latest,
    lowest,
    current,
    deltaPercent,
    tone,
    label,
  };
}

export function projectedAverageCost(
  product: StockProduct,
  addedQuantity: number,
  newUnitCost: number,
) {
  const oldQuantity = Math.max(
    0,
    product.current_quantity,
  );
  const oldCost = Math.max(
    0,
    product.average_cost || 0,
  );

  if (!(addedQuantity > 0 && newUnitCost > 0)) {
    return oldCost;
  }

  if (oldQuantity <= 0) return newUnitCost;

  return (
    (oldQuantity * oldCost +
      addedQuantity * newUnitCost) /
    (oldQuantity + addedQuantity)
  );
}
