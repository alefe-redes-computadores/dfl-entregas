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
