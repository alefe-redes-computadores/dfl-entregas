export const ANALYTICS_PROJECTOR_VERSION = 1 as const;

export type AnalyticsDailyProjection = {
  dateKey: string; salesCount: number; grossRevenue: number; deliveryFees: number;
  discounts: number; operationalExpenses: number; stockPurchases: number; fuelExpenses: number;
};

export function emptyDailyProjection(dateKey: string): AnalyticsDailyProjection {
  return { dateKey, salesCount: 0, grossRevenue: 0, deliveryFees: 0, discounts: 0,
    operationalExpenses: 0, stockPurchases: 0, fuelExpenses: 0 };
}

export type AnalyticsProjectorCheckpoint = {
  projector: 'analytics-v1'; version: typeof ANALYTICS_PROJECTOR_VERSION;
  lastEventKey?: string; lastOccurredAt?: string; updatedAt: string;
};
