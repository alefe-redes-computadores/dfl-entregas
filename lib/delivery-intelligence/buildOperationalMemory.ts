// lib/delivery-intelligence/buildOperationalMemory.ts
import type { Customer, Delivery, Motoboy, Route } from '@/types';
import { isOperationalCustomer } from '@/lib/customer-analytics';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import {
  saoPauloDateKey,
  saoPauloHour,
} from '@/lib/reports/time';

import {
  deliveryOperationalTimestamp,
  routeEndTimestamp,
  routeStartTimestamp,
  trustedRouteDurationMinutes,
} from '@/lib/analytics/operational-records';
import {
  confidenceFromSample,
  median,
  percentage,
  round,
} from './statistics';

import {
  buildRouteSequenceMemory,
} from './buildRouteSequenceMemory';
import type {
  MotoboyOperationalContext,
  NeighborhoodHourPattern,
  OperationalInsight,
  OperationalMemory,
  RecurringCustomerPattern,
  RouteGapPattern,
  RouteOperationalContext,
} from './types';

function normalizeText(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function addressKey(value?: string | null): string {
  return normalizeText(value)
    .replace(/[.,;:#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function routeDepartureHour(route: Route): number | null {
  const date = routeStartTimestamp(route);
  return date ? saoPauloHour(date) : null;
}

function sizeBand(count: number): string {
  if (count <= 1) return '1 parada';
  if (count <= 3) return '2–3 paradas';
  if (count <= 5) return '4–5 paradas';
  return '6+ paradas';
}

function buildNeighborhoodHourPatterns(
  deliveries: Delivery[],
  customers: Customer[],
): NeighborhoodHourPattern[] {
  const customerMap = new Map(customers.map((item) => [item.id, item]));
  const neighborhoodTotals = new Map<string, number>();
  const buckets = new Map<
    string,
    { neighborhood: string; hour: number; deliveries: number }
  >();

  deliveries
    .filter(isDeliveryFulfillment)
    .forEach((delivery) => {
      const date = deliveryOperationalTimestamp(delivery);
      const neighborhood =
        customerMap.get(delivery.customer_id)?.neighborhood?.trim();

      if (!date || !neighborhood) return;

      const neighborhoodKey = normalizeText(neighborhood);
      if (!neighborhoodKey) return;

      neighborhoodTotals.set(
        neighborhoodKey,
        (neighborhoodTotals.get(neighborhoodKey) || 0) + 1,
      );

      const hour = saoPauloHour(date);
      const key = `${neighborhoodKey}::${hour}`;
      const current = buckets.get(key) ?? {
        neighborhood,
        hour,
        deliveries: 0,
      };
      current.deliveries += 1;
      buckets.set(key, current);
    });

  return [...buckets.entries()]
    .map(([key, item]) => {
      const neighborhoodKey = key.split('::')[0];
      const neighborhoodSample = neighborhoodTotals.get(neighborhoodKey) || 0;

      return {
        ...item,
        neighborhoodSample,
        shareWithinNeighborhood: percentage(
          item.deliveries,
          neighborhoodSample,
        ),
      };
    })
    .sort((a, b) => {
      if (b.deliveries !== a.deliveries) return b.deliveries - a.deliveries;
      return b.shareWithinNeighborhood - a.shareWithinNeighborhood;
    })
    .slice(0, 12);
}

function buildRecurringCustomerPatterns(
  deliveries: Delivery[],
  customers: Customer[],
  minimumSample: number,
): RecurringCustomerPattern[] {
  const customerMap = new Map(customers.map((item) => [item.id, item]));
  const excludedCustomerIds = new Set(
    customers
      .filter(isOperationalCustomer)
      .map((customer) => customer.id),
  );
  const buckets = new Map<
    string,
    {
      deliveries: number;
      addresses: Map<string, { label: string; count: number }>;
      orderTimes: number[];
    }
  >();

  deliveries
    .filter(isDeliveryFulfillment)
    .forEach((delivery) => {
      if (!delivery.customer_id) return;
      if (excludedCustomerIds.has(delivery.customer_id)) return;

      const current = buckets.get(delivery.customer_id) ?? {
        deliveries: 0,
        addresses: new Map<string, { label: string; count: number }>(),
        orderTimes: [],
      };

      current.deliveries += 1;

      const orderDate =
        deliveryOperationalTimestamp(delivery);

      if (orderDate) {
        current.orderTimes.push(orderDate.getTime());
      }

      const rawAddress = delivery.address_string?.trim();
      const key = addressKey(rawAddress);
      if (key) {
        const address = current.addresses.get(key) ?? {
          label: rawAddress,
          count: 0,
        };
        address.count += 1;
        current.addresses.set(key, address);
      }

      buckets.set(delivery.customer_id, current);
    });

  return [...buckets.entries()]
    .filter(([, item]) => item.deliveries >= minimumSample)
    .map(([customerId, item]) => {
      const customer = customerMap.get(customerId);
      const addresses = [...item.addresses.values()].sort(
        (a, b) => b.count - a.count,
      );
      const dominant = addresses[0];

      const orderedTimes = [...item.orderTimes].sort(
        (a, b) => a - b,
      );

      const intervalsDays = orderedTimes
        .slice(1)
        .map((value, index) =>
          (value - orderedTimes[index]) / 86400000,
        )
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value >= 0,
        );

      const lastTimestamp =
        orderedTimes[orderedTimes.length - 1];

      return {
        customerId,
        customerName:
          customer?.name?.trim() ||
          'Cliente sem nome',
        deliveries: item.deliveries,
        distinctAddresses: addresses.length,
        dominantAddress: dominant?.label || null,
        dominantAddressCount: dominant?.count || 0,
        addressConsistency: dominant
          ? percentage(
              dominant.count,
              item.deliveries,
            )
          : 0,
        hasStructuredNeighborhood: Boolean(
          customer?.neighborhood?.trim(),
        ),
        hasMapsLink: Boolean(
          customer?.maps_link?.trim(),
        ),

        lastOrderDateKey:
          lastTimestamp != null
            ? saoPauloDateKey(
                new Date(lastTimestamp),
              )
            : null,

        medianIntervalDays:
          intervalsDays.length > 0
            ? median(intervalsDays)
            : null,
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);
}

function buildRouteContexts(
  routes: Route[],
  deliveries: Delivery[],
): RouteOperationalContext[] {
  const deliveryCounts = new Map<string, number>();

  deliveries
    .filter(isDeliveryFulfillment)
    .forEach((delivery) => {
      if (!delivery.route_id) return;
      deliveryCounts.set(
        delivery.route_id,
        (deliveryCounts.get(delivery.route_id) || 0) + 1,
      );
    });

  const base = routes
    .map((route) => {
      const durationMinutes = trustedRouteDurationMinutes(route);
      if (durationMinutes == null) return null;

      const deliveryCount = deliveryCounts.get(route.id) || 0;
      if (deliveryCount <= 0) return null;

      return {
        route,
        durationMinutes,
        deliveryCount,
        sizeBand: sizeBand(deliveryCount),
        departureHour: routeDepartureHour(route),
      };
    })
    .filter(
      (
        item,
      ): item is {
        route: Route;
        durationMinutes: number;
        deliveryCount: number;
        sizeBand: string;
        departureHour: number | null;
      } => Boolean(item),
    );

  const byBand = new Map<string, number[]>();
  base.forEach((item) => {
    const values = byBand.get(item.sizeBand) ?? [];
    values.push(item.durationMinutes);
    byBand.set(item.sizeBand, values);
  });

  return base
    .map((item) => {
      const comparison = byBand.get(item.sizeBand) ?? [];
      const baselineMinutes =
        comparison.length >= 5 ? median(comparison) : null;
      const thresholdMinutes =
        baselineMinutes == null
          ? null
          : Math.max(baselineMinutes * 1.5, baselineMinutes + 15);
      const contextStatus: RouteOperationalContext['contextStatus'] =
        thresholdMinutes == null
          ? 'insufficient'
          : item.durationMinutes > thresholdMinutes
            ? 'above'
            : 'within';

      return {
        routeId: item.route.id,
        routeName: item.route.name,
        motoboyId: item.route.motoboy_id || null,
        motoboyName: item.route.motoboy_name || 'Entregador não informado',
        durationMinutes: item.durationMinutes,
        deliveryCount: item.deliveryCount,
        sizeBand: item.sizeBand,
        departureHour: item.departureHour,
        comparisonSample: comparison.length,
        baselineMinutes,
        thresholdMinutes,
        deviationRatio:
          baselineMinutes && baselineMinutes > 0
            ? item.durationMinutes / baselineMinutes
            : null,
        contextStatus,
      };
    })
    .sort((a, b) => b.durationMinutes - a.durationMinutes);
}

function buildMotoboyContexts(
  routeContexts: RouteOperationalContext[],
  motoboys: Motoboy[],
): MotoboyOperationalContext[] {
  const motoboyById = new Map(motoboys.map((item) => [item.id, item]));
  const motoboyByName = new Map<string, Motoboy | null>();

  motoboys.forEach((motoboy) => {
    const key = normalizeText(motoboy.name);
    if (!key) return;

    if (motoboyByName.has(key)) {
      motoboyByName.set(key, null);
      return;
    }

    motoboyByName.set(key, motoboy);
  });

  const buckets = new Map<
    string,
    {
      motoboyId: string | null;
      motoboyName: string;
      durations: number[];
      deliveries: number;
    }
  >();

  routeContexts.forEach((route) => {
    const id = route.motoboyId;
    const routeName = route.motoboyName?.trim() || '';
    const canonical =
      (id ? motoboyById.get(id) : null) ||
      (routeName ? motoboyByName.get(normalizeText(routeName)) : null);
    const resolvedId = canonical?.id || id || null;
    const name =
      canonical?.name?.trim() ||
      routeName ||
      'Entregador não informado';
    const key = resolvedId
      ? `id:${resolvedId}`
      : `name:${normalizeText(name)}`;

    const current = buckets.get(key) ?? {
      motoboyId: resolvedId,
      motoboyName: name,
      durations: [],
      deliveries: 0,
    };

    current.durations.push(route.durationMinutes);
    current.deliveries += route.deliveryCount;
    buckets.set(key, current);
  });

  return [...buckets.values()]
    .map((item) => ({
      motoboyId: item.motoboyId,
      motoboyName: item.motoboyName,
      routeCount: item.durations.length,
      deliveryCount: item.deliveries,
      medianRouteDurationMinutes: median(item.durations),
      averageDeliveriesPerRoute:
        item.durations.length > 0
          ? Number(
              (
                item.deliveries /
                item.durations.length
              ).toFixed(2),
            )
          : 0,
    }))
    .sort((a, b) => b.routeCount - a.routeCount);
}

function buildRouteGapPatterns(
  routes: Route[],
  motoboys: Motoboy[],
): RouteGapPattern[] {
  const motoboyById = new Map(
    motoboys.map((item) => [item.id, item]),
  );

  const normalizedNameToMotoboy =
    new Map<string, Motoboy | null>();

  motoboys.forEach((motoboy) => {
    const key = normalizeText(motoboy.name);
    if (!key) return;

    if (normalizedNameToMotoboy.has(key)) {
      normalizedNameToMotoboy.set(key, null);
    } else {
      normalizedNameToMotoboy.set(
        key,
        motoboy,
      );
    }
  });

  const resolved = routes
    .map((route) => {
      const start = routeStartTimestamp(route);
      const end = routeEndTimestamp(route);

      if (!start || !end) return null;

      const byId =
        route.motoboy_id
          ? motoboyById.get(route.motoboy_id)
          : undefined;

      const byName =
        route.motoboy_name
          ? normalizedNameToMotoboy.get(
              normalizeText(route.motoboy_name),
            )
          : undefined;

      const canonical = byId || byName || null;

      const motoboyId =
        canonical?.id ||
        route.motoboy_id ||
        null;

      const motoboyName =
        canonical?.name?.trim() ||
        route.motoboy_name?.trim() ||
        'Entregador não informado';

      const key = motoboyId
        ? `id:${motoboyId}`
        : `name:${normalizeText(motoboyName)}`;

      return {
        key,
        motoboyId,
        motoboyName,
        start,
        end,
        dateKey: saoPauloDateKey(start),
      };
    })
    .filter(
      (
        item,
      ): item is {
        key: string;
        motoboyId: string | null;
        motoboyName: string;
        start: Date;
        end: Date;
        dateKey: string;
      } => Boolean(item),
    );

  const groups = new Map<
    string,
    {
      motoboyId: string | null;
      motoboyName: string;
      routes: typeof resolved;
    }
  >();

  resolved.forEach((item) => {
    const group =
      groups.get(item.key) ?? {
        motoboyId: item.motoboyId,
        motoboyName: item.motoboyName,
        routes: [],
      };

    group.routes.push(item);
    groups.set(item.key, group);
  });

  const result: RouteGapPattern[] = [];

  groups.forEach((group) => {
    const byDay = new Map<
      string,
      typeof resolved
    >();

    group.routes.forEach((route) => {
      const current =
        byDay.get(route.dateKey) ?? [];

      current.push(route);
      byDay.set(route.dateKey, current);
    });

    const gaps: number[] = [];

    byDay.forEach((dayRoutes) => {
      const ordered = [...dayRoutes].sort(
        (a, b) =>
          a.start.getTime() -
          b.start.getTime(),
      );

      for (
        let index = 1;
        index < ordered.length;
        index += 1
      ) {
        const previous = ordered[index - 1];
        const current = ordered[index];

        const minutes =
          (
            current.start.getTime() -
            previous.end.getTime()
          ) /
          60000;

        /*
         * Negativos = rotas sobrepostas/dado temporal inconsistente.
         * Acima de 8h deixa de representar intervalo operacional
         * útil entre rotas do mesmo turno.
         */
        if (
          Number.isFinite(minutes) &&
          minutes >= 0 &&
          minutes <= 480
        ) {
          gaps.push(minutes);
        }
      }
    });

    if (!gaps.length) return;

    result.push({
      motoboyId: group.motoboyId,
      motoboyName: group.motoboyName,
      sampleSize: gaps.length,
      medianGapMinutes:
        median(gaps) || 0,
      shortestGapMinutes:
        Math.min(...gaps),
      longestGapMinutes:
        Math.max(...gaps),
    });
  });

  return result.sort(
    (a, b) =>
      b.sampleSize - a.sampleSize,
  );
}

export function buildOperationalMemory(input: {
  deliveries: Delivery[];
  routes: Route[];
  customers: Customer[];
  motoboys: Motoboy[];
  minimumSample: number;
}): OperationalMemory {
  const neighborhoodHourPatterns = buildNeighborhoodHourPatterns(
    input.deliveries,
    input.customers,
  );

  const recurringCustomers = buildRecurringCustomerPatterns(
    input.deliveries,
    input.customers,
    input.minimumSample,
  );

  const routeContexts = buildRouteContexts(
    input.routes,
    input.deliveries,
  );

  const motoboyContexts = buildMotoboyContexts(
    routeContexts,
    input.motoboys,
  );

  const routeGaps = buildRouteGapPatterns(
    input.routes,
    input.motoboys,
  );

  const routeSequences =
    buildRouteSequenceMemory({
      deliveries: input.deliveries,
      routes: input.routes,
      customers: input.customers,
    });

  return {
    neighborhoodHourPatterns,
    recurringCustomers,
    routeContexts,
    motoboyContexts,
    routeGaps,
    routeSequences,
  };
}

export function buildOperationalMemoryInsights(
  memory: OperationalMemory,
  minimumSample: number,
): OperationalInsight[] {
  const insights: OperationalInsight[] = [];

  const neighborhoodPattern = memory.neighborhoodHourPatterns.find(
    (item) =>
      item.deliveries >= minimumSample &&
      item.neighborhoodSample >= minimumSample * 2 &&
      item.shareWithinNeighborhood >= 35,
  );

  if (neighborhoodPattern) {
    insights.push({
      id: `memory-neighborhood-hour-${normalizeText(neighborhoodPattern.neighborhood)}-${neighborhoodPattern.hour}`,
      category: 'geography',
      severity: 'info',
      confidence: confidenceFromSample(
        neighborhoodPattern.neighborhoodSample,
        minimumSample,
      ),
      title: `${neighborhoodPattern.neighborhood} concentra pedidos perto de ${String(neighborhoodPattern.hour).padStart(2, '0')}h`,
      summary: `${neighborhoodPattern.deliveries} de ${neighborhoodPattern.neighborhoodSample} entregas desse bairro entraram nessa hora.`,
      explanation:
        'O padrão combina bairro estruturado com horário real de criação do pedido. Ele ajuda a antecipar agrupamentos, mas não mede trânsito, distância ou dificuldade do bairro.',
      sampleSize: neighborhoodPattern.neighborhoodSample,
      evidence: [
        {
          label: 'Entregas no bairro',
          value: String(neighborhoodPattern.neighborhoodSample),
        },
        {
          label: `${String(neighborhoodPattern.hour).padStart(2, '0')}h`,
          value: String(neighborhoodPattern.deliveries),
        },
        {
          label: 'Concentração na hora',
          value: `${round(neighborhoodPattern.shareWithinNeighborhood)}%`,
        },
      ],
    });
  }

  const recurring = memory.recurringCustomers.find(
    (item) => item.deliveries >= minimumSample,
  );

  if (recurring) {
    const stableAddress =
      recurring.dominantAddress &&
      recurring.addressConsistency >= 70;

    insights.push({
      id: `memory-recurring-customer-${recurring.customerId}`,
      category: 'geography',
      severity:
        recurring.hasStructuredNeighborhood && recurring.hasMapsLink
          ? 'positive'
          : 'info',
      confidence: confidenceFromSample(recurring.deliveries, minimumSample),
      title: stableAddress
        ? `${recurring.customerName} já tem padrão recorrente de endereço`
        : `${recurring.customerName} aparece com frequência na operação`,
      summary: stableAddress
        ? `${round(recurring.addressConsistency)}% das entregas registradas para esse cliente usam o mesmo endereço textual.`
        : `${recurring.deliveries} entregas formam uma amostra útil, com ${recurring.distinctAddresses} endereço${recurring.distinctAddresses === 1 ? '' : 's'} registrado${recurring.distinctAddresses === 1 ? '' : 's'}.`,
      explanation:
        'Isto é memória operacional baseada no histórico de pedidos. Endereço textual igual não prova coordenada igual; por isso o Maps e o bairro estruturado continuam sendo dados importantes.',
      sampleSize: recurring.deliveries,
      entityIds: [recurring.customerId],
      evidence: [
        {
          label: 'Entregas',
          value: String(recurring.deliveries),
        },
        {
          label: 'Intervalo mediano',
          value:
            recurring.medianIntervalDays == null
              ? 'Amostra insuficiente'
              : `${round(
                  recurring.medianIntervalDays,
                  1,
                )} dias`,
        },
        {
          label: 'Último pedido',
          value:
            recurring.lastOrderDateKey ||
            'Sem data confiável',
        },
        {
          label: 'Endereços distintos',
          value: String(
            recurring.distinctAddresses,
          ),
        },
        {
          label: 'Bairro estruturado',
          value: recurring.hasStructuredNeighborhood ? 'Sim' : 'Não',
        },
        {
          label: 'Maps salvo',
          value: recurring.hasMapsLink ? 'Sim' : 'Não',
        },
      ],
    });
  }

  const contextualAnomalies = memory.routeContexts
    .filter((route) => route.contextStatus === 'above')
    .sort((a, b) => {
      const aRatio = a.deviationRatio ?? 0;
      const bRatio = b.deviationRatio ?? 0;
      return bRatio - aRatio;
    });

  if (contextualAnomalies.length > 0) {
    const worst = contextualAnomalies[0];

    insights.push({
      id: 'memory-routes-contextual-duration',
      category: 'routes',
      severity: 'attention',
      confidence: confidenceFromSample(
        worst.comparisonSample,
        minimumSample,
      ),
      title: 'Há rota fora do padrão de rotas de tamanho parecido',
      summary:
        contextualAnomalies.length === 1
          ? '1 rota ficou bem acima da mediana do próprio grupo de paradas.'
          : `${contextualAnomalies.length} rotas ficaram bem acima da mediana do próprio grupo de paradas.`,
      explanation:
        'A comparação usa somente rotas confiáveis com quantidade de paradas semelhante. Ainda assim, o sinal não atribui causa ao entregador: trânsito, espera no cliente, distância e composição da rota podem explicar a diferença.',
      sampleSize: worst.comparisonSample,
      entityIds: contextualAnomalies.map(
        (item) => item.routeId,
      ),
      comparison:
        worst.baselineMinutes == null
          ? undefined
          : {
              label:
                `Mediana de ${worst.sizeBand}`,
              baseline: worst.baselineMinutes,
              observed: worst.durationMinutes,
              unit: 'min',
            },
      evidence: [
        { label: 'Grupo comparável', value: worst.sizeBand },
        {
          label: 'Rotas no grupo',
          value: String(worst.comparisonSample),
        },
        {
          label: 'Mediana do grupo',
          value: `${round(worst.baselineMinutes || 0)} min`,
        },
        {
          label: 'Maior duração',
          value: `${round(worst.durationMinutes)} min`,
        },
      ],
    });
  }

  const readyMotoboys = memory.motoboyContexts.filter(
    (item) => item.routeCount >= minimumSample,
  );

  if (readyMotoboys.length > 0) {
    const routesWithContext = readyMotoboys.reduce(
      (sum, item) => sum + item.routeCount,
      0,
    );

    insights.push({
      id: 'memory-motoboy-context-ready',
      category: 'routes',
      severity: 'positive',
      confidence: confidenceFromSample(routesWithContext, minimumSample),
      title: 'Histórico por entregador já tem amostra contextual',
      summary: `${readyMotoboys.length} entregador${readyMotoboys.length === 1 ? '' : 'es'} já possui${readyMotoboys.length === 1 ? '' : 'em'} rotas confiáveis suficientes para leitura individual contextual.`,
      explanation:
        'Essa memória não cria ranking. Ela permite comparar cada entregador com o próprio histórico em evoluções futuras, respeitando quantidade de rotas, paradas e contexto.',
      sampleSize: routesWithContext,
      evidence: [
        {
          label: 'Entregadores com amostra',
          value: String(readyMotoboys.length),
        },
        {
          label: 'Rotas confiáveis',
          value: String(routesWithContext),
        },
        {
          label: 'Uso',
          value: 'Contexto, não ranking',
        },
      ],
    });
  }

  return insights;
}
