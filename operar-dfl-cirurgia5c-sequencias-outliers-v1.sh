#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/storage/shared/Documents/dfl-entregas

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia5c-sequencias-outliers-${STAMP}"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 5C"
echo " SEQUÊNCIAS + INTERVALOS + OUTLIERS"
echo "============================================================"

echo
echo "== 1/8 PRE-FLIGHT =="

[ "$(pwd)" = "$HOME/storage/shared/Documents/dfl-entregas" ] || {
  echo "ABORTADO: diretório incorreto."
  exit 1
}

REQUIRED=(
  "lib/delivery-intelligence/types.ts"
  "lib/delivery-intelligence/buildOperationalMemory.ts"
  "lib/delivery-intelligence/buildOperationalIntelligence.ts"
  "lib/delivery-intelligence/statistics.ts"
  "lib/analytics/operational-records.ts"
  "app/relatorios/page.tsx"
  "types/index.ts"
)

for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || {
    echo "ABORTADO: arquivo ausente: $f"
    exit 1
  }
done

# Permite:
# A) 5B já commitada => worktree tracked limpa
# B) 5A/5B ainda aguardando commit => somente estes arquivos modificados.
ALLOWED_TRACKED='app/relatorios/page.tsx
lib/customer-duplicates.ts
lib/customer-identity.ts
lib/delivery-intelligence/buildOperationalIntelligence.ts
lib/delivery-intelligence/buildOperationalMemory.ts
lib/delivery-intelligence/types.ts
lib/reports/buildReportModel.ts'

TRACKED="$(git diff --name-only | sort || true)"

if [ -n "$TRACKED" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue

    if ! printf '%s\n' "$ALLOWED_TRACKED" | grep -Fxq "$file"; then
      echo "ABORTADO: alteração tracked inesperada:"
      echo "$file"
      echo
      git status --short
      exit 1
    fi
  done <<< "$TRACKED"

  echo "5A/5B ainda não commitadas: estado permitido."
else
  echo "Worktree tracked limpa: estado permitido."
fi

grep -q "medianIntervalDays" \
  lib/delivery-intelligence/types.ts || {
  echo "ABORTADO: contrato 5B ausente."
  exit 1
}

grep -q "routeGaps" \
  lib/delivery-intelligence/types.ts || {
  echo "ABORTADO: memória 5B ausente."
  exit 1
}

grep -q "scopedInsights" \
  lib/delivery-intelligence/buildOperationalIntelligence.ts || {
  echo "ABORTADO: inteligência 5B ausente."
  exit 1
}

echo "Pre-flight: OK"
echo "HEAD: $(git rev-parse --short HEAD)"

echo
echo "== 2/8 BACKUP =="

mkdir -p "$BACKUP"

for f in "${REQUIRED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

echo "Backup: $BACKUP"

echo
echo "== 3/8 NOVO MOTOR DE SEQUÊNCIAS =="

cat > lib/delivery-intelligence/buildRouteSequenceMemory.ts <<'TS'
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
TS

echo "buildRouteSequenceMemory.ts: OK"

echo
echo "== 4/8 TIPOS DA MEMÓRIA =="

python <<'PY'
from pathlib import Path

p = Path(
    "lib/delivery-intelligence/types.ts"
)

s = p.read_text()

anchor = """export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
}"""

replacement = """export interface NeighborhoodTransitionPattern {
  key: string;
  fromNeighborhood: string;
  toNeighborhood: string;
  occurrences: number;
  timingSample: number;
  medianCompletionIntervalMinutes: number | null;
}

export interface TransitionObservationAnomaly {
  routeId: string;
  fromDeliveryId: string;
  toDeliveryId: string;

  fromNeighborhood: string;
  toNeighborhood: string;

  observedMinutes: number;
  baselineMinutes: number;
  comparisonSample: number;
  deviationRatio: number;
}

export interface RouteSequenceMemory {
  patterns: NeighborhoodTransitionPattern[];
  anomalies: TransitionObservationAnomaly[];

  coverage: {
    orderedPairs: number;
    timedPairs: number;
  };
}

export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
  routeSequences: RouteSequenceMemory;
}"""

count = s.count(anchor)

if count != 1:
    raise SystemExit(
        f"ABORTADO [OperationalMemory]: {count}"
    )

s = s.replace(
    anchor,
    replacement,
    1,
)

p.write_text(s)

print(
    "delivery-intelligence/types.ts: OK"
)
PY

echo
echo "== 5/8 CONECTAR À MEMÓRIA CENTRAL =="

python <<'PY'
from pathlib import Path

p = Path(
    "lib/delivery-intelligence/buildOperationalMemory.ts"
)

s = p.read_text()

import_anchor = """import {
  confidenceFromSample,
  median,
  percentage,
  round,
} from './statistics';"""

import_new = """import {
  confidenceFromSample,
  median,
  percentage,
  round,
} from './statistics';

import {
  buildRouteSequenceMemory,
} from './buildRouteSequenceMemory';"""

if s.count(import_anchor) != 1:
    raise SystemExit(
        "ABORTADO: import statistics divergente."
    )

s = s.replace(
    import_anchor,
    import_new,
    1,
)

old = """  const routeGaps = buildRouteGapPatterns(
    input.routes,
    input.motoboys,
  );

  return {
    neighborhoodHourPatterns,
    recurringCustomers,
    routeContexts,
    motoboyContexts,
    routeGaps,
  };"""

new = """  const routeGaps = buildRouteGapPatterns(
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
  };"""

if s.count(old) != 1:
    raise SystemExit(
        "ABORTADO: retorno da memória divergente."
    )

s = s.replace(
    old,
    new,
    1,
)

p.write_text(s)

print(
    "buildOperationalMemory.ts: OK"
)
PY

echo
echo "== 6/8 CONECTAR INSIGHTS AO CÉREBRO =="

python <<'PY'
from pathlib import Path

p = Path(
    "lib/delivery-intelligence/buildOperationalIntelligence.ts"
)

s = p.read_text()

anchor = """import {
  buildOperationalMemory,
  buildOperationalMemoryInsights,
} from './buildOperationalMemory';"""

replacement = """import {
  buildOperationalMemory,
  buildOperationalMemoryInsights,
} from './buildOperationalMemory';

import {
  buildRouteSequenceInsights,
} from './buildRouteSequenceMemory';"""

if s.count(anchor) != 1:
    raise SystemExit(
        "ABORTADO: import memory divergente."
    )

s = s.replace(
    anchor,
    replacement,
    1,
)

old = """  const memoryInsights = buildOperationalMemoryInsights(
    memory,
    minimumSample,
  );"""

new = """  const memoryInsights = buildOperationalMemoryInsights(
    memory,
    minimumSample,
  );

  const sequenceInsights =
    buildRouteSequenceInsights(
      memory.routeSequences,
      minimumSample,
    );"""

if s.count(old) != 1:
    raise SystemExit(
        "ABORTADO: memoryInsights divergente."
    )

s = s.replace(
    old,
    new,
    1,
)

old = """    ...memoryInsights,
    ...(hasContextualRouteAnomaly"""

new = """    ...memoryInsights,
    ...sequenceInsights,
    ...(hasContextualRouteAnomaly"""

if s.count(old) != 1:
    raise SystemExit(
        "ABORTADO: composição de insights divergente."
    )

s = s.replace(
    old,
    new,
    1,
)

p.write_text(s)

print(
    "buildOperationalIntelligence.ts: OK"
)
PY

echo
echo "== 7/8 RELATÓRIOS — FLUXOS RECORRENTES =="

python <<'PY'
from pathlib import Path

p = Path("app/relatorios/page.tsx")
s = p.read_text()

anchor = """            <section className="overflow-hidden rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <RouteIcon size={18} className="text-sky-400" />
                    <h2 className="font-black text-zinc-100">Duração das rotas confiáveis</h2>"""

section = r"""            <section className="rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">
                    Sequências aprendidas
                  </p>
                  <h2 className="mt-1 font-black text-zinc-100">
                    Fluxos recorrentes entre bairros
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Usa a ordem registrada das paradas. Quando existem horários confiáveis, mede o intervalo entre a conclusão de uma entrega e a próxima.
                  </p>
                </div>
                <RouteIcon size={19} className="text-emerald-400" />
              </div>

              <div className="mt-4 space-y-2">
                {intelligence.memory.routeSequences.patterns
                  .slice(0, 6)
                  .map((pattern) => (
                    <div
                      key={pattern.key}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-zinc-200">
                            {pattern.fromNeighborhood} → {pattern.toNeighborhood}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {pattern.occurrences} ocorrência{pattern.occurrences === 1 ? '' : 's'} · {pattern.timingSample} com tempo confiável
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                            Mediana
                          </p>
                          <p className="mt-0.5 text-xs font-black text-emerald-300">
                            {pattern.medianCompletionIntervalMinutes == null
                              ? '—'
                              : `${pattern.medianCompletionIntervalMinutes.toFixed(1)} min`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                {intelligence.memory.routeSequences.patterns.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-600">
                    Ainda não há sequências com bairro estruturado suficientes para formar memória.
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-zinc-950/55 p-3">
                  <p className="text-[9px] font-bold text-zinc-600">
                    Pares ordenados
                  </p>
                  <p className="mt-1 text-base font-black text-zinc-100">
                    {intelligence.memory.routeSequences.coverage.orderedPairs}
                  </p>
                </div>

                <div className="rounded-2xl bg-zinc-950/55 p-3">
                  <p className="text-[9px] font-bold text-zinc-600">
                    Com tempo
                  </p>
                  <p className="mt-1 text-base font-black text-zinc-100">
                    {intelligence.memory.routeSequences.coverage.timedPairs}
                  </p>
                </div>

                <div className="rounded-2xl bg-zinc-950/55 p-3">
                  <p className="text-[9px] font-bold text-zinc-600">
                    Desvios
                  </p>
                  <p className="mt-1 text-base font-black text-amber-300">
                    {intelligence.memory.routeSequences.anomalies.length}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
                O intervalo inclui deslocamento e atendimento. O app não possui telemetria contínua suficiente para separar trânsito, espera ou permanência no cliente.
              </p>
            </section>

"""

if s.count(anchor) != 1:
    raise SystemExit(
        f"ABORTADO: âncora duração encontrada {s.count(anchor)} vezes."
    )

s = s.replace(
    anchor,
    section + anchor,
    1,
)

p.write_text(s)

print("app/relatorios/page.tsx: OK")
PY

echo
echo "== 8/8 CONTRATOS + VALIDAÇÃO =="

grep -q "NeighborhoodTransitionPattern" \
  lib/delivery-intelligence/types.ts

grep -q "TransitionObservationAnomaly" \
  lib/delivery-intelligence/types.ts

grep -q "routeSequences" \
  lib/delivery-intelligence/types.ts

grep -q "buildRouteSequenceMemory" \
  lib/delivery-intelligence/buildOperationalMemory.ts

grep -q "buildRouteSequenceInsights" \
  lib/delivery-intelligence/buildOperationalIntelligence.ts

grep -q "order_index" \
  lib/delivery-intelligence/buildRouteSequenceMemory.ts

grep -q "completed_at" \
  lib/delivery-intelligence/buildRouteSequenceMemory.ts

grep -q "comparisonSample" \
  lib/delivery-intelligence/buildRouteSequenceMemory.ts

grep -q "Fluxos recorrentes entre bairros" \
  app/relatorios/page.tsx

grep -q "telemetria contínua" \
  app/relatorios/page.tsx

echo "OK sequência usa order_index"
echo "OK tempo usa completed_at"
echo "OK bairro somente estruturado"
echo "OK baseline exclui a própria observação"
echo "OK mínimo de comparáveis antes de outlier"
echo "OK comparação estruturada"
echo "OK causa NÃO é atribuída ao motoboy"
echo "OK trânsito/distância NÃO são inventados"
echo "OK Relatórios exibem fluxos recorrentes"

git diff --check
node node_modules/typescript/bin/tsc --noEmit

echo
echo "============================================================"
echo " CIRURGIA 5C — SEQUÊNCIAS + OUTLIERS: OK"
echo "============================================================"
echo "OK memória bairro → bairro"
echo "OK ocorrências por sequência"
echo "OK intervalo entre conclusões"
echo "OK mediana contextual por sequência"
echo "OK outlier contra o próprio histórico"
echo "OK rota + entregas ficam vinculadas ao sinal"
echo "OK confiança baseada na amostra"
echo "OK período continuará herdado da inteligência 5B"
echo "OK git diff --check"
echo "OK TypeScript"
echo
git diff --stat
echo
git status --short
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO o retorno."
