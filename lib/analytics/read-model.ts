import type {
  Delivery,
  Fueling,
  OperationalExpense,
  Route,
  StockSupply,
} from '@/types';
import {
  canonicalAnalyticsFact,
  type CanonicalAnalyticsFact,
} from './ledger';

const iso = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (value && Number.isFinite(Date.parse(value))) return value;
  }
  return new Date(0).toISOString();
};

const revision = (...values: Array<string | null | undefined>) =>
  iso(...values);

const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * IMPORTANTE:
 * Delivery originada do dfl_site NUNCA vira fato "sale" aqui.
 * O Site é a autoridade comercial daquele pedido. O Entregas apenas enriquece
 * a mesma venda com logística, impedindo receita duplicada.
 */
export function deliveryFact(delivery: Delivery): CanonicalAnalyticsFact {
  const externalOrderId =
    delivery.source_system === 'dfl_site'
      ? delivery.external_order_id || null
      : null;

  return canonicalAnalyticsFact({
    kind: 'delivery',
    authority: 'dfl_entregas',
    entityType: 'delivery',
    entityId: delivery.id,
    sourceSystem: 'dfl_entregas',
    sourceEventId: `analytics-delivery:${delivery.id}:${revision(
      delivery.updated_at,
      delivery.completed_at,
      delivery.created_at,
      delivery.createdAt,
    )}`,
    occurredAt: iso(
      delivery.completed_at,
      delivery.updated_at,
      delivery.created_at,
      delivery.createdAt,
    ),
    payload: {
      completed: delivery.completed === true,
      routeId: delivery.route_id || null,
      customerId: delivery.customer_id || null,
      externalOrderId,
      externalOrderSource: externalOrderId ? 'dfl_site' : null,
      fulfillmentMode: delivery.fulfillment_mode || null,
      value:
        delivery.source_system === 'dfl_site'
          ? null
          : finite(delivery.value),
      customerCharge:
        delivery.source_system === 'dfl_site'
          ? null
          : finite(delivery.customer_charge),
      paymentMethod: delivery.payment_method || null,
    },
  });
}

export function routeFact(route: Route): CanonicalAnalyticsFact {
  return canonicalAnalyticsFact({
    kind: 'route',
    authority: 'dfl_entregas',
    entityType: 'route',
    entityId: route.id,
    sourceSystem: 'dfl_entregas',
    sourceEventId: `analytics-route:${route.id}:${revision(
      route.updated_at,
      route.end_time,
      route.started_at,
      route.departure_time,
      route.created_at,
    )}`,
    occurredAt: iso(
      route.end_time,
      route.updated_at,
      route.started_at,
      route.departure_time,
      route.created_at,
    ),
    payload: {
      status: route.status,
      motoboyId: route.motoboy_id || null,
      motoboyName: route.motoboy_name || null,
      startedAt: route.started_at || route.departure_time || null,
      endedAt: route.end_time || null,
    },
  });
}

export function operationalExpenseFact(
  expense: OperationalExpense,
): CanonicalAnalyticsFact {
  return canonicalAnalyticsFact({
    kind: 'operational_expense',
    authority: 'dfl_entregas',
    entityType:
      expense.source_kind === 'motoboy_settlement'
        ? 'courier_settlement'
        : 'operational_expense',
    entityId:
      expense.source_kind === 'motoboy_settlement' && expense.source_id
        ? expense.source_id
        : expense.id,
    sourceSystem: 'dfl_entregas',
    sourceEventId: `analytics-expense:${expense.id}:${revision(
      expense.updated_at,
      expense.created_at,
      expense.occurred_at,
    )}`,
    occurredAt: iso(expense.occurred_at, expense.updated_at, expense.created_at),
    payload: {
      expenseId: expense.id,
      type: expense.type,
      description: expense.description,
      amount: finite(expense.amount),
      sourceKind: expense.source_kind || 'manual',
      sourceId: expense.source_id || null,
      motoboyId: expense.motoboy_id || null,
      motoboyName: expense.motoboy_name || null,
    },
  });
}

export function fuelingFact(fueling: Fueling): CanonicalAnalyticsFact {
  return canonicalAnalyticsFact({
    kind: 'fueling',
    authority: 'dfl_entregas',
    entityType: 'fueling',
    entityId: fueling.id,
    sourceSystem: 'dfl_entregas',
    sourceEventId: `analytics-fueling:${fueling.id}:${revision(
      fueling.updated_at,
      fueling.created_at,
      fueling.occurred_at,
    )}`,
    occurredAt: iso(fueling.occurred_at, fueling.updated_at, fueling.created_at),
    payload: {
      fuelType: fueling.fuel_type,
      totalAmount: finite(fueling.total_amount),
      liters: finite(fueling.liters),
      station: fueling.station || null,
      motoboyId: fueling.motoboy_id || null,
    },
  });
}

export function stockPurchaseFact(
  supply: StockSupply,
): CanonicalAnalyticsFact {
  return canonicalAnalyticsFact({
    kind: 'stock_purchase',
    authority: 'dfl_entregas',
    entityType: 'stock_purchase',
    entityId: supply.id,
    sourceSystem: 'dfl_entregas',
    sourceEventId: `analytics-stock-purchase:${supply.id}:${revision(
      supply.updated_at,
      supply.checked_at,
      supply.received_at,
      supply.created_at,
      supply.occurred_at,
    )}`,
    occurredAt: iso(
      supply.occurred_at,
      supply.received_at,
      supply.checked_at,
      supply.updated_at,
      supply.created_at,
    ),
    payload: {
      status: supply.status,
      totalAmount: finite(supply.total_amount),
      productsAmount: finite(supply.products_amount),
      transportAmount: finite(supply.transport_amount),
      otherCosts: finite(supply.other_costs),
      supplierId: supply.supplier_id || null,
      supplier: supply.supplier || null,
      purchaserId: supply.purchaser_id || null,
      purchaserName: supply.purchaser_name || null,
    },
  });
}
