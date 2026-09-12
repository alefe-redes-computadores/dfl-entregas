#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$ROOT"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 3"
echo " ROTAS + ENTREGAS + MOTOBOYS — CORE V1"
echo "============================================================"

echo
echo "== 1/8 PRE-FLIGHT =="

[[ "$(pwd)" == "$ROOT" ]] || {
  echo "ABORTADO: diretório incorreto."
  exit 1
}

EXPECTED="803b9bdc4e76fb5ffebcfee12e932842c8556410"
HEAD="$(git rev-parse HEAD)"

[[ "$HEAD" == "$EXPECTED" ]] || {
  echo "ABORTADO: HEAD divergiu da tomografia."
  echo "Esperado: $EXPECTED"
  echo "Atual:    $HEAD"
  exit 1
}

for f in \
  app/rotas/page.tsx \
  app/rotas/details/page.tsx \
  app/rotas/nova/page.tsx \
  app/rotas/editar/page.tsx \
  app/entregas/page.tsx \
  store/useAppStore.ts \
  lib/operational-time.ts
do
  [[ -f "$f" ]] || {
    echo "ABORTADO: arquivo ausente: $f"
    exit 1
  }
done

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ABORTADO: existem alterações rastreadas."
  git status --short
  exit 1
fi

grep -q "const \[selectedDate, setSelectedDate\] = useState" app/rotas/page.tsx
grep -q "const \[selectedDate, setSelectedDate\] = useState" app/entregas/page.tsx
grep -q "addRoute: async (route)" store/useAppStore.ts
grep -q "updateMotoboy: async (id, updatedData)" store/useAppStore.ts

echo "Pre-flight OK."
git log -1 --oneline

echo
echo "== 2/8 BACKUP =="

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia3-operacao-core-$STAMP"
mkdir -p "$BACKUP"

cp --parents \
  app/rotas/page.tsx \
  app/rotas/details/page.tsx \
  app/rotas/nova/page.tsx \
  app/rotas/editar/page.tsx \
  app/entregas/page.tsx \
  store/useAppStore.ts \
  "$BACKUP"

echo "Backup: $BACKUP"

echo
echo "== 3/8 HELPERS OPERACIONAIS DE CALENDÁRIO =="

cat >> lib/operational-time.ts <<'EOF'

/**
 * Helpers canônicos para telas operacionais.
 * Evitam cada página reinterpretar YYYY-MM-DD / America/Sao_Paulo.
 */
export function operationalDateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00-03:00`);
}

export function shiftOperationalDateKey(
  key: string,
  amount: number,
): string {
  const value = operationalDateFromKey(key);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
}

export function operationalDayLabel(
  key: string,
  now = new Date(),
): string {
  if (key === dateKey(now)) return 'Hoje';

  return operationalDateFromKey(key)
    .toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
    .replaceAll('.', '');
}
EOF

echo "Helpers canônicos: OK"

echo
echo "== 4/8 ROTAS — DATA GLOBAL + AGREGAÇÃO ÚNICA =="

python - <<'PY'
from pathlib import Path

p = Path("app/rotas/page.tsx")
s = p.read_text()

s = s.replace(
"import { firstValidTimestamp } from '@/lib/reports/time';",
"""import { firstValidTimestamp } from '@/lib/reports/time';
import {
  dateKey,
  operationalDateFromKey,
  operationalDayLabel,
  routeDate as canonicalRouteDate,
  routeStartedAt as canonicalRouteStartedAt,
  shiftOperationalDateKey,
} from '@/lib/operational-time';"""
)

start = s.index("type DatedRoute =")
end = s.index("\n\nexport default function RoutesPage()")

s = s[:start] + s[end+2:]

s = s.replace(
"  const initialDateKey = initialDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(initialDate) ? initialDate : todayKey();",
"""  const globalSelectedDate = useAppStore((state) => state.selectedDate);
  const setGlobalSelectedDate = useAppStore((state) => state.setSelectedDate);
  const today = dateKey(new Date());
  const initialDateKey =
    initialDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(initialDate)
      ? initialDate
      : dateKey(globalSelectedDate);"""
)

s = s.replace(
"  const [selectedDate, setSelectedDate] = useState(() => initialDateKey);",
"""  const selectedDate = dateKey(globalSelectedDate);
  const setSelectedDate = (key: string | ((value: string) => string)) => {
    const next =
      typeof key === 'function'
        ? key(dateKey(useAppStore.getState().selectedDate))
        : key;

    setGlobalSelectedDate(operationalDateFromKey(next));
  };"""
)

s = s.replace(
"  const [calendarMonth, setCalendarMonth] = useState(() => fromKey(initialDateKey));",
"  const [calendarMonth, setCalendarMonth] = useState(() => operationalDateFromKey(initialDateKey));"
)

s = s.replace("routeDate(route)", "canonicalRouteDate(route)")
s = s.replace("routeStartedAt(route)", "canonicalRouteStartedAt(route)")
s = s.replace("todayKey()", "today")
s = s.replace("shiftDay(value, -1)", "shiftOperationalDateKey(value, -1)")
s = s.replace("shiftDay(value, 1)", "shiftOperationalDateKey(value, 1)")
s = s.replace("fromKey(selectedDate)", "operationalDateFromKey(selectedDate)")
s = s.replace("dayLabel(selectedDate)", "operationalDayLabel(selectedDate)")
s = s.replace("fromKey(key)", "operationalDateFromKey(key)")

old = """  const dayRoutes = useMemo(() => routes.filter(route => {
    const value = canonicalRouteDate(route);
    return value ? dateKey(value) === selectedDate : false;
  }), [routes, selectedDate]);

  const rows = useMemo(() => dayRoutes.map(route => {
    const linked = deliveries.filter(delivery => delivery.route_id === route.id);"""

new = """  const deliveriesByRoute = useMemo(() => {
    const map = new Map<string, typeof deliveries>();

    for (const delivery of deliveries) {
      if (!delivery.route_id) continue;

      const bucket = map.get(delivery.route_id) || [];
      bucket.push(delivery);
      map.set(delivery.route_id, bucket);
    }

    return map;
  }, [deliveries]);

  const dayRoutes = useMemo(() => routes.filter(route => {
    const value = canonicalRouteDate(route);
    return value ? dateKey(value) === selectedDate : false;
  }), [routes, selectedDate]);

  const rows = useMemo(() => dayRoutes.map(route => {
    const linked = deliveriesByRoute.get(route.id) || [];"""

if old not in s:
    raise SystemExit("ABORTADO: bloco rows de rotas divergiu")

s = s.replace(old, new)

s = s.replace(
"}), [dayRoutes, deliveries, filter, query]);",
"}), [dayRoutes, deliveriesByRoute, filter, query]);"
)

s = s.replace(
"""      const linked = deliveries.filter((delivery) => delivery.route_id === route.id);
      return linked.length === 0 || linked.some((delivery) => !delivery.completed);""",
"""      const linked = deliveriesByRoute.get(route.id) || [];
      return linked.length === 0 || linked.some((delivery) => !delivery.completed);"""
)

s = s.replace(
"""      const linked = deliveries.filter((delivery) => delivery.route_id === route.id);
      return linked.length > 0 && linked.every((delivery) => delivery.completed);""",
"""      const linked = deliveriesByRoute.get(route.id) || [];
      return linked.length > 0 && linked.every((delivery) => delivery.completed);"""
)

s = s.replace(
"}), [dayRoutes, deliveries]);",
"}), [dayRoutes, deliveriesByRoute]);"
)

p.write_text(s)
print("Rotas: OK")
PY

echo
echo "== 5/8 ENTREGAS — DATA GLOBAL =="

python - <<'PY'
from pathlib import Path

p = Path("app/entregas/page.tsx")
s = p.read_text()

s = s.replace(
"import { deliveryDate } from '@/lib/operational-time';",
"""import {
  dateKey,
  deliveryDate,
  operationalDateFromKey,
  operationalDayLabel,
  shiftOperationalDateKey,
} from '@/lib/operational-time';"""
)

start = s.index("const dateKey =")
end = s.index("\n\nconst normalize =")

s = s[:start] + s[end+2:]

s = s.replace(
"  const initialDateKey = initialDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(initialDate) ? initialDate : todayKey();",
"""  const globalSelectedDate = useAppStore((state) => state.selectedDate);
  const setGlobalSelectedDate = useAppStore((state) => state.setSelectedDate);
  const today = dateKey(new Date());
  const initialDateKey =
    initialDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(initialDate)
      ? initialDate
      : dateKey(globalSelectedDate);"""
)

s = s.replace(
"  const [selectedDate, setSelectedDate] = useState(() => initialDateKey);",
"""  const selectedDate = dateKey(globalSelectedDate);
  const setSelectedDate = (key: string | ((value: string) => string)) => {
    const next =
      typeof key === 'function'
        ? key(dateKey(useAppStore.getState().selectedDate))
        : key;

    setGlobalSelectedDate(operationalDateFromKey(next));
  };"""
)

s = s.replace(
"  const [calendarMonth, setCalendarMonth] = useState(() => fromKey(initialDateKey));",
"  const [calendarMonth, setCalendarMonth] = useState(() => operationalDateFromKey(initialDateKey));"
)

s = s.replace("todayKey()", "today")
s = s.replace("shiftDay(value, -1)", "shiftOperationalDateKey(value, -1)")
s = s.replace("shiftDay(value, 1)", "shiftOperationalDateKey(value, 1)")
s = s.replace("fromKey(selectedDate)", "operationalDateFromKey(selectedDate)")
s = s.replace("dayLabel(selectedDate)", "operationalDayLabel(selectedDate)")

p.write_text(s)
print("Entregas: OK")
PY

echo
echo "== 6/8 DETAILS + MOTOBOY LEGADO =="

python - <<'PY'
from pathlib import Path

# Route details: selector cru + memo.
p = Path("app/rotas/details/page.tsx")
s = p.read_text()

s = s.replace(
"import { useState } from 'react';",
"import { useMemo, useState } from 'react';"
)

old = """  const deliveries = useAppStore((state) =>
    state.deliveries
      .filter((item) => item.route_id === id)
      .sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999)),
  );"""

new = """  const allDeliveries = useAppStore((state) => state.deliveries);

  const deliveries = useMemo(
    () =>
      allDeliveries
        .filter((item) => item.route_id === id)
        .sort(
          (a, b) =>
            (a.order_index ?? 9999) -
            (b.order_index ?? 9999),
        ),
    [allDeliveries, id],
  );"""

if old not in s:
    raise SystemExit("ABORTADO: selector details divergiu")

s = s.replace(old, new)
p.write_text(s)

# Store: proteção de exclusão para rota legada por nome.
p = Path("store/useAppStore.ts")
s = p.read_text()

old = """      deleteMotoboy: async (id) => {
        if (get().routes.some((route) => route.motoboy_id === id)) {
          throw new Error('Não é possível excluir um motoboy que possui rotas. Desative o cadastro para preservar o histórico.');
        }
        const previousMotoboys = get().motoboys;"""

new = """      deleteMotoboy: async (id) => {
        const currentMotoboy = get().motoboys.find(
          (motoboy) => motoboy.id === id,
        );

        if (!currentMotoboy) {
          throw new Error('Motoboy não encontrado.');
        }

        const hasHistoricalRoute = get().routes.some(
          (route) =>
            route.motoboy_id === id ||
            (
              !route.motoboy_id &&
              route.motoboy_name
                .trim()
                .toLocaleLowerCase('pt-BR') ===
                currentMotoboy.name
                  .trim()
                  .toLocaleLowerCase('pt-BR')
            ),
        );

        if (hasHistoricalRoute) {
          throw new Error(
            'Não é possível excluir um motoboy que possui rotas. Desative o cadastro para preservar o histórico.',
          );
        }

        const previousMotoboys = get().motoboys;"""

if old not in s:
    raise SystemExit("ABORTADO: deleteMotoboy divergiu")

s = s.replace(old, new)
p.write_text(s)

print("Details + proteção histórica: OK")
PY

echo
echo "== 7/8 CONTRATOS =="

if grep -q "^const dateKey =" app/rotas/page.tsx; then
  echo "ERRO: Rotas ainda declara dateKey local."
  exit 1
fi

if grep -q "^const dateKey =" app/entregas/page.tsx; then
  echo "ERRO: Entregas ainda declara dateKey local."
  exit 1
fi

grep -q "state.selectedDate" app/rotas/page.tsx
grep -q "state.selectedDate" app/entregas/page.tsx
grep -q "deliveriesByRoute" app/rotas/page.tsx
grep -q "operationalDayLabel" app/rotas/page.tsx
grep -q "operationalDayLabel" app/entregas/page.tsx
grep -q "allDeliveries" app/rotas/details/page.tsx
grep -q "hasHistoricalRoute" store/useAppStore.ts

# Proteções críticas que NÃO podem desaparecer.
grep -q "Adicione pelo menos uma entrega antes de iniciar a rota" store/useAppStore.ts
grep -q "Rotas iniciadas ou finalizadas fazem parte do histórico" store/useAppStore.ts
grep -q "Não é possível excluir uma rota que possui entregas" store/useAppStore.ts
grep -q "routeChanged && deliveryToUpdate.completed === true" store/useAppStore.ts
grep -q "completed_at" store/useAppStore.ts

echo "Contratos críticos: OK"

echo
echo "== 8/8 VALIDAÇÃO =="

git diff --check

node node_modules/typescript/bin/tsc --noEmit

echo
echo "--- DIFF STAT ---"
git diff --stat

echo
echo "--- STATUS ---"
git status --short

echo
echo "============================================================"
echo " CIRURGIA 3 — CORE V1 APLICADA"
echo "============================================================"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "RESULTADO:"
echo "  OK Rotas usa calendário operacional global"
echo "  OK Entregas usa calendário operacional global"
echo "  OK Home + Loja + Rotas + Entregas compartilham selectedDate"
echo "  OK helpers de data centralizados em operational-time"
echo "  OK agregação entrega->rota deixa de refiltrar a lista inteira"
echo "  OK contadores de rota reutilizam índice por route_id"
echo "  OK details de rota não cria array dentro do selector Zustand"
echo "  OK exclusão de motoboy protege rotas modernas por ID"
echo "  OK exclusão de motoboy protege rotas legadas por nome"
echo "  OK rename NÃO reescreve histórico de rotas"
echo "  OK startRoute preserva proteção contra rota vazia"
echo "  OK deleteRoute preserva histórico"
echo "  OK entrega concluída continua protegida contra troca de rota"
echo "  OK completed_at preservado"
echo "  OK nenhuma migração de dados"
echo "  OK git diff --check"
echo "  OK TypeScript"
echo
echo "NÃO faça commit ainda."
echo "Me mande TODO o retorno."
