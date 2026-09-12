#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/storage/shared/Documents/dfl-entregas

EXPECTED_HEAD="3991b4ac4acab5d0f690ea4fb75d060fe572578e"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia5b-cerebro-relatorios-${STAMP}"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 5B"
echo " CÉREBRO OPERACIONAL + RELATÓRIOS V2"
echo "============================================================"

echo
echo "== 1/9 PRE-FLIGHT =="

[ "$(pwd)" = "$HOME/storage/shared/Documents/dfl-entregas" ] || {
  echo "ABORTADO: diretório incorreto."
  exit 1
}

HEAD="$(git rev-parse HEAD)"
[ "$HEAD" = "$EXPECTED_HEAD" ] || {
  echo "ABORTADO: HEAD divergente."
  echo "Esperado: $EXPECTED_HEAD"
  echo "Atual:    $HEAD"
  exit 1
}

# A 5A ainda está intencionalmente sem commit.
TRACKED="$(git diff --name-only | sort)"

EXPECTED_TRACKED="$(printf '%s\n' \
  lib/customer-duplicates.ts \
  lib/customer-identity.ts | sort)"

if [ "$TRACKED" != "$EXPECTED_TRACKED" ]; then
  echo "ABORTADO: alterações tracked diferentes da 5A esperada."
  echo
  echo "Encontradas:"
  git status --short
  exit 1
fi

FILES=(
  "lib/reports/buildReportModel.ts"
  "lib/reports/types.ts"
  "lib/delivery-intelligence/types.ts"
  "lib/delivery-intelligence/buildOperationalIntelligence.ts"
  "lib/delivery-intelligence/buildOperationalMemory.ts"
  "app/relatorios/page.tsx"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || {
    echo "ABORTADO: arquivo ausente: $f"
    exit 1
  }
done

echo "Pre-flight: OK"
echo "HEAD: $(git log -1 --oneline)"
echo "5A detectada e preservada."

echo
echo "== 2/9 BACKUP =="

mkdir -p "$BACKUP"

for f in \
  lib/customer-duplicates.ts \
  lib/customer-identity.ts \
  "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

echo "Backup: $BACKUP"

echo
echo "== 3/9 FONTE TEMPORAL COMPARTILHADA =="

mkdir -p lib/analytics

cat > lib/analytics/operational-records.ts <<'TS'
import type {
  Delivery,
  Route,
  StockSupply,
} from '@/types';

import {
  compareDateKeys,
  firstValidTimestamp,
  parseTimestamp,
  saoPauloDateKey,
} from '@/lib/reports/time';

/**
 * Data de entrada real do pedido.
 *
 * Regra central:
 * updated_at nunca transforma um pedido antigo em novo.
 */
export function deliveryOperationalTimestamp(
  delivery: Delivery,
): Date | null {
  return firstValidTimestamp(
    delivery.created_at,
    delivery.createdAt,
  );
}

/**
 * Data operacional de referência da rota.
 *
 * created_at é preservado primeiro para manter o mesmo contrato
 * histórico usado pela inteligência atual.
 */
export function routeOperationalTimestamp(
  route: Route,
): Date | null {
  return firstValidTimestamp(
    route.created_at,
    route.started_at,
    route.departure_time,
  );
}

export function routeStartTimestamp(
  route: Route,
): Date | null {
  return firstValidTimestamp(
    route.started_at,
    route.departure_time,
  );
}

export function routeEndTimestamp(
  route: Route,
): Date | null {
  return parseTimestamp(route.end_time);
}

/**
 * Duração confiável da rota inteira.
 *
 * Não representa tempo por entrega nem velocidade.
 */
export function trustedRouteDurationMinutes(
  route: Route,
): number | null {
  if (route.status !== 'fechada') return null;

  const start = routeStartTimestamp(route);
  const end = routeEndTimestamp(route);

  if (!start || !end) return null;

  const minutes =
    (end.getTime() - start.getTime()) / 60000;

  if (
    !Number.isFinite(minutes) ||
    minutes < 5 ||
    minutes > 600
  ) {
    return null;
  }

  return minutes;
}

export function stockSupplyOperationalTimestamp(
  supply: StockSupply,
): Date | null {
  return firstValidTimestamp(
    supply.occurred_at,
    supply.created_at,
  );
}

export function timestampInDateKeyWindow(
  date: Date | null,
  startKey: string,
  endKey: string,
): boolean {
  if (!date) return false;

  const key = saoPauloDateKey(date);

  return (
    compareDateKeys(key, startKey) >= 0 &&
    compareDateKeys(key, endKey) <= 0
  );
}

export function inclusiveDateKeyDays(
  startKey: string,
  endKey: string,
): number {
  const start =
    new Date(`${startKey}T12:00:00-03:00`).getTime();

  const end =
    new Date(`${endKey}T12:00:00-03:00`).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return 1;
  }

  return Math.max(
    Math.round((end - start) / 86400000) + 1,
    1,
  );
}
TS

echo "operational-records.ts: OK"

echo
echo "== 4/9 CONTRATOS DA INTELIGÊNCIA =="

python <<'PY'
from pathlib import Path

p = Path("lib/delivery-intelligence/types.ts")
s = p.read_text()

def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: encontrado {s.count(old)}"
        )
    s = s.replace(old, new, 1)

once(
"""export interface OperationalInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  explanation: string;
  sampleSize: number;
  evidence: IntelligenceEvidence[];
  entityIds?: string[];
}""",
"""export interface IntelligencePeriodContext {
  startKey: string;
  endKey: string;
  label?: string;
}

export interface IntelligenceComparison {
  label: string;
  baseline: number;
  observed: number;
  unit?: string;
}

export interface OperationalInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  title: string;
  summary: string;
  explanation: string;
  sampleSize: number;
  evidence: IntelligenceEvidence[];
  entityIds?: string[];

  /**
   * Janela que produziu o insight.
   * Evita mostrar uma conclusão sem dizer a qual período pertence.
   */
  period?: IntelligencePeriodContext;

  /**
   * Comparação quantitativa quando o insight depende
   * explicitamente de baseline.
   */
  comparison?: IntelligenceComparison;
}""",
"OperationalInsight",
)

once(
"""export interface RecurringCustomerPattern {
  customerId: string;
  customerName: string;
  deliveries: number;
  distinctAddresses: number;
  dominantAddress: string | null;
  dominantAddressCount: number;
  addressConsistency: number;
  hasStructuredNeighborhood: boolean;
  hasMapsLink: boolean;
}""",
"""export interface RecurringCustomerPattern {
  customerId: string;
  customerName: string;
  deliveries: number;
  distinctAddresses: number;
  dominantAddress: string | null;
  dominantAddressCount: number;
  addressConsistency: number;
  hasStructuredNeighborhood: boolean;
  hasMapsLink: boolean;

  lastOrderDateKey: string | null;
  medianIntervalDays: number | null;
}""",
"RecurringCustomerPattern",
)

anchor = """export interface MotoboyOperationalContext {
  motoboyId: string | null;
  motoboyName: string;
  routeCount: number;
  deliveryCount: number;
  medianRouteDurationMinutes: number | null;
}

export interface OperationalMemory {"""

replacement = """export interface MotoboyOperationalContext {
  motoboyId: string | null;
  motoboyName: string;
  routeCount: number;
  deliveryCount: number;
  medianRouteDurationMinutes: number | null;
  averageDeliveriesPerRoute: number;
}

export interface RouteGapPattern {
  motoboyId: string | null;
  motoboyName: string;
  sampleSize: number;
  medianGapMinutes: number;
  shortestGapMinutes: number;
  longestGapMinutes: number;
}

export interface OperationalMemory {"""

once(anchor, replacement, "RouteGapPattern")

once(
"""export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
}""",
"""export interface OperationalMemory {
  neighborhoodHourPatterns: NeighborhoodHourPattern[];
  recurringCustomers: RecurringCustomerPattern[];
  routeContexts: RouteOperationalContext[];
  motoboyContexts: MotoboyOperationalContext[];
  routeGaps: RouteGapPattern[];
}""",
"OperationalMemory",
)

p.write_text(s)

print("delivery-intelligence/types.ts: OK")
PY

echo
echo "== 5/9 MEMÓRIA OPERACIONAL V2 =="

python <<'PY'
from pathlib import Path

p = Path("lib/delivery-intelligence/buildOperationalMemory.ts")
s = p.read_text()

def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: encontrado {s.count(old)}"
        )
    s = s.replace(old, new, 1)

once(
"""import {
  firstValidTimestamp,
  parseTimestamp,
  saoPauloHour,
} from '@/lib/reports/time';""",
"""import {
  saoPauloDateKey,
  saoPauloHour,
} from '@/lib/reports/time';

import {
  deliveryOperationalTimestamp,
  routeEndTimestamp,
  routeStartTimestamp,
  trustedRouteDurationMinutes,
} from '@/lib/analytics/operational-records';""",
"imports tempo",
)

once(
"""  RouteOperationalContext,
} from './types';""",
"""  RouteGapPattern,
  RouteOperationalContext,
} from './types';""",
"import RouteGapPattern",
)

old_helpers = """function deliveryTimestamp(delivery: Delivery): Date | null {
  return firstValidTimestamp(delivery.created_at, delivery.createdAt);
}

function normalizeText(value?: string | null): string {"""

new_helpers = """function normalizeText(value?: string | null): string {"""

once(
    old_helpers,
    new_helpers,
    "remove deliveryTimestamp local",
)

old_duration = """function routeDuration(route: Route): number | null {
  if (route.status !== 'fechada') return null;

  const start = firstValidTimestamp(route.started_at, route.departure_time);
  const end = parseTimestamp(route.end_time);
  if (!start || !end) return null;

  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return null;
  return minutes;
}

function routeDepartureHour(route: Route): number | null {
  const date = firstValidTimestamp(route.started_at, route.departure_time);
  return date ? saoPauloHour(date) : null;
}"""

new_duration = """function routeDepartureHour(route: Route): number | null {
  const date = routeStartTimestamp(route);
  return date ? saoPauloHour(date) : null;
}"""

once(
    old_duration,
    new_duration,
    "remove routeDuration local",
)

s = s.replace(
    "deliveryTimestamp(delivery)",
    "deliveryOperationalTimestamp(delivery)",
)

s = s.replace(
    "const durationMinutes = routeDuration(route);",
    "const durationMinutes = trustedRouteDurationMinutes(route);",
)

old_bucket = """      deliveries: number;
      addresses: Map<string, { label: string; count: number }>;
    }
  >();"""

new_bucket = """      deliveries: number;
      addresses: Map<string, { label: string; count: number }>;
      orderTimes: number[];
    }
  >();"""

once(
    old_bucket,
    new_bucket,
    "bucket recorrência",
)

once(
"""      const current = buckets.get(delivery.customer_id) ?? {
        deliveries: 0,
        addresses: new Map<string, { label: string; count: number }>(),
      };
      current.deliveries += 1;""",
"""      const current = buckets.get(delivery.customer_id) ?? {
        deliveries: 0,
        addresses: new Map<string, { label: string; count: number }>(),
        orderTimes: [],
      };

      current.deliveries += 1;

      const orderDate =
        deliveryOperationalTimestamp(delivery);

      if (orderDate) {
        current.orderTimes.push(orderDate.getTime());
      }""",
"coleta orderTimes",
)

old_return = """      return {
        customerId,
        customerName: customer?.name?.trim() || 'Cliente sem nome',
        deliveries: item.deliveries,
        distinctAddresses: addresses.length,
        dominantAddress: dominant?.label || null,
        dominantAddressCount: dominant?.count || 0,
        addressConsistency: dominant
          ? percentage(dominant.count, item.deliveries)
          : 0,
        hasStructuredNeighborhood: Boolean(customer?.neighborhood?.trim()),
        hasMapsLink: Boolean(customer?.maps_link?.trim()),
      };"""

new_return = """      const orderedTimes = [...item.orderTimes].sort(
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
      };"""

once(
    old_return,
    new_return,
    "recorrência intervalos",
)

once(
"""      medianRouteDurationMinutes: median(item.durations),
    }))""",
"""      medianRouteDurationMinutes: median(item.durations),
      averageDeliveriesPerRoute:
        item.durations.length > 0
          ? Number(
              (
                item.deliveries /
                item.durations.length
              ).toFixed(2),
            )
          : 0,
    }))""",
"contexto motoboy",
)

anchor = """export function buildOperationalMemory(input: {
  deliveries: Delivery[];"""

route_gap_fn = r"""function buildRouteGapPatterns(
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
  deliveries: Delivery[];"""

once(
    anchor,
    route_gap_fn,
    "buildRouteGapPatterns",
)

once(
"""  const routeContexts = buildRouteContexts(input.routes, input.deliveries);
  const motoboyContexts = buildMotoboyContexts(routeContexts, input.motoboys);

  return {
    neighborhoodHourPatterns,
    recurringCustomers,
    routeContexts,
    motoboyContexts,
  };""",
"""  const routeContexts = buildRouteContexts(
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

  return {
    neighborhoodHourPatterns,
    recurringCustomers,
    routeContexts,
    motoboyContexts,
    routeGaps,
  };""",
"retorno memory",
)

# Enriquece insight de cliente recorrente.
once(
"""      evidence: [
        { label: 'Entregas', value: String(recurring.deliveries) },
        {
          label: 'Endereços distintos',
          value: String(recurring.distinctAddresses),
        },""",
"""      evidence: [
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
        },""",
"evidência recorrência",
)

# Comparação quantitativa explícita da anomalia contextual.
once(
"""      sampleSize: worst.comparisonSample,
      entityIds: contextualAnomalies.map((item) => item.routeId),
      evidence: [""",
"""      sampleSize: worst.comparisonSample,
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
      evidence: [""",
"comparison contextual",
)

p.write_text(s)

print("buildOperationalMemory.ts: OK")
PY

echo
echo "== 6/9 INTELIGÊNCIA — UMA JANELA, UMA VERDADE =="

python <<'PY'
from pathlib import Path

p = Path(
    "lib/delivery-intelligence/buildOperationalIntelligence.ts"
)
s = p.read_text()

def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: encontrado {s.count(old)}"
        )
    s = s.replace(old, new, 1)

once(
"""import {
  compareDateKeys,
  firstValidTimestamp,
  parseTimestamp,
  saoPauloDateKey,
  saoPauloHour,
  shiftDateKey,
} from '@/lib/reports/time';""",
"""import {
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
} from '@/lib/analytics/operational-records';""",
"imports",
)

old_helpers = """function deliveryTimestamp(delivery: Delivery): Date | null {
  return firstValidTimestamp(delivery.created_at, delivery.createdAt);
}

function routeTimestamp(route: Route): Date | null {
  return firstValidTimestamp(
    route.created_at,
    route.started_at,
    route.departure_time,
  );
}

function supplyTimestamp(supply: StockSupply): Date | null {
  return firstValidTimestamp(supply.occurred_at, supply.created_at);
}

function inWindow(date: Date | null, startKey: string, endKey: string): boolean {
  if (!date) return false;
  const key = saoPauloDateKey(date);
  return (
    compareDateKeys(key, startKey) >= 0 &&
    compareDateKeys(key, endKey) <= 0
  );
}

function inclusiveWindowDays(startKey: string, endKey: string): number {
  const start = new Date(`${startKey}T12:00:00-03:00`).getTime();
  const end = new Date(`${endKey}T12:00:00-03:00`).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 1;
  }

  return Math.max(Math.round((end - start) / 86400000) + 1, 1);
}
"""

if s.count(old_helpers) != 1:
    raise SystemExit(
        "ABORTADO: helpers temporais antigos divergentes."
    )

s = s.replace(old_helpers, "", 1)

replacements = {
    "deliveryTimestamp(delivery)":
        "deliveryOperationalTimestamp(delivery)",
    "deliveryTimestamp(item)":
        "deliveryOperationalTimestamp(item)",
    "routeTimestamp(item)":
        "routeOperationalTimestamp(item)",
    "routeTimestamp(route)":
        "routeOperationalTimestamp(route)",
    "supplyTimestamp(item)":
        "stockSupplyOperationalTimestamp(item)",
    "supplyTimestamp(supply)":
        "stockSupplyOperationalTimestamp(supply)",
    "inWindow(":
        "timestampInDateKeyWindow(",
    "inclusiveWindowDays(":
        "inclusiveDateKeyDays(",
}

for old, new in replacements.items():
    s = s.replace(old, new)

# routeInsights passa a usar a mesma régua de duração.
old_route_map = """    .map((route) => {
      const start = firstValidTimestamp(
        route.started_at,
        route.departure_time,
      );
      const end = parseTimestamp(route.end_time);
      if (!start || !end) return null;

      const duration = (end.getTime() - start.getTime()) / 60000;
      if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
        return null;
      }

      return { route, duration };
    })"""

new_route_map = """    .map((route) => {
      const duration =
        trustedRouteDurationMinutes(route);

      if (duration == null) {
        return null;
      }

      return { route, duration };
    })"""

once(
    old_route_map,
    new_route_map,
    "routeInsights duration",
)

once(
"""    sampleSize: valid.length,
    entityIds: anomalous.map((item) => item.route.id),
    evidence: [""",
"""    sampleSize: valid.length,
    entityIds: anomalous.map(
      (item) => item.route.id,
    ),
    comparison: {
      label: 'Mediana das rotas confiáveis',
      baseline,
      observed: worst.duration,
      unit: 'min',
    },
    evidence: [""",
"comparison route insight",
)

# Ao final, todo insight recebe a janela de onde nasceu.
old_sort = """  insights.sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity];
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
    insights,
    summary: {
      positive: insights.filter((item) => item.severity === 'positive').length,
      info: insights.filter((item) => item.severity === 'info').length,
      attention: insights.filter((item) => item.severity === 'attention').length,
      warning: insights.filter((item) => item.severity === 'warning').length,
      total: insights.length,
    },"""

new_sort = """  const scopedInsights = insights.map(
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
    },"""

once(old_sort, new_sort, "scoped insights")

p.write_text(s)

print("buildOperationalIntelligence.ts: OK")
PY

echo
echo "== 7/9 RELATÓRIOS — MESMA RÉGUA TEMPORAL =="

python <<'PY'
from pathlib import Path

p = Path("lib/reports/buildReportModel.ts")
s = p.read_text()

def once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(
            f"ABORTADO [{label}]: encontrado {s.count(old)}"
        )
    s = s.replace(old, new, 1)

once(
"""  firstValidTimestamp,
  parseTimestamp,
  saoPauloDateKey,""",
"""  firstValidTimestamp,
  saoPauloDateKey,""",
"remove parseTimestamp import",
)

insert_after = """import { isDeliveryFulfillment } from '@/lib/delivery-mode';
"""

if insert_after not in s:
    raise SystemExit(
        "ABORTADO: import delivery-mode ausente."
    )

s = s.replace(
    insert_after,
    insert_after + """import {
  deliveryOperationalTimestamp,
  trustedRouteDurationMinutes,
} from '@/lib/analytics/operational-records';
""",
    1,
)

old_delivery_fn = """function deliveryTimestamp(delivery: Delivery): Date | null {
  // Regra de auditoria: edição NÃO transforma pedido antigo em pedido recente.
  return firstValidTimestamp(delivery.created_at, delivery.createdAt);
}

"""

once(
    old_delivery_fn,
    "",
    "deliveryTimestamp local",
)

s = s.replace(
    "deliveryTimestamp(delivery)",
    "deliveryOperationalTimestamp(delivery)",
)

old_timing = """    const start = firstValidTimestamp(route.started_at, route.departure_time);
    const end = parseTimestamp(route.end_time);

    if (!start || !end) {
      suspicious += 1;
      return;
    }

    const durationMinutes = (end.getTime() - start.getTime()) / 60000;

    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 600
    ) {
      suspicious += 1;
      return;
    }"""

new_timing = """    const durationMinutes =
      trustedRouteDurationMinutes(route);

    if (durationMinutes == null) {
      suspicious += 1;
      return;
    }"""

once(
    old_timing,
    new_timing,
    "route timing",
)

p.write_text(s)

print("buildReportModel.ts: OK")
PY

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

if s.count(anchor) != 1:
    raise SystemExit(
        f"ABORTADO: âncora duração encontrada {s.count(anchor)} vezes."
    )

memory_section = r"""            <section className="rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-400">
                    Memória operacional
                  </p>
                  <h2 className="mt-1 font-black text-zinc-100">
                    Clientes recorrentes
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Frequência baseada no customer_id consolidado. Não junta pessoas só porque têm o mesmo nome.
                  </p>
                </div>
                <UserRound size={19} className="text-violet-400" />
              </div>

              <div className="mt-4 space-y-2">
                {intelligence.memory.recurringCustomers
                  .slice(0, 5)
                  .map((customer) => (
                    <div
                      key={customer.customerId}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-zinc-200">
                            {customer.customerName}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {customer.deliveries} pedidos · {customer.distinctAddresses}{' '}
                            {customer.distinctAddresses === 1 ? 'endereço' : 'endereços'}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                            Intervalo típico
                          </p>
                          <p className="mt-0.5 text-xs font-black text-violet-300">
                            {customer.medianIntervalDays == null
                              ? '—'
                              : `${customer.medianIntervalDays.toFixed(1)} d`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-zinc-500">
                        <span className="rounded-full bg-zinc-900 px-2 py-1">
                          último {customer.lastOrderDateKey || 'sem data'}
                        </span>
                        <span className="rounded-full bg-zinc-900 px-2 py-1">
                          endereço principal {customer.addressConsistency.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}

                {intelligence.memory.recurringCustomers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-600">
                    Ainda não há clientes com amostra recorrente suficiente neste período.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-400">
                    Ritmo da operação
                  </p>
                  <h2 className="mt-1 font-black text-zinc-100">
                    Intervalo entre rotas
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Mede o tempo entre o fim de uma rota e o início da próxima do mesmo entregador no mesmo dia. Não é ranking.
                  </p>
                </div>
                <Clock3 size={19} className="text-sky-400" />
              </div>

              <div className="mt-4 space-y-2">
                {intelligence.memory.routeGaps
                  .slice(0, 6)
                  .map((item) => (
                    <div
                      key={`${item.motoboyId || item.motoboyName}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/45 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-zinc-200">
                          {item.motoboyName}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {item.sampleSize} intervalo{item.sampleSize === 1 ? '' : 's'} confiável{item.sampleSize === 1 ? '' : 'eis'}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-sky-300">
                          {item.medianGapMinutes.toFixed(0)} min
                        </p>
                        <p className="text-[9px] text-zinc-600">
                          mediana
                        </p>
                      </div>
                    </div>
                  ))}

                {intelligence.memory.routeGaps.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-600">
                    Ainda não há rotas consecutivas suficientes no mesmo dia.
                  </div>
                )}
              </div>
            </section>

"""

s = s.replace(
    anchor,
    memory_section + anchor,
    1,
)

p.write_text(s)

print("app/relatorios/page.tsx: OK")
PY

echo
echo "== 8/9 CONTRATOS =="

grep -q "deliveryOperationalTimestamp" lib/analytics/operational-records.ts
grep -q "trustedRouteDurationMinutes" lib/analytics/operational-records.ts
grep -q "medianIntervalDays" lib/delivery-intelligence/types.ts
grep -q "lastOrderDateKey" lib/delivery-intelligence/types.ts
grep -q "RouteGapPattern" lib/delivery-intelligence/types.ts
grep -q "routeGaps" lib/delivery-intelligence/types.ts
grep -q "buildRouteGapPatterns" lib/delivery-intelligence/buildOperationalMemory.ts
grep -q "averageDeliveriesPerRoute" lib/delivery-intelligence/buildOperationalMemory.ts
grep -q "scopedInsights" lib/delivery-intelligence/buildOperationalIntelligence.ts
grep -q "comparison:" lib/delivery-intelligence/buildOperationalIntelligence.ts
grep -q "Clientes recorrentes" app/relatorios/page.tsx
grep -q "Intervalo entre rotas" app/relatorios/page.tsx

# Contratos históricos importantes.
grep -q "updated_at.*nunca" app/relatorios/page.tsx
grep -q "Origem ausente permanece desconhecida" app/relatorios/page.tsx
grep -q "Últimos 7 dias representam exatamente 7 datas" app/relatorios/page.tsx
grep -q "Não divide o tempo total pelo número de entregas" app/relatorios/page.tsx

echo "OK fonte temporal compartilhada"
echo "OK cliente recorrente com intervalo típico"
echo "OK intervalo entre rotas por motoboy"
echo "OK contexto sem ranking"
echo "OK insight carrega período"
echo "OK anomalia pode carregar comparação"
echo "OK critérios antigos preservados"

echo
echo "== 9/9 VALIDAÇÃO =="

git diff --check
node node_modules/typescript/bin/tsc --noEmit

echo
echo "============================================================"
echo " CIRURGIA 5B — CÉREBRO + RELATÓRIOS V2: OK"
echo "============================================================"
echo "OK 5A de identidade preservada"
echo "OK fonte temporal única compartilhada"
echo "OK memória de clientes recorrentes"
echo "OK intervalo mediano entre pedidos"
echo "OK última ocorrência do cliente"
echo "OK memória de intervalos entre rotas"
echo "OK contexto de motoboy sem ranking"
echo "OK insights com período explícito"
echo "OK comparação quantitativa estruturada"
echo "OK Relatórios exibem memória operacional"
echo "OK critérios de qualidade preservados"
echo "OK git diff --check"
echo "OK TypeScript"
echo
git diff --stat
echo
git status --short
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO o retorno."
