// lib/delivery-intelligence/buildRouteSequenceMemory.ts

import type {
  Customer,
  Delivery,
  Route,
} from '@/types';

import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { parseTimestamp } from '@/lib/reports/time';

import {
  median,
  round,
  confidenceFromSample,
} from './statistics';

import type {
  NeighborhoodTransitionPattern,
  OperationalInsight,
  RouteSequenceMemory,
  TransitionObservationAnomaly,
} from './types';

function normalize(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

interface TransitionObservation {
  routeId: string;
  fromDeliveryId: string;
  toDeliveryId: string;

  fromNeighborhood: string;
  toNeighborhood: string;

  key: string;

  minutes: number | null;
}

function transitionKey(
  from: string,
  to: string,
): string {
  return `${normalize(from)}=>${normalize(to)}`;
}

function validOrderIndex(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function buildObservations(input: {
  deliveries: Delivery[];
  routes: Route[];
  customers: Customer[];
}): {
  observations: TransitionObservation[];
  orderedPairs: number;
  timedPairs: number;
} {
  const customerMap = new Map(
    input.customers.map((customer) => [
      customer.id,
      customer,
    ]),
  );

  const routeIds = new Set(
    input.routes.map((route) => route.id),
  );

  const byRoute = new Map<
    string,
    Delivery[]
  >();

  input.deliveries
    .filter(isDeliveryFulfillment)
    .filter(
      (delivery) =>
        Boolean(delivery.route_id) &&
        routeIds.has(delivery.route_id) &&
        validOrderIndex(delivery.order_index),
    )
    .forEach((delivery) => {
      const current =
        byRoute.get(delivery.route_id) ?? [];

      current.push(delivery);
      byRoute.set(
        delivery.route_id,
        current,
      );
    });

  const observations: TransitionObservation[] = [];

  let orderedPairs = 0;
  let timedPairs = 0;

  byRoute.forEach(
    (routeDeliveries, routeId) => {
      const ordered = [...routeDeliveries].sort(
        (a, b) =>
          (a.order_index as number) -
          (b.order_index as number),
      );

      for (
        let index = 1;
        index < ordered.length;
        index += 1
      ) {
        const from = ordered[index - 1];
        const to = ordered[index];

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

        /*
         * Não inventamos bairro a partir do texto do endereço.
         * A análise só usa bairro estruturado.
         */
        if (
          !fromNeighborhood ||
          !toNeighborhood
        ) {
          continue;
        }

        orderedPairs += 1;

        const fromCompleted =
          parseTimestamp(from.completed_at);

        const toCompleted =
          parseTimestamp(to.completed_at);

        let minutes: number | null = null;

        if (
          fromCompleted &&
          toCompleted
        ) {
          const value =
            (
              toCompleted.getTime() -
              fromCompleted.getTime()
            ) /
            60000;

          /*
           * Intervalo entre conclusões.
           *
           * Negativo = ordem/timestamp inconsistente.
           * > 180 min não representa um trecho útil
           * para a operação normal.
           */
          if (
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 180
          ) {
            minutes = value;
            timedPairs += 1;
          }
        }

        observations.push({
          routeId,
          fromDeliveryId: from.id,
          toDeliveryId: to.id,

          fromNeighborhood,
          toNeighborhood,

          key: transitionKey(
            fromNeighborhood,
            toNeighborhood,
          ),

          minutes,
        });
      }
    },
  );

  return {
    observations,
    orderedPairs,
    timedPairs,
  };
}

function buildPatterns(
  observations: TransitionObservation[],
): NeighborhoodTransitionPattern[] {
  const buckets = new Map<
    string,
    {
      fromNeighborhood: string;
      toNeighborhood: string;
      occurrences: number;
      minutes: number[];
    }
  >();

  observations.forEach((observation) => {
    const current =
      buckets.get(observation.key) ?? {
        fromNeighborhood:
          observation.fromNeighborhood,

        toNeighborhood:
          observation.toNeighborhood,

        occurrences: 0,
        minutes: [],
      };

    current.occurrences += 1;

    if (observation.minutes != null) {
      current.minutes.push(
        observation.minutes,
      );
    }

    buckets.set(
      observation.key,
      current,
    );
  });

  return [...buckets.entries()]
    .map(([key, item]) => ({
      key,

      fromNeighborhood:
        item.fromNeighborhood,

      toNeighborhood:
        item.toNeighborhood,

      occurrences:
        item.occurrences,

      timingSample:
        item.minutes.length,

      medianCompletionIntervalMinutes:
        item.minutes.length > 0
          ? median(item.minutes)
          : null,
    }))
    .sort((a, b) => {
      if (
        b.occurrences !==
        a.occurrences
      ) {
        return (
          b.occurrences -
          a.occurrences
        );
      }

      return (
        b.timingSample -
        a.timingSample
      );
    })
    .slice(0, 30);
}

function buildAnomalies(
  observations: TransitionObservation[],
): TransitionObservationAnomaly[] {
  const timed =
    observations.filter(
      (
        item,
      ): item is TransitionObservation & {
        minutes: number;
      } => item.minutes != null,
    );

  const byKey = new Map<
    string,
    Array<
      TransitionObservation & {
        minutes: number;
      }
    >
  >();

  timed.forEach((observation) => {
    const current =
      byKey.get(observation.key) ?? [];

    current.push(observation);

    byKey.set(
      observation.key,
      current,
    );
  });

  const anomalies:
    TransitionObservationAnomaly[] = [];

  byKey.forEach((group) => {
    /*
     * Para classificar UMA observação,
     * exigimos ao menos 3 outras ocorrências
     * comparáveis. A própria observação não
     * participa da baseline.
     */
    if (group.length < 4) return;

    group.forEach((observation) => {
      const comparison = group
        .filter(
          (candidate) =>
            candidate !== observation,
        )
        .map(
          (candidate) =>
            candidate.minutes,
        );

      if (comparison.length < 3) {
        return;
      }

      const baseline =
        median(comparison);

      if (
        baseline == null ||
        baseline <= 0
      ) {
        return;
      }

      const threshold =
        Math.max(
          baseline * 1.8,
          baseline + 8,
        );

      if (
        observation.minutes <=
        threshold
      ) {
        return;
      }

      anomalies.push({
        routeId:
          observation.routeId,

        fromDeliveryId:
          observation.fromDeliveryId,

        toDeliveryId:
          observation.toDeliveryId,

        fromNeighborhood:
          observation.fromNeighborhood,

        toNeighborhood:
          observation.toNeighborhood,

        observedMinutes:
          observation.minutes,

        baselineMinutes:
          baseline,

        comparisonSample:
          comparison.length,

        deviationRatio:
          observation.minutes /
          baseline,
      });
    });
  });

  return anomalies.sort(
    (a, b) =>
      b.deviationRatio -
      a.deviationRatio,
  );
}

export function buildRouteSequenceMemory(
  input: {
    deliveries: Delivery[];
    routes: Route[];
    customers: Customer[];
  },
): RouteSequenceMemory {
  const {
    observations,
    orderedPairs,
    timedPairs,
  } = buildObservations(input);

  return {
    patterns:
      buildPatterns(observations),

    anomalies:
      buildAnomalies(observations),

    coverage: {
      orderedPairs,
      timedPairs,
    },
  };
}

export function buildRouteSequenceInsights(
  memory: RouteSequenceMemory,
  minimumSample: number,
): OperationalInsight[] {
  const insights: OperationalInsight[] = [];

  const recurring =
    memory.patterns.find(
      (pattern) =>
        pattern.occurrences >=
        minimumSample,
    );

  if (recurring) {
    const hasTiming =
      recurring.timingSample >=
        minimumSample &&
      recurring
        .medianCompletionIntervalMinutes !=
        null;

    insights.push({
      id:
        `sequence-recurring-${recurring.key}`,

      category: 'routes',

      severity: 'info',

      confidence:
        confidenceFromSample(
          recurring.occurrences,
          minimumSample,
        ),

      title:
        `${recurring.fromNeighborhood} → ${recurring.toNeighborhood} é uma sequência recorrente`,

      summary:
        hasTiming
          ? `${recurring.occurrences} ocorrências; ${recurring.timingSample} têm horários confiáveis, com mediana de ${round(recurring.medianCompletionIntervalMinutes || 0, 1)} min entre conclusões.`
          : `${recurring.occurrences} ocorrências formam um padrão de sequência, mas ainda faltam horários confiáveis para criar uma baseline temporal.`,

      explanation:
        'A sequência usa a ordem registrada das paradas. O tempo, quando disponível, mede o intervalo entre a conclusão de uma entrega e a conclusão da próxima; ele inclui deslocamento e atendimento e não representa trânsito isoladamente.',

      sampleSize:
        recurring.occurrences,

      evidence: [
        {
          label: 'Sequência',
          value:
            `${recurring.fromNeighborhood} → ${recurring.toNeighborhood}`,
        },
        {
          label: 'Ocorrências',
          value:
            String(
              recurring.occurrences,
            ),
        },
        {
          label: 'Com tempo confiável',
          value:
            String(
              recurring.timingSample,
            ),
        },
        {
          label:
            'Intervalo mediano',
          value:
            hasTiming
              ? `${round(recurring.medianCompletionIntervalMinutes || 0, 1)} min`
              : 'Amostra insuficiente',
        },
      ],
    });
  }

  const worst =
    memory.anomalies[0];

  if (worst) {
    insights.push({
      id:
        `sequence-anomaly-${worst.routeId}-${worst.fromDeliveryId}-${worst.toDeliveryId}`,

      category: 'routes',

      severity:
        worst.deviationRatio >= 2.5
          ? 'warning'
          : 'attention',

      confidence:
        confidenceFromSample(
          worst.comparisonSample,
          minimumSample,
        ),

      title:
        'Um intervalo entre entregas ficou acima do próprio histórico',

      summary:
        `${worst.fromNeighborhood} → ${worst.toNeighborhood} levou ${round(worst.observedMinutes, 1)} min entre conclusões; a mediana comparável é ${round(worst.baselineMinutes, 1)} min.`,

      explanation:
        'O sinal compara somente a mesma sequência de bairros. Ele indica um trecho operacional para revisar, mas não atribui causa: espera no cliente, trânsito, endereço, desvio de rota ou outro contexto podem explicar a diferença.',

      sampleSize:
        worst.comparisonSample,

      entityIds: [
        worst.routeId,
        worst.fromDeliveryId,
        worst.toDeliveryId,
      ],

      comparison: {
        label:
          `${worst.fromNeighborhood} → ${worst.toNeighborhood}`,

        baseline:
          worst.baselineMinutes,

        observed:
          worst.observedMinutes,

        unit: 'min',
      },

      evidence: [
        {
          label: 'Sequência',
          value:
            `${worst.fromNeighborhood} → ${worst.toNeighborhood}`,
        },
        {
          label:
            'Amostra comparável',
          value:
            String(
              worst.comparisonSample,
            ),
        },
        {
          label: 'Mediana',
          value:
            `${round(worst.baselineMinutes, 1)} min`,
        },
        {
          label: 'Observado',
          value:
            `${round(worst.observedMinutes, 1)} min`,
        },
      ],
    });
  }

  return insights;
}
