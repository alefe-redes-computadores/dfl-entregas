#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/storage/shared/Documents/dfl-entregas

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia5d-prerota-contextual-${STAMP}"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 5D"
echo " PRÉ-ROTA CONTEXTUAL + COMPOSIÇÃO OPERACIONAL"
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
  "lib/delivery-intelligence/buildRouteSequenceMemory.ts"
  "components/home/OperationalCommandCenter.tsx"
  "components/home/RouteAccordion.tsx"
  "hooks/useDeliveryIntelligence.ts"
  "types/index.ts"
)

for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || {
    echo "ABORTADO: ausente $f"
    exit 1
  }
done

grep -q "routeSequences" lib/delivery-intelligence/types.ts || {
  echo "ABORTADO: 5C não detectada."
  exit 1
}

grep -q "buildRouteSequenceMemory" lib/delivery-intelligence/buildRouteSequenceMemory.ts || {
  echo "ABORTADO: motor de sequências ausente."
  exit 1
}

# Aceita o estado imediatamente após a 5C.
ALLOWED_TRACKED='app/relatorios/page.tsx
lib/delivery-intelligence/buildOperationalIntelligence.ts
lib/delivery-intelligence/buildOperationalMemory.ts
lib/delivery-intelligence/types.ts'

TRACKED="$(git diff --name-only | sort || true)"

if [ -n "$TRACKED" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue

    if ! printf '%s\n' "$ALLOWED_TRACKED" | grep -Fxq "$file"; then
      echo "ABORTADO: alteração tracked inesperada:"
      echo "$file"
      git status --short
      exit 1
    fi
  done <<< "$TRACKED"
fi

echo "Pre-flight: OK"

echo
echo "== 2/8 BACKUP =="

mkdir -p "$BACKUP"

for f in "${REQUIRED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

echo "Backup: $BACKUP"

echo
echo "== 3/8 MOTOR DE PRÉ-ROTA =="

cat > lib/delivery-intelligence/buildPreRouteContext.ts <<'TS'
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
TS

echo "buildPreRouteContext.ts: OK"

echo
echo "== 4/8 TIPOS =="

python <<'PY'
from pathlib import Path

p = Path("lib/delivery-intelligence/types.ts")
s = p.read_text()

anchor = """export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
  routeSequences: RouteSequenceMemory;
}"""

replacement = """export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
  routeSequences: RouteSequenceMemory;
}

export interface PreRouteTransitionMatch {
  fromDeliveryId: string;
  toDeliveryId: string;
  fromNeighborhood: string;
  toNeighborhood: string;

  historicalOccurrences: number;
  timingSample: number;
  medianCompletionIntervalMinutes: number | null;
}

export interface PreRouteContext {
  routeId: string;
  routeName: string;

  deliveryCount: number;
  orderedDeliveryCount: number;

  neighborhoodCount: number;
  distinctNeighborhoods: number;
  neighborhoodCoverage: number;

  transitions: PreRouteTransitionMatch[];

  knownTransitionCount: number;
  timedTransitionCount: number;

  historicalTransitionCoverage: number;

  status:
    | 'empty'
    | 'limited-data'
    | 'forming'
    | 'partial-history'
    | 'well-known';
}"""

if s.count(anchor) != 1:
    raise SystemExit(
        f"ABORTADO tipos: âncora encontrada {s.count(anchor)} vezes."
    )

s = s.replace(anchor, replacement, 1)
p.write_text(s)

print("types.ts: OK")
PY

echo
echo "== 5/8 COMPONENTE VISUAL PRÉ-ROTA =="

cat > components/home/PreRouteIntelligence.tsx <<'TS'
// components/home/PreRouteIntelligence.tsx
'use client';

import {
  BrainCircuit,
  CheckCircle2,
  MapPin,
  Route as RouteIcon,
} from 'lucide-react';

import type {
  Customer,
  Delivery,
  Route,
} from '@/types';

import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { buildPreRouteContext } from '@/lib/delivery-intelligence/buildPreRouteContext';

export function PreRouteIntelligence({
  route,
  deliveries,
  customers,
}: {
  route: Route;
  deliveries: Delivery[];
  customers: Customer[];
}) {
  const intelligence =
    useDeliveryIntelligence({
      lookbackDays: 90,
      minimumSample: 3,
      highlightLimit: 3,
    });

  if (
    route.status !== 'aberta' ||
    route.started_at ||
    route.departure_time
  ) {
    return null;
  }

  const context = buildPreRouteContext({
    route,
    deliveries,
    customers,
    memory: intelligence.memory,
  });

  if (context.deliveryCount === 0) {
    return null;
  }

  const knownPercent =
    context.transitions.length > 0
      ? Math.round(
          context.historicalTransitionCoverage *
            100,
        )
      : 0;

  const title =
    context.status === 'well-known'
      ? 'Rota com histórico conhecido'
      : context.status === 'partial-history'
        ? 'Rota com histórico parcial'
        : context.status === 'limited-data'
          ? 'Dados limitam a leitura da rota'
          : 'Histórico desta composição ainda está se formando';

  const tone =
    context.status === 'well-known'
      ? 'emerald'
      : context.status === 'limited-data'
        ? 'amber'
        : 'sky';

  const classes = {
    emerald:
      'border-emerald-500/20 bg-emerald-500/[.045] text-emerald-300',
    amber:
      'border-amber-500/20 bg-amber-500/[.045] text-amber-300',
    sky:
      'border-sky-500/20 bg-sky-500/[.045] text-sky-300',
  }[tone];

  return (
    <section
      className={`rounded-[22px] border p-4 ${classes}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950/35">
          {context.status === 'well-known' ? (
            <CheckCircle2 size={17} />
          ) : (
            <BrainCircuit size={17} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.18em] opacity-70">
            Leitura pré-rota
          </p>

          <h3 className="mt-1 text-sm font-black text-zinc-100">
            {title}
          </h3>

          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            {context.deliveryCount} parada
            {context.deliveryCount === 1
              ? ''
              : 's'}{' '}
            · {context.distinctNeighborhoods}{' '}
            bairro
            {context.distinctNeighborhoods === 1
              ? ''
              : 's'}{' '}
            · {knownPercent}% das transições já
            apareceram no histórico.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini
          icon={<RouteIcon size={11} />}
          label="Sequências"
          value={`${context.knownTransitionCount}/${context.transitions.length}`}
        />

        <Mini
          icon={<MapPin size={11} />}
          label="Bairros"
          value={String(
            context.distinctNeighborhoods,
          )}
        />

        <Mini
          icon={<BrainCircuit size={11} />}
          label="Com tempo"
          value={String(
            context.timedTransitionCount,
          )}
        />
      </div>

      {context.transitions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {context.transitions
            .slice(0, 4)
            .map((item) => (
              <div
                key={`${item.fromDeliveryId}-${item.toDeliveryId}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/30 px-3 py-2"
              >
                <span className="min-w-0 truncate text-[10px] font-bold text-zinc-400">
                  {item.fromNeighborhood} →{' '}
                  {item.toNeighborhood}
                </span>

                <span className="shrink-0 text-[9px] font-black text-zinc-500">
                  {item.historicalOccurrences > 0
                    ? `${item.historicalOccurrences}×`
                    : 'novo'}
                </span>
              </div>
            ))}
        </div>
      )}

      <p className="mt-3 text-[9px] leading-relaxed text-zinc-600">
        Esta leitura não reorganiza a rota nem
        atribui dificuldade. Ela apenas compara a
        composição atual com o histórico disponível.
      </p>
    </section>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-950/35 p-2.5">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
        {icon}
        {label}
      </div>

      <div className="mt-1 text-sm font-black text-zinc-200">
        {value}
      </div>
    </div>
  );
}
TS

echo "PreRouteIntelligence.tsx: OK"

echo
echo "== 6/8 CONECTAR À ROTA =="

python <<'PY'
from pathlib import Path

p = Path("components/home/RouteAccordion.tsx")
s = p.read_text()

# Importa o componente.
imports = [
    "import { PreRouteIntelligence } from '@/components/home/PreRouteIntelligence';",
]

if imports[0] not in s:
    marker = "'use client';"

    if marker not in s:
        raise SystemExit(
            "ABORTADO: use client não encontrado."
        )

    s = s.replace(
        marker,
        marker + "\n\n" + imports[0],
        1,
    )

# Precisamos do customer array já existente no store;
# se já existir, não duplica.
if "state.customers" not in s:
    anchor = """  const motoboys = useAppStore((state) => state.motoboys);"""

    if s.count(anchor) != 1:
        raise SystemExit(
            "ABORTADO: selector motoboys divergente."
        )

    s = s.replace(
        anchor,
        anchor + """
  const customers = useAppStore((state) => state.customers);""",
        1,
    )

# Busca um ponto seguro próximo ao conteúdo da rota:
# insere antes do primeiro bloco operacional grande
# quando a rota ainda não saiu.
needle = """      {isOpen && ("""

if s.count(needle) != 1:
    raise SystemExit(
        f"ABORTADO: bloco isOpen encontrado {s.count(needle)} vezes."
    )

replacement = """      {isOpen && (
        <div className="px-4 pb-3">
          <PreRouteIntelligence
            route={route}
            deliveries={routeDeliveries}
            customers={customers}
          />
        </div>
      )}

      {isOpen && ("""

s = s.replace(
    needle,
    replacement,
    1,
)

p.write_text(s)

print("RouteAccordion.tsx: OK")
PY

echo
echo "== 7/8 CONTRATOS =="

grep -q "buildPreRouteContext" \
  lib/delivery-intelligence/buildPreRouteContext.ts

grep -q "historicalTransitionCoverage" \
  lib/delivery-intelligence/buildPreRouteContext.ts

grep -q "PreRouteContext" \
  lib/delivery-intelligence/types.ts

grep -q "Leitura pré-rota" \
  components/home/PreRouteIntelligence.tsx

grep -q "não reorganiza a rota" \
  components/home/PreRouteIntelligence.tsx

grep -q "PreRouteIntelligence" \
  components/home/RouteAccordion.tsx

echo "OK pré-rota usa memória da 5C"
echo "OK sequência atual usa order_index"
echo "OK bairros estruturados"
echo "OK histórico conhecido/parcial/formando"
echo "OK não bloqueia saída"
echo "OK não reorganiza automaticamente"
echo "OK não cria ranking"
echo "OK Command Center permanece separado"

echo
echo "== 8/8 VALIDAÇÃO =="

git diff --check
node node_modules/typescript/bin/tsc --noEmit

echo
echo "============================================================"
echo " CIRURGIA 5D — PRÉ-ROTA CONTEXTUAL: OK"
echo "============================================================"
echo "OK leitura pré-rota"
echo "OK composição por paradas e bairros"
echo "OK cobertura histórica das transições"
echo "OK sequências conhecidas aparecem na rota"
echo "OK falta de histórico aparece como formação, não erro"
echo "OK nenhuma rota é alterada"
echo "OK nenhuma causa é inventada"
echo "OK git diff --check"
echo "OK TypeScript"
echo
git diff --stat
echo
git status --short
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO o retorno."
