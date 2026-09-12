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
