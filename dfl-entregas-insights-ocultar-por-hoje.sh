#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$PROJECT"

echo "=== DFL ENTREGAS — INSIGHTS / OCULTAR POR HOJE ==="
echo "Projeto: $PWD"

test "$PWD" = "$PROJECT" || { echo "ERRO: diretório incorreto."; exit 1; }

required=(
  "components/reports/ReportIntelligencePanel.tsx"
  "components/home/OperationalRadar.tsx"
  "lib/delivery-intelligence/selectHighlights.ts"
)

for file in "${required[@]}"; do
  test -f "$file" || { echo "ERRO: arquivo ausente: $file"; exit 1; }
done

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERRO: existem alterações TRACKED não commitadas."
  git status --short --untracked-files=no
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/insights-ocultar-hoje-$STAMP"

for file in "${required[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp "$file" "$BACKUP/$file"
done

mkdir -p "$BACKUP/hooks"
test -f hooks/useHiddenInsightsToday.ts && cp hooks/useHiddenInsightsToday.ts "$BACKUP/hooks/useHiddenInsightsToday.ts" || true

cat > hooks/useHiddenInsightsToday.ts <<'EOF'
// hooks/useHiddenInsightsToday.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dfl-hidden-operational-insights';

type HiddenInsightState = {
  dateKey: string;
  ids: string[];
};

function saoPauloDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function readState(): HiddenInsightState {
  const today = saoPauloDateKey();

  if (typeof window === 'undefined') {
    return { dateKey: today, ids: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dateKey: today, ids: [] };

    const parsed = JSON.parse(raw) as Partial<HiddenInsightState>;

    if (
      parsed.dateKey !== today ||
      !Array.isArray(parsed.ids)
    ) {
      return { dateKey: today, ids: [] };
    }

    return {
      dateKey: today,
      ids: parsed.ids.filter((id): id is string => typeof id === 'string'),
    };
  } catch {
    return { dateKey: today, ids: [] };
  }
}

function writeState(state: HiddenInsightState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Se o navegador bloquear storage, a ocultação ainda funciona na sessão atual.
  }
}

export function useHiddenInsightsToday() {
  const [state, setState] = useState<HiddenInsightState>(() => ({
    dateKey: saoPauloDateKey(),
    ids: [],
  }));

  useEffect(() => {
    const current = readState();
    setState(current);
    writeState(current);
  }, []);

  const hiddenIds = useMemo(() => new Set(state.ids), [state.ids]);

  const hideForToday = useCallback((insightId: string) => {
    setState((current) => {
      const today = saoPauloDateKey();
      const baseIds = current.dateKey === today ? current.ids : [];
      const ids = baseIds.includes(insightId)
        ? baseIds
        : [...baseIds, insightId];

      const next = { dateKey: today, ids };
      writeState(next);
      return next;
    });
  }, []);

  const isHiddenToday = useCallback(
    (insightId: string) => hiddenIds.has(insightId),
    [hiddenIds],
  );

  return {
    hiddenIds,
    hideForToday,
    isHiddenToday,
  };
}
EOF

python <<'PY'
from pathlib import Path

def once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERRO {label}: esperado 1 ocorrência em {path}, encontrado {count}")
    p.write_text(text.replace(old, new, 1))

# ------------------------------------------------------------------
# Relatórios
# ------------------------------------------------------------------
p = Path("components/reports/ReportIntelligencePanel.tsx")
t = p.read_text()

t = t.replace(
"""  Info,
  type LucideIcon,""",
"""  EyeOff,
  Info,
  type LucideIcon,""",
1,
)

t = t.replace(
"""import { selectOperationalHighlights } from '@/lib/delivery-intelligence';""",
"""import { selectOperationalHighlights } from '@/lib/delivery-intelligence';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';""",
1,
)

t = t.replace(
"""  const [expandedId, setExpandedId] = useState<string | null>(null);

  const highlights = useMemo(
    () =>
      selectOperationalHighlights(snapshot.insights, {
        limit: 4,
        minimumSample: 3,
      }),
    [snapshot.insights],
  );""",
"""  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();

  const highlights = useMemo(
    () =>
      selectOperationalHighlights(
        snapshot.insights.filter((insight) => !hiddenIds.has(insight.id)),
        {
          limit: 4,
          minimumSample: 3,
        },
      ),
    [hiddenIds, snapshot.insights],
  );""",
1,
)

old_expanded = """                    {insight.evidence.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {insight.evidence.map((item) => (
                          <div
                            key={`${insight.id}-${item.label}`}
                            className="rounded-xl bg-zinc-950/55 px-3 py-2.5"
                          >
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs font-black text-zinc-200">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>"""

new_expanded = """                    {insight.evidence.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {insight.evidence.map((item) => (
                          <div
                            key={`${insight.id}-${item.label}`}
                            className="rounded-xl bg-zinc-950/55 px-3 py-2.5"
                          >
                            <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs font-black text-zinc-200">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        hideForToday(insight.id);
                        setExpandedId(null);
                      }}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 text-[10px] font-black text-zinc-500 active:scale-[0.99]"
                    >
                      <EyeOff size={14} />
                      Ocultar por hoje
                    </button>
                  </div>"""

if old_expanded not in t:
    raise SystemExit("ERRO: bloco expandido do ReportIntelligencePanel não encontrado.")
t = t.replace(old_expanded, new_expanded, 1)
p.write_text(t)

# ------------------------------------------------------------------
# Home Radar
# ------------------------------------------------------------------
p = Path("components/home/OperationalRadar.tsx")
t = p.read_text()

t = t.replace(
"""  ChevronRight,
  Info,
  Radar,""",
"""  ChevronRight,
  EyeOff,
  Info,
  Radar,""",
1,
)

t = t.replace(
"""import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';""",
"""import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { useHiddenInsightsToday } from '@/hooks/useHiddenInsightsToday';""",
1,
)

t = t.replace(
"""  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 3,
    highlightLimit: 5,
  });

  const signal = chooseHomeSignal(intelligence.highlights);""",
"""  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 3,
    highlightLimit: 5,
  });
  const { hiddenIds, hideForToday } = useHiddenInsightsToday();

  const visibleHighlights = intelligence.highlights.filter(
    (insight) => !hiddenIds.has(insight.id),
  );
  const signal = chooseHomeSignal(visibleHighlights);""",
1,
)

start = t.find("  return (\n    <button")
if start == -1:
    raise SystemExit("ERRO: retorno do OperationalRadar não encontrado.")

end_marker = "\n    </button>\n  );"
end = t.find(end_marker, start)
if end == -1:
    raise SystemExit("ERRO: fim do OperationalRadar não encontrado.")

new_return = """  return (
    <article
      className={`w-full rounded-[22px] border ${tone.border} ${tone.surface} p-4`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/45 ${tone.text}`}
        >
          <Icon size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => router.push('/loja')}
            className="block w-full text-left active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Radar size={12} className="shrink-0 text-indigo-400" />
                <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                  Radar operacional · {tone.label}
                </p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-zinc-700" />
            </div>

            <p className="mt-2 text-sm font-black leading-snug text-zinc-100">
              {signal.title}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              {signal.summary}
            </p>
            <p className="mt-2 text-[9px] font-bold text-zinc-700">
              Base: {signal.sampleSize} · abrir leitura completa
            </p>
          </button>

          <button
            type="button"
            onClick={() => hideForToday(signal.id)}
            className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 text-[9px] font-black text-zinc-600 active:scale-95"
          >
            <EyeOff size={13} />
            Ocultar por hoje
          </button>
        </div>
      </div>
    </article>
  );"""

t = t[:start] + new_return + t[end + len(end_marker):]
p.write_text(t)

print("Transformações escritas.")
PY

echo
echo "=== DIFF CHECK ==="
git diff --check

echo
echo "=== TYPESCRIPT ==="
rm -rf .next
node ./node_modules/typescript/bin/tsc --noEmit

echo
echo "=== GUARDAS ==="
grep -n -E "Ocultar por hoje|hiddenIds|hideForToday" components/reports/ReportIntelligencePanel.tsx
grep -n -E "Ocultar por hoje|hiddenIds|hideForToday" components/home/OperationalRadar.tsx
grep -n -E "STORAGE_KEY|America/Sao_Paulo|localStorage" hooks/useHiddenInsightsToday.ts

echo
echo "=== DIFF STAT ==="
git diff --stat

echo
echo "=== STATUS TRACKED ==="
git status --short --untracked-files=no

echo
echo "INSIGHTS / OCULTAR POR HOJE APLICADO."
echo "Backup: $BACKUP"
echo "Ainda NÃO foi feito commit nem push."
