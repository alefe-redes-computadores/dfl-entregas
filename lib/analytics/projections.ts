export const ANALYTICS_PROJECTOR_VERSION = 2 as const;

export type AnalyticsDailyProjection = {
  dateKey: string;
  salesCount: number;
  grossRevenue: number;
  deliveryFees: number;
  discounts: number;
  operationalExpenses: number;
  stockPurchases: number;
  fuelExpenses: number;
};

export type AnalyticsProjectionDelta = Omit<
  AnalyticsDailyProjection,
  'dateKey'
>;

export function emptyDailyProjection(
  dateKey: string,
): AnalyticsDailyProjection {
  return {
    dateKey,
    salesCount: 0,
    grossRevenue: 0,
    deliveryFees: 0,
    discounts: 0,
    operationalExpenses: 0,
    stockPurchases: 0,
    fuelExpenses: 0,
  };
}

const finite = (value: number) =>
  Number.isFinite(value) ? value : 0;

export function applyDailyDelta(
  current: AnalyticsDailyProjection,
  delta: Partial<AnalyticsProjectionDelta>,
): AnalyticsDailyProjection {
  return {
    dateKey: current.dateKey,
    salesCount: current.salesCount + finite(delta.salesCount ?? 0),
    grossRevenue: current.grossRevenue + finite(delta.grossRevenue ?? 0),
    deliveryFees: current.deliveryFees + finite(delta.deliveryFees ?? 0),
    discounts: current.discounts + finite(delta.discounts ?? 0),
    operationalExpenses:
      current.operationalExpenses +
      finite(delta.operationalExpenses ?? 0),
    stockPurchases:
      current.stockPurchases + finite(delta.stockPurchases ?? 0),
    fuelExpenses:
      current.fuelExpenses + finite(delta.fuelExpenses ?? 0),
  };
}

/**
 * Persistir a contribuição anterior por businessKey permite correção real:
 * update/cancelamento = next - previous. Assim retry não soma duas vezes.
 */
export function diffDailyContribution(
  previous: Partial<AnalyticsProjectionDelta> | null | undefined,
  next: Partial<AnalyticsProjectionDelta> | null | undefined,
): AnalyticsProjectionDelta {
  const keys: Array<keyof AnalyticsProjectionDelta> = [
    'salesCount',
    'grossRevenue',
    'deliveryFees',
    'discounts',
    'operationalExpenses',
    'stockPurchases',
    'fuelExpenses',
  ];
  const result = {} as AnalyticsProjectionDelta;
  for (const key of keys) {
    result[key] =
      finite(next?.[key] ?? 0) - finite(previous?.[key] ?? 0);
  }
  return result;
}

export type AnalyticsProjectorCheckpoint = {
  projector: 'analytics-v1';
  version: typeof ANALYTICS_PROJECTOR_VERSION;
  lastEventKey?: string;
  lastOccurredAt?: string;
  updatedAt: string;
};
