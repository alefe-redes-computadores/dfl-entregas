// lib/delivery-intelligence/buildPreRouteContext.ts

import type {
  Customer,
  Delivery,
  Route,
} from '@/types';

import { isDeliveryFulfillment } from '@/lib/delivery-mode';

import type {
  OperationalMemory,
  PreRouteContext,
  PreRouteTransitionMatch,
} from './types';

function normalize(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function key(from: string, to: string): string {
  return `${normalize(from)}=>${normalize(to)}`;
}

export function buildPreRouteContext(input: {
  route: Route;
  deliveries: Delivery[];
  customers: Customer[];
  memory: OperationalMemory;
}): PreRouteContext {
  const customerMap = new Map(
    input.customers.map((customer) => [
      customer.id,
      customer,
    ]),
  );

  const routeDeliveries = input.deliveries
    .filter(isDeliveryFulfillment)
    .filter(
      (delivery) =>
        delivery.route_id === input.route.id &&
        !delivery.completed,
    )
    .sort((a, b) => {
      const ai =
        typeof a.order_index === 'number'
          ? a.order_index
          : Number.MAX_SAFE_INTEGER;

      const bi =
        typeof b.order_index === 'number'
          ? b.order_index
          : Number.MAX_SAFE_INTEGER;

      return ai - bi;
    });

  const neighborhoods = routeDeliveries
    .map((delivery) =>
      customerMap
        .get(delivery.customer_id)
        ?.neighborhood
        ?.trim(),
    )
    .filter(
      (value): value is string =>
        Boolean(value),
    );

  const distinctNeighborhoods = new Set(
    neighborhoods.map(normalize),
  ).size;

  const transitionMap = new Map(
    input.memory.routeSequences.patterns.map(
      (pattern) => [pattern.key, pattern],
    ),
  );

  const transitions: PreRouteTransitionMatch[] = [];

  for (
    let index = 1;
    index < routeDeliveries.length;
    index += 1
  ) {
    const from = routeDeliveries[index - 1];
    const to = routeDeliveries[index];

    const fromNeighborhood =
      customerMap
        .get(from.customer_id)
        ?.neighborhood
        ?.trim();

    const toNeighborhood =
      customerMap
        .get(to.customer_id)
        ?.neighborhood
        ?.trim();

    if (!fromNeighborhood || !toNeighborhood) {
      continue;
    }

    const pattern = transitionMap.get(
      key(fromNeighborhood, toNeighborhood),
    );

    transitions.push({
      fromDeliveryId: from.id,
      toDeliveryId: to.id,
      fromNeighborhood,
      toNeighborhood,
      historicalOccurrences:
        pattern?.occurrences ?? 0,
      timingSample:
        pattern?.timingSample ?? 0,
      medianCompletionIntervalMinutes:
        pattern?.medianCompletionIntervalMinutes ??
        null,
    });
  }

  const knownTransitions =
    transitions.filter(
      (item) =>
        item.historicalOccurrences > 0,
    );

  const timedTransitions =
    transitions.filter(
      (item) =>
        item.medianCompletionIntervalMinutes !=
        null,
    );

  const orderedCount = routeDeliveries.filter(
    (delivery) =>
      typeof delivery.order_index === 'number',
  ).length;

  const neighborhoodCoverage =
    routeDeliveries.length > 0
      ? neighborhoods.length /
        routeDeliveries.length
      : 0;

  return {
    routeId: input.route.id,
    routeName: input.route.name,

    deliveryCount:
      routeDeliveries.length,

    orderedDeliveryCount:
      orderedCount,

    neighborhoodCount:
      neighborhoods.length,

    distinctNeighborhoods,

    neighborhoodCoverage,

    transitions,

    knownTransitionCount:
      knownTransitions.length,

    timedTransitionCount:
      timedTransitions.length,

    historicalTransitionCoverage:
      transitions.length > 0
        ? knownTransitions.length /
          transitions.length
        : 0,

    status:
      routeDeliveries.length === 0
        ? 'empty'
        : neighborhoodCoverage < 0.7
          ? 'limited-data'
          : transitions.length === 0
            ? 'forming'
            : knownTransitions.length === 0
              ? 'forming'
              : knownTransitions.length ===
                  transitions.length
                ? 'well-known'
                : 'partial-history',
  };
}
