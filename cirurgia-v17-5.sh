#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

ROOT="$HOME/projects/dfl-entregas"
BACKUP_DIR="$HOME/storage/downloads/dfl-entregas-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/v17-5-auto-fastlane-next-stop-$STAMP.tar.gz"

cd "$ROOT"

echo "============================================================"
echo " DFL ENTREGAS V17.5 — AUTO FAST LANE + NEXT STOP CLOCK"
echo "============================================================"
echo "Projeto: $PWD"
echo "HEAD: $(git rev-parse --short HEAD 2>/dev/null || true)"
echo

if [[ "$PWD" != "$HOME/projects/dfl-entregas" ]]; then
  echo "ERRO: caminho incorreto: $PWD"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TOUCHED=(
  "lib/integration/server/reverseOutboxRepository.ts"
  "lib/integration/server/reverseRelay.ts"
  "lib/integration/server/reverseReconciler.ts"
  "app/api/integration/route-kick/route.ts"
  "store/useAppStore.ts"
  "scripts/pre-apk.cjs"
  "scripts/test-v17-3-isolated-reverse-fastlane.cjs"
  "scripts/test-v17-3-r2-recovery-action.cjs"
)

NEW_HELPER="lib/integration/client/routeKick.ts"
NEW_TEST="scripts/test-v17-5-auto-fastlane-next-stop.cjs"

HAD_HELPER=0
HAD_TEST=0
[[ -e "$NEW_HELPER" ]] && HAD_HELPER=1
[[ -e "$NEW_TEST" ]] && HAD_TEST=1

echo "===== PRE-FLIGHT ====="
git diff --check

python - <<'PY'
from pathlib import Path

checks = {
    "lib/integration/server/reverseOutboxRepository.ts": [
        "export async function claimReverseOutboxByEventId",
        "if (data.status === 'processing')",
    ],
    "lib/integration/server/reverseRelay.ts": [
        "export async function drainReverseIntegrationEventIds",
        "claimed: false",
    ],
    "lib/integration/server/reverseReconciler.ts": [
        "function occurredAt(delivery: Raw, route: Raw | undefined)",
        "occurred_at: occurredAt(item.data, route)",
    ],
    "app/api/integration/route-kick/route.ts": [
        "body.routeId",
        "drainReverseIntegrationEventIds",
    ],
    "store/useAppStore.ts": [
        "[route-kick:delivery]",
        "[route-kick:recovery]",
        "startRoute: async (routeId) =>",
    ],
    "scripts/pre-apk.cjs": [
        "verify-site-route-experience-v11.cjs",
    ],
}

for file, needles in checks.items():
    text = Path(file).read_text()
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"PRE-FLIGHT BLOQUEADO: anchor ausente em {file}: {needle}")

print("OK: anchors da V17.3/V17.4/V17.3 R2 encontrados")
PY

BACKUP_FILES=("${TOUCHED[@]}")
[[ -e "$NEW_HELPER" ]] && BACKUP_FILES+=("$NEW_HELPER")
[[ -e "$NEW_TEST" ]] && BACKUP_FILES+=("$NEW_TEST")
tar -czf "$BACKUP" "${BACKUP_FILES[@]}"
echo "Backup: $BACKUP"

rollback() {
  code=$?
  echo
  echo "FALHA detectada; restaurando os arquivos da cirurgia..."
  tar -xzf "$BACKUP" -C "$ROOT"
  [[ "$HAD_HELPER" -eq 0 ]] && rm -f "$NEW_HELPER"
  [[ "$HAD_TEST" -eq 0 ]] && rm -f "$NEW_TEST"
  echo "Restaurado a partir de: $BACKUP"
  exit "$code"
}
trap rollback ERR

mkdir -p "lib/integration/client"

cat > "$NEW_HELPER" <<'EOF'
import { auth } from '@/lib/firebase';

export type RouteKickReason =
  | 'route_started'
  | 'delivery_completed'
  | 'manual_recovery';

type RouteKickRelayResult = {
  ok?: boolean;
  retryable?: number;
  inFlight?: number;
  failed?: number;
  unsettled?: number;
  results?: Array<{
    eventId?: string;
    ok?: boolean;
    state?: string;
    retryable?: boolean;
    error?: string;
  }>;
};

export type RouteKickResult = {
  ok?: boolean;
  routeId?: string;
  reason?: string;
  error?: string;
  relay?: RouteKickRelayResult;
};

type RouteKickOptions = {
  reason: RouteKickReason;
  maxAttempts?: number;
  retryDelayMs?: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

function firstRelayError(result: RouteKickResult | null) {
  return result?.relay?.results?.find((item) => item.ok === false)?.error || '';
}

function shouldRetry(
  status: number,
  result: RouteKickResult | null,
) {
  if (status === 401 || status === 408 || status === 425 || status === 429) {
    return true;
  }

  if (status >= 500) return true;

  return Number(result?.relay?.retryable || 0) > 0;
}

/**
 * Fast lane dirigido da rota.
 *
 * Não cria polling/listener. É uma sequência curta e limitada disparada
 * exclusivamente pela ação operacional atual. O retry existe apenas para
 * absorver corrida com um worker que já tenha reclamado o mesmo eventId ou
 * uma falha transitória do relay.
 */
export async function kickSiteRoute(
  routeId: string,
  options: RouteKickOptions,
): Promise<RouteKickResult> {
  const safeRouteId = routeId.trim();
  if (!safeRouteId) throw new Error('Rota inválida para sincronização do Site.');

  const maxAttempts = Math.max(
    1,
    Math.min(3, Math.trunc(options.maxAttempts ?? 3)),
  );
  const retryDelayMs = Math.max(
    500,
    Math.min(2500, Math.trunc(options.retryDelayMs ?? 900)),
  );

  let lastError = 'Não foi possível sincronizar a rota com o Site.';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Sessão indisponível para sincronizar a rota.');
    }

    const token = await user.getIdToken(attempt > 0);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    let result: RouteKickResult | null = null;
    let retryAllowed = true;

    try {
      response = await fetch('/api/integration/route-kick', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          routeId: safeRouteId,
          reason: options.reason,
        }),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });

      result = await response.json().catch(() => null);

      if (response.ok && result?.ok !== false) {
        return result || {
          ok: true,
          routeId: safeRouteId,
          reason: options.reason,
        };
      }

      lastError =
        result?.error ||
        firstRelayError(result) ||
        `Falha ao sincronizar rota (HTTP ${response.status}).`;

      retryAllowed = shouldRetry(response.status, result);

      if (attempt + 1 >= maxAttempts || !retryAllowed) {
        throw new Error(lastError);
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : 'Falha transitória no fast lane da rota.';

      if (attempt + 1 >= maxAttempts || !retryAllowed) {
        throw new Error(lastError);
      }
    } finally {
      window.clearTimeout(timer);
    }

    await sleep(retryDelayMs * (attempt + 1));
  }

  throw new Error(lastError);
}
EOF

python - <<'PY'
from pathlib import Path
import re

def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: esperado 1 anchor, encontrado {count}")
    p.write_text(text.replace(old, new, 1))

def sub_once(path: str, pattern: str, repl: str):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex esperava 1 ocorrência, encontrou {count}")
    p.write_text(next_text)

# ------------------------------------------------------------------
# 1) Outbox exata: claimed:false deixa de significar sucesso genérico.
#    Failed pode ser retomado imediatamente pelo fast lane humano/operacional.
# ------------------------------------------------------------------
path = "lib/integration/server/reverseOutboxRepository.ts"

replace_once(
    path,
    """type Claimed = {
  refId: string;
  event: IntegrationEventEnvelope;
  attempts: number;
};
""",
    """type Claimed = {
  refId: string;
  event: IntegrationEventEnvelope;
  attempts: number;
};

export type ReverseOutboxState = {
  exists: boolean;
  status: string;
  eventType: string | null;
  attempts: number;
  lockedAt: string | null;
  nextAttemptAt: string | null;
  processedAt: string | null;
  lastError: string | null;
};

export type ReverseOutboxClaimResult =
  | { kind: 'claimed'; item: Claimed }
  | { kind: 'not_claimed'; state: ReverseOutboxState };

function stateFrom(data?: DocumentData): ReverseOutboxState {
  if (!data) {
    return {
      exists: false,
      status: 'missing',
      eventType: null,
      attempts: 0,
      lockedAt: null,
      nextAttemptAt: null,
      processedAt: null,
      lastError: null,
    };
  }

  return {
    exists: true,
    status: String(data.status || 'unknown'),
    eventType: data.event_type ? String(data.event_type) : null,
    attempts: Number(data.attempts || 0),
    lockedAt: data.locked_at ? String(data.locked_at) : null,
    nextAttemptAt: data.next_attempt_at
      ? String(data.next_attempt_at)
      : null,
    processedAt: data.processed_at ? String(data.processed_at) : null,
    lastError: data.last_error ? String(data.last_error) : null,
  };
}
""",
)

replace_once(
    path,
    """function eligible(data: DocumentData, now: number, lockMs: number) {
  if (data.source_system !== 'dfl_entregas') return false;
  if (!REVERSE_EVENT_TYPES.has(String(data.event_type))) return false;
  if (data.status === 'pending') return true;
  if (data.status === 'failed') {
    const next = data.next_attempt_at ? Date.parse(String(data.next_attempt_at)) : 0;
    return !Number.isFinite(next) || next <= now;
  }
  if (data.status === 'processing') {
    const locked = data.locked_at ? Date.parse(String(data.locked_at)) : 0;
    return !Number.isFinite(locked) || locked + lockMs <= now;
  }
  return false;
}
""",
    """function eligible(
  data: DocumentData,
  now: number,
  lockMs: number,
  allowFailedBeforeNextAttempt = false,
) {
  if (data.source_system !== 'dfl_entregas') return false;
  if (!REVERSE_EVENT_TYPES.has(String(data.event_type))) return false;
  if (data.status === 'pending') return true;
  if (data.status === 'failed') {
    if (allowFailedBeforeNextAttempt) return true;
    const next = data.next_attempt_at
      ? Date.parse(String(data.next_attempt_at))
      : 0;
    return !Number.isFinite(next) || next <= now;
  }
  if (data.status === 'processing') {
    const locked = data.locked_at ? Date.parse(String(data.locked_at)) : 0;
    return !Number.isFinite(locked) || locked + lockMs <= now;
  }
  return false;
}
""",
)

sub_once(
    path,
    r"""export async function claimReverseOutboxByEventId\(input: \{.*?\n\}\n\nexport async function markReverseOutboxSent""",
    """export async function claimReverseOutboxByEventId(input: {
  eventId: string;
  workerId: string;
  lockMs: number;
  allowFailedBeforeNextAttempt?: boolean;
}): Promise<ReverseOutboxClaimResult> {
  const ref = adminDb
    .collection(COLLECTION)
    .doc(encodeURIComponent(input.eventId));

  return adminDb.runTransaction(async (tx: Transaction) => {
    const fresh = await tx.get(ref);

    if (!fresh.exists) {
      return {
        kind: 'not_claimed',
        state: stateFrom(),
      };
    }

    const data = fresh.data()!;
    const now = Date.now();

    if (
      !eligible(
        data,
        now,
        input.lockMs,
        input.allowFailedBeforeNextAttempt === true,
      )
    ) {
      return {
        kind: 'not_claimed',
        state: stateFrom(data),
      };
    }

    const attempts = Number(data.attempts || 0) + 1;

    tx.update(ref, {
      status: 'processing',
      attempts,
      locked_by: input.workerId,
      locked_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      last_error: FieldValue.delete(),
    });

    return {
      kind: 'claimed',
      item: {
        refId: ref.id,
        event: eventFrom(data),
        attempts,
      },
    };
  });
}

export async function markReverseOutboxSent""",
)

# ------------------------------------------------------------------
# 2) Relay dirigido: sent é sucesso; processing/failed/dead/missing
#    passam a ser estados explícitos. Fast lane pode furar backoff de failed.
# ------------------------------------------------------------------
path = "lib/integration/server/reverseRelay.ts"

sub_once(
    path,
    r"""export async function drainReverseIntegrationEventIds\(\n  eventIds: string\[],\n\) \{.*?\n\}\s*$""",
    """export async function drainReverseIntegrationEventIds(
  eventIds: string[],
) {
  const config = assertReverseRelayConfigured();
  const workerId = `reverse-fastlane-${randomUUID()}`;

  const uniqueIds = [
    ...new Set(
      eventIds
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);

  const results: Array<{
    eventId: string;
    claimed: boolean;
    ok: boolean;
    state: string;
    retryable: boolean;
    attempts?: number;
    status?: number;
    lockedAt?: string | null;
    nextAttemptAt?: string | null;
    processedAt?: string | null;
    error?: string;
  }> = [];

  for (const eventId of uniqueIds) {
    const claim = await claimReverseOutboxByEventId({
      eventId,
      workerId,
      lockMs: config.lockMs,
      // Uma ação humana/operacional explícita não precisa aguardar o
      // backoff do recovery global para tentar novamente um evento failed.
      allowFailedBeforeNextAttempt: true,
    });

    if (claim.kind === 'not_claimed') {
      const state = claim.state;
      const alreadySent = state.status === 'sent';
      const retryable =
        state.status === 'processing' ||
        state.status === 'failed' ||
        state.status === 'pending';

      results.push({
        eventId,
        claimed: false,
        ok: alreadySent,
        state: state.status,
        retryable,
        attempts: state.attempts,
        lockedAt: state.lockedAt,
        nextAttemptAt: state.nextAttemptAt,
        processedAt: state.processedAt,
        ...(
          alreadySent
            ? {}
            : {
                error:
                  state.lastError ||
                  `Evento não disponível para claim: ${state.status}.`,
              }
        ),
      });
      continue;
    }

    const item = claim.item;

    try {
      const response = await sendOne(item.event, config);
      await markReverseOutboxSent(item.refId);

      results.push({
        eventId,
        claimed: true,
        ok: true,
        state: 'sent',
        retryable: false,
        attempts: item.attempts,
        status: response.status,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha desconhecida no fast lane reverso.';
      const dead = item.attempts >= config.maxAttempts;

      await markReverseOutboxFailed({
        refId: item.refId,
        attempts: item.attempts,
        error: message,
        maxAttempts: config.maxAttempts,
      });

      results.push({
        eventId,
        claimed: true,
        ok: false,
        state: dead ? 'dead_letter' : 'failed',
        retryable: !dead,
        attempts: item.attempts,
        error: message,
      });
    }
  }

  return {
    ok: results.every((item) => item.ok),
    requested: uniqueIds.length,
    claimed: results.filter((item) => item.claimed).length,
    sent: results.filter(
      (item) => item.claimed && item.ok,
    ).length,
    alreadySent: results.filter(
      (item) => !item.claimed && item.state === 'sent',
    ).length,
    inFlight: results.filter(
      (item) => item.state === 'processing',
    ).length,
    retryable: results.filter(
      (item) => !item.ok && item.retryable,
    ).length,
    failed: results.filter(
      (item) =>
        !item.ok &&
        item.state !== 'processing',
    ).length,
    unsettled: results.filter((item) => !item.ok).length,
    results,
  };
}
""",
)

# ------------------------------------------------------------------
# 3) Clock semântico: next_stop/position_changed usam a última mudança
#    real da rota, inclusive completed_at da parada anterior.
# ------------------------------------------------------------------
path = "lib/integration/server/reverseReconciler.ts"

replace_once(
    path,
    """function occurredAt(delivery: Raw, route: Raw | undefined) {
  const candidates = [
    str(delivery.completed_at), str(delivery.order_updated_at), str(delivery.updated_at),
    str(route?.end_time), str(route?.updated_at), str(route?.started_at), str(route?.departure_time),
  ].filter(Boolean);
  const valid = candidates.map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time)).sort((a, b) => b.time - a.time);
  return valid[0]?.value || new Date().toISOString();
}
""",
    """function occurredAt(delivery: Raw, route: Raw | undefined) {
  const candidates = [
    str(delivery.completed_at), str(delivery.order_updated_at), str(delivery.updated_at),
    str(route?.end_time), str(route?.updated_at), str(route?.started_at), str(route?.departure_time),
  ].filter(Boolean);
  const valid = candidates.map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time)).sort((a, b) => b.time - a.time);
  return valid[0]?.value || new Date().toISOString();
}

function latestIso(values: string[]) {
  const valid = values
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);

  return valid[0]?.value || '';
}

function routeMovementAt(
  routeItems: Item[],
  route: Raw | undefined,
) {
  return latestIso([
    ...routeItems.flatMap((item) => [
      str(item.data.completed_at),
      str(item.data.order_updated_at),
      str(item.data.updated_at),
    ]),
    str(route?.end_time),
    str(route?.updated_at),
    str(route?.started_at),
    str(route?.departure_time),
  ]);
}

function eventOccurredAt(
  type: string,
  delivery: Raw,
  route: Raw | undefined,
  routeItems: Item[],
) {
  if (type === 'delivery.out_for_delivery') {
    return (
      str(route?.started_at) ||
      str(route?.departure_time) ||
      occurredAt(delivery, route)
    );
  }

  if (type === 'delivery.completed') {
    return str(delivery.completed_at) || occurredAt(delivery, route);
  }

  if (
    type === 'delivery.next_stop' ||
    type === 'delivery.position_changed'
  ) {
    return (
      routeMovementAt(routeItems, route) ||
      occurredAt(delivery, route)
    );
  }

  if (type === 'route.completed') {
    return (
      str(route?.end_time) ||
      str(route?.updated_at) ||
      occurredAt(delivery, route)
    );
  }

  return occurredAt(delivery, route);
}
""",
)

replace_once(
    path,
    """          event_id: eventId, event_type: type, occurred_at: occurredAt(item.data, route),
""",
    """          event_id: eventId, event_type: type, occurred_at: eventOccurredAt(type, item.data, route, routeItems),
""",
)

# ------------------------------------------------------------------
# 4) Route kick recebe origem da ação e usa 207 quando há evento não assentado.
# ------------------------------------------------------------------
path = "app/api/integration/route-kick/route.ts"

replace_once(
    path,
    """  let routeId = '';

  try {
    const body = await req.json() as { routeId?: unknown };
    routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
  } catch {
    routeId = '';
  }
""",
    """  let routeId = '';
  let reason = 'unspecified';

  try {
    const body = await req.json() as {
      routeId?: unknown;
      reason?: unknown;
    };
    routeId = typeof body.routeId === 'string' ? body.routeId.trim() : '';
    reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 64)
        : 'unspecified';
  } catch {
    routeId = '';
    reason = 'unspecified';
  }
""",
)

replace_once(
    path,
    """    const result = {
      ok: reconciliation.ok && relay.ok,
      routeId,
      reconciliation,
      relay,
    };
""",
    """    const result = {
      ok: reconciliation.ok && relay.ok,
      routeId,
      reason,
      reconciliation,
      relay,
    };
""",
)

replace_once(
    path,
    """        routeId,
        siteDeliveries: reconciliation.siteDeliveries,
""",
    """        routeId,
        reason,
        siteDeliveries: reconciliation.siteDeliveries,
""",
)

replace_once(
    path,
    """        failed: relay.failed,
      }),
    );

    return NextResponse.json(result);
""",
    """        failed: relay.failed,
        inFlight: relay.inFlight,
        retryable: relay.retryable,
        unsettled: relay.unsettled,
      }),
    );

    return NextResponse.json(
      result,
      { status: result.ok ? 200 : 207 },
    );
""",
)

# ------------------------------------------------------------------
# 5) Store usa um único cliente de fast lane com retry curto e feedback.
# ------------------------------------------------------------------
path = "store/useAppStore.ts"

replace_once(
    path,
    """import { buildSmartRouteOrder, deliveryPoint } from '@/lib/route-intelligence';
""",
    """import { buildSmartRouteOrder, deliveryPoint } from '@/lib/route-intelligence';
import { kickSiteRoute } from '@/lib/integration/client/routeKick';
""",
)

sub_once(
    path,
    r"""        if \(routeStartedAt\(current\)\) \{.*?\n        \}\n\n        const now = new Date\(\)\.toISOString\(\);""",
    """        if (routeStartedAt(current)) {
          const result = await kickSiteRoute(routeId, {
            reason: 'manual_recovery',
            maxAttempts: 3,
          });

          console.info(
            '[route-kick:recovery] fast lane concluída',
            result,
          );

          return;
        }

        const now = new Date().toISOString();""",
)

sub_once(
    path,
    r"""          /\*\n           \* Fast lane reverso:.*?\n          \}\n\n          const stops =""",
    """          /*
           * Fast lane reverso:
           *
           * A persistência da rota é autoridade local. A sincronização com o
           * Site acontece logo depois e possui retry curto/event-driven.
           * Se ainda falhar, a rota NÃO volta atrás: o operador recebe
           * feedback visível e o botão "Sincronizar Site" permanece como
           * recuperação manual.
           */
          try {
            const result = await kickSiteRoute(routeId, {
              reason: 'route_started',
              maxAttempts: 3,
            });

            console.info(
              '[route-kick] fast lane concluída',
              result,
            );
          } catch (kickError) {
            console.warn(
              '[route-kick] falhou; fallback periódico preservado',
              kickError,
            );
            toast.warning('Rota iniciada; Site aguardando sincronização.', {
              description:
                'A saída foi salva. Se o aviso não aparecer no Site, use Sincronizar Site.',
              duration: 5000,
            });
          }

          const stops =""",
)

sub_once(
    path,
    r"""          /\*\n           \* Mudança logística real:.*?\n          \}\n\n          if \(routeChanged && previousRouteId\) \{""",
    """          /*
           * Mudança logística real:
           * após persistir a conclusão, acordamos SOMENTE a rota dessa
           * delivery. O mesmo kick materializa delivery.completed e a nova
           * posição/next_stop das demais paradas.
           *
           * O retry é curto e dirigido; não existe listener nem polling.
           * Se ainda falhar, a baixa permanece válida e o operador recebe
           * feedback em vez de um erro silencioso de console.
           */
          if (
            isCompleting &&
            isDeliveryFulfillment(nextDelivery) &&
            nextDelivery.route_id
          ) {
            try {
              const result = await kickSiteRoute(nextDelivery.route_id, {
                reason: 'delivery_completed',
                maxAttempts: 3,
              });

              console.info(
                '[route-kick:delivery] fast lane concluída',
                result,
              );
            } catch (kickError) {
              console.warn(
                '[route-kick:delivery] falhou; fallback periódico preservado',
                kickError,
              );
              toast.warning(
                'Entrega concluída; Site aguardando sincronização.',
                {
                  description:
                    'A baixa foi salva. Use Sincronizar Site na rota se a atualização não aparecer.',
                  duration: 5000,
                },
              );
            }
          }

          if (routeChanged && previousRouteId) {""",
)

# ------------------------------------------------------------------
# 6) Contratos V17.3 acompanham o helper único sem perder as garantias.
# ------------------------------------------------------------------
path = "scripts/test-v17-3-isolated-reverse-fastlane.cjs"
replace_once(
    path,
    """ok(
  store.includes("routeId: nextDelivery.route_id"),
  "conclusão não envia routeId exato",
);
""",
    """ok(
  store.includes("kickSiteRoute(nextDelivery.route_id"),
  "conclusão não envia routeId exato",
);
""",
)

path = "scripts/test-v17-3-r2-recovery-action.cjs"
replace_once(
    path,
    """const store = fs.readFileSync("store/useAppStore.ts", "utf8");
const route = fs.readFileSync(
""",
    """const store = fs.readFileSync("store/useAppStore.ts", "utf8");
const helper = fs.readFileSync(
  "lib/integration/client/routeKick.ts",
  "utf8",
);
const route = fs.readFileSync(
""",
)
replace_once(
    path,
    """ok(
  store.includes("body: JSON.stringify({ routeId })"),
  "recovery não é dirigido pela própria rota",
);
""",
    """ok(
  store.includes("reason: 'manual_recovery'") &&
    helper.includes("routeId: safeRouteId"),
  "recovery não é dirigido pela própria rota",
);
""",
)

# ------------------------------------------------------------------
# 7) Pre-APK passa a carregar o contrato novo.
# ------------------------------------------------------------------
path = "scripts/pre-apk.cjs"
replace_once(
    path,
    """  'scripts/verify-site-route-experience-v11.cjs',
""",
    """  'scripts/verify-site-route-experience-v11.cjs',
  'scripts/test-v17-5-auto-fastlane-next-stop.cjs',
""",
)

print("OK: cirurgia V17.5 aplicada nos arquivos")
PY

cat > "$NEW_TEST" <<'EOF'
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const ok = (value, message) => {
  if (!value) throw new Error(`V17.5: ${message}`);
};

const outbox = read('lib/integration/server/reverseOutboxRepository.ts');
const relay = read('lib/integration/server/reverseRelay.ts');
const reconciler = read('lib/integration/server/reverseReconciler.ts');
const routeKick = read('app/api/integration/route-kick/route.ts');
const helper = read('lib/integration/client/routeKick.ts');
const store = read('store/useAppStore.ts');

ok(
  outbox.includes('allowFailedBeforeNextAttempt?: boolean'),
  'claim exato não permite retry operacional de failed',
);
ok(
  outbox.includes("kind: 'not_claimed'") &&
    outbox.includes('state: stateFrom(data)'),
  'claim exato ainda perde o estado real da outbox',
);
ok(
  relay.includes('allowFailedBeforeNextAttempt: true'),
  'fast lane ainda obedece cegamente o backoff do recovery',
);
ok(
  relay.includes("state.status === 'sent'") &&
    relay.includes("state.status === 'processing'"),
  'relay não distingue sent de processing',
);
ok(
  relay.includes('unsettled: results.filter((item) => !item.ok).length'),
  'relay não expõe eventos ainda não assentados',
);
ok(
  !relay.includes("claimed: false,\n        ok: true,"),
  'claimed:false ainda vira sucesso genérico',
);

ok(
  reconciler.includes('function routeMovementAt('),
  'relógio de movimento da rota ausente',
);
ok(
  reconciler.includes('...routeItems.flatMap((item) => [') &&
    reconciler.includes('str(item.data.completed_at)'),
  'next_stop não considera conclusão da parada anterior',
);
ok(
  reconciler.includes("type === 'delivery.next_stop'") &&
    reconciler.includes("type === 'delivery.position_changed'"),
  'posição e next_stop não possuem relógio semântico',
);
ok(
  reconciler.includes(
    'occurred_at: eventOccurredAt(type, item.data, route, routeItems)',
  ),
  'evento reverso ainda usa relógio antigo da própria delivery',
);
ok(
  reconciler.includes("type === 'delivery.out_for_delivery'") &&
    reconciler.includes("str(route?.started_at)"),
  'saída da rota perdeu identidade temporal estável',
);

ok(
  routeKick.includes("let reason = 'unspecified'"),
  'route-kick não identifica origem operacional',
);
ok(
  routeKick.includes('{ status: result.ok ? 200 : 207 }'),
  'route-kick ainda mascara fast lane incompleto como 200',
);
ok(
  routeKick.includes('inFlight: relay.inFlight') &&
    routeKick.includes('retryable: relay.retryable'),
  'diagnóstico do route-kick não expõe corrida/retry',
);

ok(
  helper.includes("reason: RouteKickReason") &&
    helper.includes("cache: 'no-store'"),
  'cliente do fast lane não possui contrato dirigido/no-store',
);
ok(
  helper.includes('getIdToken(attempt > 0)'),
  'retry não renova token',
);
ok(
  helper.includes('Math.min(3') &&
    !helper.includes('setInterval(') &&
    !helper.includes('onSnapshot('),
  'retry precisa ser limitado e event-driven',
);

ok(
  store.includes("reason: 'manual_recovery'"),
  'botão manual não usa o mesmo cliente',
);
ok(
  store.includes("reason: 'route_started'"),
  'início da rota não usa o cliente robusto',
);
ok(
  store.includes("reason: 'delivery_completed'"),
  'conclusão não acorda a rota automaticamente',
);
ok(
  store.includes('Entrega concluída; Site aguardando sincronização.'),
  'falha automática continua invisível ao operador',
);
ok(
  store.includes('Rota iniciada; Site aguardando sincronização.'),
  'falha na saída continua invisível ao operador',
);

console.log('============================================================');
console.log(' V17.5 AUTO FAST LANE + NEXT STOP — ZERO ERROS');
console.log('============================================================');
console.log('✓ claimed:false não mascara processing/failed/dead');
console.log('✓ failed pode ser reprocessado no fast lane dirigido');
console.log('✓ retry curto, dirigido e sem polling/listener');
console.log('✓ saída mantém clock estável da rota');
console.log('✓ next_stop usa a última mudança logística da rota');
console.log('✓ conclusão acorda completed + nova próxima parada');
console.log('✓ falha automática gera feedback operacional');
EOF

echo
echo "===== TESTES V17.5 ====="
node "$NEW_TEST"

echo
echo "===== CONTRATOS DE INTEGRAÇÃO EXISTENTES ====="
node scripts/test-v17-3-isolated-reverse-fastlane.cjs
node scripts/test-v17-3-r2-recovery-action.cjs
node scripts/test-v17-4-status-recovery.cjs

echo
echo "===== PRE-APK ====="
node scripts/pre-apk.cjs

echo
echo "===== TYPESCRIPT ====="
node node_modules/typescript/bin/tsc --noEmit

echo
echo "===== GIT DIFF CHECK ====="
git diff --check

echo
echo "===== RESUMO DO DIFF ====="
git status --short
git diff --stat

trap - ERR

echo
echo "============================================================"
echo " V17.5 AUTO FAST LANE + NEXT STOP — ZERO ERROS"
echo "============================================================"
echo "✓ route-kick automático usa cliente único com retry curto"
echo "✓ token é renovado nos retries"
echo "✓ failed pode ser retomado imediatamente pelo fast lane"
echo "✓ processing/dead/missing deixam de parecer sucesso"
echo "✓ next_stop usa completed_at da parada anterior como relógio"
echo "✓ out_for_delivery continua idempotente e preso à saída real"
echo "✓ erro automático fica visível sem desfazer a baixa"
echo "✓ nenhum listener novo"
echo "✓ nenhum polling novo"
echo "✓ TypeScript, PRE-APK e git diff validados"
echo "Backup: $BACKUP"
echo "Nenhum build, commit ou push foi executado."
