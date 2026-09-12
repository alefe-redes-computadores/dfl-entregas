// lib/delivery-intelligence/buildOperationalIntelligence.ts
import type { Customer, Delivery, Route, StockSupply } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import {
  compareDateKeys,
  saoPauloDateKey,
  saoPauloHour,
  shiftDateKey,
} from '@/lib/reports/time';

import {
  deliveryOperationalTimestamp,
  inclusiveDateKeyDays,
  routeOperationalTimestamp,
  stockSupplyOperationalTimestamp,
  timestampInDateKeyWindow,
  trustedRouteDurationMinutes,
} from '@/lib/analytics/operational-records';
import {
  confidenceFromSample,
  median,
  percentage,
  round,
} from './statistics';
import {
  buildOperationalMemory,
  buildOperationalMemoryInsights,
} from './buildOperationalMemory';

import {
  buildRouteSequenceInsights,
} from './buildRouteSequenceMemory';
import type {
  IntelligenceWindow,
  OperationalInsight,
  OperationalIntelligenceInput,
  OperationalIntelligenceSnapshot,
} from './types';


function qualityInsights(input: {
  deliveries: Delivery[];
  undatedDeliveries: Delivery[];
  customers: Customer[];
  minimumSample: number;
}): OperationalInsight[] {
  const logistics = input.deliveries.filter(isDeliveryFulfillment);
  const undatedLogistics = input.undatedDeliveries.filter(isDeliveryFulfillment);
  const customerMap = new Map(input.customers.map((item) => [item.id, item]));
  const insights: OperationalInsight[] = [];

  if (undatedLogistics.length > 0) {
    insights.push({
      id: 'quality-undated-unscoped',
      category: 'data-quality',
      severity: 'attention',
      confidence: confidenceFromSample(
        undatedLogistics.length,
        input.minimumSample,
      ),
      title: 'Existem entregas sem data fora da janela temporal',
      summary: `${undatedLogistics.length} entrega${undatedLogistics.length === 1 ? '' : 's'} não pode${undatedLogistics.length === 1 ? '' : 'm'} ser posicionada${undatedLogistics.length === 1 ? '' : 's'} honestamente no período.`,
      explanation:
        'O cérebro não inventa uma data para encaixar esses registros. Eles ficam catalogados como qualidade global e são excluídos apenas das análises que dependem de tempo.',
      sampleSize: undatedLogistics.length,
      evidence: [
        { label: 'Sem data confiável', value: String(undatedLogistics.length) },
        { label: 'Tratamento', value: 'Fora de análises temporais' },
      ],
    });
  }

  if (!logistics.length) return insights;

  const missingRoute = logistics.filter((item) => !item.route_id).length;
  const missingNeighborhood = logistics.filter((item) => {
    const customer = customerMap.get(item.customer_id);
    return !customer?.neighborhood?.trim();
  }).length;

  const problems = missingRoute + missingNeighborhood;
  const possibleChecks = logistics.length * 2;
  const completeness = 100 - percentage(problems, possibleChecks);

  const evidence = [
    { label: 'Entregas na janela', value: String(logistics.length) },
    { label: 'Sem rota', value: String(missingRoute) },
    { label: 'Sem bairro estruturado', value: String(missingNeighborhood) },
  ];

  if (completeness >= 90 && logistics.length >= input.minimumSample) {
    insights.push({
      id: 'quality-good-coverage',
      category: 'data-quality',
      severity: 'positive',
      confidence: confidenceFromSample(logistics.length, input.minimumSample),
      title: 'Boa cobertura operacional na janela',
      summary: `${round(completeness, 0)}% dos campos logísticos avaliados estão preenchidos.`,
      explanation:
        'A cobertura desta janela considera rota e bairro estruturado. A presença de data é tratada separadamente, porque registros sem data não podem ser atribuídos honestamente ao período.',
      sampleSize: logistics.length,
      evidence,
    });
  } else if (completeness < 75) {
    insights.push({
      id: 'quality-needs-attention',
      category: 'data-quality',
      severity: completeness < 55 ? 'warning' : 'attention',
      confidence: confidenceFromSample(logistics.length, input.minimumSample),
      title: 'Cobertura logística limita parte das análises',
      summary: `${round(completeness, 0)}% dos campos logísticos avaliados estão preenchidos.`,
      explanation:
        'O cérebro não preenche rota ou bairro por suposição. Os registros continuam preservados, mas algumas análises deixam de usá-los.',
      sampleSize: logistics.length,
      evidence,
    });
  }

  return insights;
}

function demandInsights(
  deliveries: Delivery[],
  minimumSample: number,
): OperationalInsight[] {
  const dated = deliveries
    .map((delivery) => ({
      delivery,
      date: deliveryOperationalTimestamp(delivery),
    }))
    .filter(
      (item): item is { delivery: Delivery; date: Date } => Boolean(item.date),
    );

  if (dated.length < minimumSample) return [];

  const hours = Array.from({ length: 24 }, () => 0);
  dated.forEach(({ date }) => {
    hours[saoPauloHour(date)] += 1;
  });

  const active = hours
    .map((count, hour) => ({ hour, count }))
    .filter((item) => item.count > 0);

  if (!active.length) return [];

  const top = [...active].sort((a, b) => b.count - a.count)[0];
  const averageActiveHour =
    active.reduce((sum, item) => sum + item.count, 0) / active.length;
  const share = percentage(top.count, dated.length);

  if (
    top.count < minimumSample ||
    (top.count < averageActiveHour * 1.25 && share < 20)
  ) {
    return [];
  }

  return [{
    id: `demand-peak-hour-${top.hour}`,
    category: 'demand',
    severity: 'info',
    confidence: confidenceFromSample(top.count, minimumSample),
    title: `Pico de entrada perto de ${String(top.hour).padStart(2, '0')}h`,
    summary: `${top.count} pedidos (${round(share)}% da amostra com data) entraram nessa hora.`,
    explanation:
      'Isto mede horário de criação do pedido, não horário de saída da rota. Serve para antecipar preparação e capacidade, não para julgar desempenho individual.',
    sampleSize: dated.length,
    evidence: [
      { label: 'Pedidos com data', value: String(dated.length) },
      { label: 'Pedidos na hora de pico', value: String(top.count) },
      { label: 'Participação', value: `${round(share)}%` },
    ],
  }];
}

function geographyInsights(input: {
  deliveries: Delivery[];
  customers: Customer[];
  minimumSample: number;
}): OperationalInsight[] {
  const customerMap = new Map(input.customers.map((item) => [item.id, item]));
  const withNeighborhood = input.deliveries
    .filter(isDeliveryFulfillment)
    .map((delivery) => ({
      delivery,
      neighborhood: customerMap.get(delivery.customer_id)?.neighborhood?.trim(),
    }))
    .filter(
      (item): item is { delivery: Delivery; neighborhood: string } =>
        Boolean(item.neighborhood),
    );

  if (withNeighborhood.length < input.minimumSample) return [];

  const buckets = new Map<string, { label: string; count: number }>();
  withNeighborhood.forEach(({ neighborhood }) => {
    const key = neighborhood.toLocaleLowerCase('pt-BR');
    const current = buckets.get(key) ?? { label: neighborhood, count: 0 };
    current.count += 1;
    buckets.set(key, current);
  });

  const top = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const share = percentage(top.count, withNeighborhood.length);

  if (top.count < input.minimumSample || share < 25) return [];

  return [{
    id: `geography-concentration-${top.label.toLocaleLowerCase('pt-BR')}`,
    category: 'geography',
    severity: 'info',
    confidence: confidenceFromSample(top.count, input.minimumSample),
    title: `Concentração de entregas em ${top.label}`,
    summary: `${round(share)}% das entregas com bairro estruturado foram para esse bairro.`,
    explanation:
      'É concentração de volume, não dificuldade de entrega. Pode ajudar no agrupamento de rotas quando combinado com horário e endereço.',
    sampleSize: withNeighborhood.length,
    evidence: [
      { label: 'Entregas com bairro', value: String(withNeighborhood.length) },
      { label: top.label, value: String(top.count) },
      { label: 'Participação', value: `${round(share)}%` },
    ],
  }];
}

function routeInsights(
  routes: Route[],
  minimumSample: number,
): OperationalInsight[] {
  const valid = routes
    .filter((route) => route.status === 'fechada' && (routeOperationalTimestamp(route)?.getTime() || 0) >= new Date('2026-09-09T00:00:00-03:00').getTime())
    .map((route) => {
      const duration =
        trustedRouteDurationMinutes(route);

      if (duration == null) {
        return null;
      }

      return { route, duration };
    })
    .filter(
      (item): item is { route: Route; duration: number } => Boolean(item),
    );

  if (valid.length < Math.max(minimumSample, 5)) return [];

  const baseline = median(valid.map((item) => item.duration));
  if (baseline == null) return [];

  const threshold = Math.max(baseline * 1.6, baseline + 20);
  const anomalous = valid
    .filter((item) => item.duration > threshold)
    .sort((a, b) => b.duration - a.duration);

  if (!anomalous.length) return [];

  const worst = anomalous[0];

  return [{
    id: 'routes-duration-above-baseline',
    category: 'routes',
    severity: 'attention',
    confidence: confidenceFromSample(valid.length, minimumSample),
    title: 'Há rota bem acima da duração típica',
    summary: `${anomalous.length} rota${anomalous.length === 1 ? '' : 's'} ficou${anomalous.length === 1 ? '' : 'ram'} acima do limite contextual da amostra.`,
    explanation:
      'O limite usa a mediana das rotas confiáveis e uma margem conservadora. Isso sinaliza contexto para investigar — trânsito, espera, distância ou cadastro — e não culpa o motoboy.',
    sampleSize: valid.length,
    entityIds: anomalous.map(
      (item) => item.route.id,
    ),
    comparison: {
      label: 'Mediana das rotas confiáveis',
      baseline,
      observed: worst.duration,
      unit: 'min',
    },
    evidence: [
      { label: 'Rotas confiáveis', value: String(valid.length) },
      { label: 'Mediana', value: `${round(baseline)} min` },
      { label: 'Limite contextual', value: `${round(threshold)} min` },
      { label: 'Maior duração', value: `${round(worst.duration)} min` },
    ],
  }];
}

function stockInsights(
  supplies: StockSupply[],
  minimumSample: number,
): OperationalInsight[] {
  if (supplies.length < minimumSample) return [];

  const withPurchaser = supplies.filter((item) => Boolean(item.purchaser_name)).length;
  const withSupplier = supplies.filter((item) => Boolean(item.supplier?.trim())).length;
  const checked = supplies.filter((item) => item.status === 'conferido').length;

  const purchaserCoverage = percentage(withPurchaser, supplies.length);
  const supplierCoverage = percentage(withSupplier, supplies.length);
  const checkedCoverage = percentage(checked, supplies.length);

  const weak = [
    { label: 'Comprador', value: purchaserCoverage },
    { label: 'Fornecedor', value: supplierCoverage },
    { label: 'Conferência', value: checkedCoverage },
  ].filter((item) => item.value < 70);

  if (!weak.length) {
    return [{
      id: 'stock-good-coverage',
      category: 'stock',
      severity: 'positive',
      confidence: confidenceFromSample(supplies.length, minimumSample),
      title: 'Reposições com boa cobertura',
      summary: 'Responsável, fornecedor e conferência já têm cobertura útil.',
      explanation: 'Os dados permitem acompanhar quem trouxe, onde comprou e se a entrada foi conferida.',
      sampleSize: supplies.length,
      evidence: [
        { label: 'Registros', value: String(supplies.length) },
        { label: 'Com comprador', value: `${round(purchaserCoverage, 0)}%` },
        { label: 'Com fornecedor', value: `${round(supplierCoverage, 0)}%` },
        { label: 'Conferidos', value: `${round(checkedCoverage, 0)}%` },
      ],
    }];
  }

  return [{
    id: 'stock-coverage-limited',
    category: 'stock',
    severity: weak.length >= 2 ? 'attention' : 'info',
    confidence: confidenceFromSample(supplies.length, minimumSample),
    title: 'Reposições ainda têm lacunas para inteligência',
    summary: `${weak.map((item) => item.label.toLocaleLowerCase('pt-BR')).join(', ')} precisam de mais cobertura.`,
    explanation:
      'Os custos registrados continuam válidos. A limitação afeta apenas análises que dependem desses campos.',
    sampleSize: supplies.length,
    evidence: [
      { label: 'Registros', value: String(supplies.length) },
      { label: 'Com comprador', value: `${round(purchaserCoverage, 0)}%` },
      { label: 'Com fornecedor', value: `${round(supplierCoverage, 0)}%` },
      { label: 'Conferidos', value: `${round(checkedCoverage, 0)}%` },
    ],
  }];
}

export function buildOperationalIntelligence(
  input: OperationalIntelligenceInput,
): OperationalIntelligenceSnapshot {
  const now = input.now ?? new Date();
  const defaultLookbackDays = Math.min(
    Math.max(input.lookbackDays ?? 30, 1),
    365,
  );
  const minimumSample = Math.max(input.minimumSample ?? 3, 2);
  const includeUndatedQuality = input.includeUndatedQuality ?? true;

  const defaultEndKey = saoPauloDateKey(now);
  const defaultStartKey = shiftDateKey(
    defaultEndKey,
    -(defaultLookbackDays - 1),
  );

  const requestedWindow = input.window;

  let mode: IntelligenceWindow['mode'] = 'lookback';
  let startKey = defaultStartKey;
  let endKey = defaultEndKey;
  let lookbackDays = defaultLookbackDays;

  if (requestedWindow?.mode === 'bounded') {
    mode = 'bounded';
    startKey = requestedWindow.startKey;
    endKey = requestedWindow.endKey;
    lookbackDays = inclusiveDateKeyDays(startKey, endKey);
  }

  const undatedDeliveries = input.deliveries.filter(
    (item) => !deliveryOperationalTimestamp(item),
  );

  let deliveries: Delivery[];
  let routes: Route[];
  let stockSupplies: StockSupply[];

  if (requestedWindow?.mode === 'all') {
    mode = 'all';

    deliveries = input.deliveries.filter((item) =>
      Boolean(deliveryOperationalTimestamp(item)),
    );
    routes = input.routes.filter((item) => Boolean(routeOperationalTimestamp(item)));
    stockSupplies = input.stockSupplies.filter((item) => Boolean(stockSupplyOperationalTimestamp(item)));

    const observedKeys = [
      ...deliveries
        .map(deliveryOperationalTimestamp)
        .filter((item): item is Date => Boolean(item))
        .map(saoPauloDateKey),
      ...routes
        .map(routeOperationalTimestamp)
        .filter((item): item is Date => Boolean(item))
        .map(saoPauloDateKey),
      ...stockSupplies
        .map(stockSupplyOperationalTimestamp)
        .filter((item): item is Date => Boolean(item))
        .map(saoPauloDateKey),
    ].sort(compareDateKeys);

    startKey = observedKeys[0] ?? defaultEndKey;
    endKey = observedKeys[observedKeys.length - 1] ?? defaultEndKey;
    lookbackDays = inclusiveDateKeyDays(startKey, endKey);
  } else {
    deliveries = input.deliveries.filter((item) =>
      timestampInDateKeyWindow(deliveryOperationalTimestamp(item), startKey, endKey),
    );
    routes = input.routes.filter((item) =>
      timestampInDateKeyWindow(routeOperationalTimestamp(item), startKey, endKey),
    );
    stockSupplies = input.stockSupplies.filter((item) =>
      timestampInDateKeyWindow(stockSupplyOperationalTimestamp(item), startKey, endKey),
    );
  }

  const customerMap = new Map<string, Customer>(
    input.customers.map((item) => [item.id, item]),
  );

  const logistics = deliveries.filter(isDeliveryFulfillment);
  const datedDeliveries = deliveries.filter((item) =>
    Boolean(deliveryOperationalTimestamp(item)),
  ).length;
  const structuredNeighborhoods = logistics.filter((item) =>
    Boolean(customerMap.get(item.customer_id)?.neighborhood?.trim()),
  ).length;
  const routedDeliveries = logistics.filter((item) =>
    Boolean(item.route_id),
  ).length;

  // A nova régua operacional começa nesta implantação. Rotas históricas continuam
  // nos relatórios, mas não geram alertas de duração na inteligência nova.
  const intelligenceRoutes = routes.filter((route) =>
    (routeOperationalTimestamp(route)?.getTime() || 0) >= new Date('2026-09-09T00:00:00-03:00').getTime(),
  );
  const memory = buildOperationalMemory({
    deliveries,
    routes: intelligenceRoutes,
    customers: input.customers,
    motoboys: input.motoboys,
    minimumSample,
  });
  const memoryInsights = buildOperationalMemoryInsights(
    memory,
    minimumSample,
  );

  const sequenceInsights =
    buildRouteSequenceInsights(
      memory.routeSequences,
      minimumSample,
    );
  const hasContextualRouteAnomaly = memoryInsights.some(
    (item) => item.id === 'memory-routes-contextual-duration',
  );

  const insights = [
    ...qualityInsights({
      deliveries,
      undatedDeliveries: includeUndatedQuality ? undatedDeliveries : [],
      customers: input.customers,
      minimumSample,
    }),
    ...demandInsights(deliveries, minimumSample),
    ...geographyInsights({
      deliveries,
      customers: input.customers,
      minimumSample,
    }),
    ...memoryInsights,
    ...sequenceInsights,
    ...(hasContextualRouteAnomaly
      ? []
      : routeInsights(intelligenceRoutes, minimumSample)),
    ...stockInsights(stockSupplies, minimumSample),
  ];

  const severityOrder = {
    warning: 0,
    attention: 1,
    positive: 2,
    info: 3,
  } as const;

  const scopedInsights = insights.map(
    (insight) => ({
      ...insight,
      period: {
        startKey,
        endKey,
        label:
          mode === 'all'
            ? 'Todo período observado'
            : `${startKey} a ${endKey}`,
      },
    }),
  );

  scopedInsights.sort((a, b) => {
    const severity =
      severityOrder[a.severity] -
      severityOrder[b.severity];

    if (severity !== 0) return severity;

    return b.sampleSize - a.sampleSize;
  });

  return {
    generatedAt: now.toISOString(),
    window: {
      mode,
      startKey,
      endKey,
      lookbackDays,
    },
    memory,
    insights: scopedInsights,
    summary: {
      positive: scopedInsights.filter(
        (item) => item.severity === 'positive',
      ).length,
      info: scopedInsights.filter(
        (item) => item.severity === 'info',
      ).length,
      attention: scopedInsights.filter(
        (item) => item.severity === 'attention',
      ).length,
      warning: scopedInsights.filter(
        (item) => item.severity === 'warning',
      ).length,
      total: scopedInsights.length,
    },
    coverage: {
      datedDeliveries,
      undatedDeliveries: includeUndatedQuality ? undatedDeliveries.length : 0,
      deliveryRecords: deliveries.length,
      structuredNeighborhoods,
      routedDeliveries,
      stockSupplyRecords: stockSupplies.length,
      stockSupplyItems: stockSupplies.reduce((sum, item) => sum + item.items.length, 0),
      stockSupplyWithPurchaser: stockSupplies.filter((item) => Boolean(item.purchaser_name)).length,
      stockSupplyChecked: stockSupplies.filter((item) => item.status === 'conferido').length,
    },
  };
}
