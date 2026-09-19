import type {
  Delivery,
  Fueling,
  OperationalExpense,
  Route,
  StockSupply,
} from '@/types';
import type { CanonicalAnalyticsFact } from './ledger';
import {
  deliveryFact,
  fuelingFact,
  operationalExpenseFact,
  routeFact,
  stockPurchaseFact,
} from './read-model';

export type AnalyticsOperationalSnapshotInput = {
  deliveries: Delivery[];
  routes: Route[];
  operationalExpenses: OperationalExpense[];
  fuelings: Fueling[];
  stockSupplies: StockSupply[];
};

export type AnalyticsOperationalSnapshot = {
  version: 1;
  generatedAt: string;
  facts: CanonicalAnalyticsFact[];
  diagnostics: {
    facts: number;
    deliveries: number;
    siteLinkedDeliveries: number;
    routes: number;
    operationalExpenses: number;
    fuelings: number;
    stockPurchases: number;
  };
};

export function buildAnalyticsOperationalSnapshot(
  input: AnalyticsOperationalSnapshotInput,
): AnalyticsOperationalSnapshot {
  const deliveries = input.deliveries.map(deliveryFact);
  const routes = input.routes.map(routeFact);
  const expenses = input.operationalExpenses.map(operationalExpenseFact);
  const fuelings = input.fuelings.map(fuelingFact);
  const purchases = input.stockSupplies.map(stockPurchaseFact);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    facts: [
      ...deliveries,
      ...routes,
      ...expenses,
      ...fuelings,
      ...purchases,
    ],
    diagnostics: {
      facts:
        deliveries.length +
        routes.length +
        expenses.length +
        fuelings.length +
        purchases.length,
      deliveries: deliveries.length,
      siteLinkedDeliveries: input.deliveries.filter(
        (item) =>
          item.source_system === 'dfl_site' &&
          Boolean(item.external_order_id),
      ).length,
      routes: routes.length,
      operationalExpenses: expenses.length,
      fuelings: fuelings.length,
      stockPurchases: purchases.length,
    },
  };
}
