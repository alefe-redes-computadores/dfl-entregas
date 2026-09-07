import type { Customer, Delivery, Route } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import {
  compareDateKeys,
  dateFromKey,
  enumerateDateKeys,
  formatReportDate,
  parseTimestamp,
  saoPauloDateKey,
  saoPauloHour,
  shiftDateKey,
  todayKey,
  weekdayIndexFromKey,
} from './time';
import type {
  DataQualityIssue,
  DailyBucket,
  ReportBucket,
  ReportDelivery,
  ReportModel,
  ReportPeriod,
  ReportPeriodKey,
  RouteTimingRow,
} from './types';

const PERIOD_DAYS: Partial<Record<ReportPeriodKey, number>> = {
  today: 1,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const PERIOD_LABELS: Record<ReportPeriodKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '14d': 'Últimos 14 dias',
  '30d': 'Últimos 30 dias',
  all: 'Todo período',
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function money(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function deliveryTimestamp(delivery: Delivery): Date | null {
  // Regra de auditoria: edição NÃO transforma pedido antigo em pedido recente.
  return parseTimestamp(delivery.created_at ?? delivery.createdAt);
}

function normalizeOrigin(delivery: Delivery): ReportDelivery['originLabel'] {
  const raw = (delivery as Delivery & { origin?: string }).origin;
  if (raw === 'ifood') return 'iFood';
  if (raw === 'loja') return 'Loja';
  return 'Origem não registrada';
}

function normalizePayment(delivery: Delivery): string {
  const raw = (delivery as Delivery & { payment_method?: string }).payment_method;
  const map: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao: 'Cartão',
    cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito',
  };
  return raw ? (map[raw] ?? raw) : 'Não informado';
}

function normalizeNeighborhood(customer: Customer | null): string | null {
  const value = customer?.neighborhood?.trim();
  return value ? value : null;
}

function buildPeriod(
  key: ReportPeriodKey,
  normalized: ReportDelivery[],
): ReportPeriod {
  const endKey = todayKey();
  const days = PERIOD_DAYS[key];

  if (days) {
    const startKey = shiftDateKey(endKey, -(days - 1));
    const previousEndKey = shiftDateKey(startKey, -1);
    const previousStartKey = shiftDateKey(previousEndKey, -(days - 1));

    return {
      key,
      label: PERIOD_LABELS[key],
      start: dateFromKey(startKey),
      end: dateFromKey(endKey),
      previousStart: dateFromKey(previousStartKey),
      previousEnd: dateFromKey(previousEndKey),
    };
  }

  const validKeys = normalized
    .map((item) => item.reportDateKey)
    .filter((value): value is string => Boolean(value))
    .sort(compareDateKeys);

  return {
    key,
    label: PERIOD_LABELS[key],
    start: validKeys[0] ? dateFromKey(validKeys[0]) : null,
    end: dateFromKey(endKey),
    previousStart: null,
    previousEnd: null,
  };
}

function inPeriod(item: ReportDelivery, start: Date | null, end: Date): boolean {
  if (!item.reportDateKey) return false;
  if (!start) return true;

  const startKey = saoPauloDateKey(start);
  const endKey = saoPauloDateKey(end);

  return (
    compareDateKeys(item.reportDateKey, startKey) >= 0 &&
    compareDateKeys(item.reportDateKey, endKey) <= 0
  );
}

function variation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function aggregate(
  deliveries: ReportDelivery[],
  getKey: (delivery: ReportDelivery) => string | null,
  getLabel?: (key: string) => string,
): ReportBucket[] {
  const map = new Map<string, { count: number; revenue: number }>();

  deliveries.forEach((delivery) => {
    const key = getKey(delivery);
    if (!key) return;

    const current = map.get(key) ?? { count: 0, revenue: 0 };
    map.set(key, {
      count: current.count + 1,
      revenue: current.revenue + money(delivery.value),
    });
  });

  return Array.from(map.entries()).map(([key, value]) => ({
    key,
    label: getLabel ? getLabel(key) : key,
    count: value.count,
    revenue: Number(value.revenue.toFixed(2)),
  }));
}

function buildDaily(
  deliveries: ReportDelivery[],
  period: ReportPeriod,
): DailyBucket[] {
  const valid = deliveries.filter(
    (delivery): delivery is ReportDelivery & { reportDateKey: string } =>
      Boolean(delivery.reportDateKey),
  );

  let dateKeys: string[] = [];

  if (period.start) {
    dateKeys = enumerateDateKeys(
      saoPauloDateKey(period.start),
      saoPauloDateKey(period.end),
    );
  } else {
    dateKeys = Array.from(
      new Set(valid.map((delivery) => delivery.reportDateKey)),
    ).sort(compareDateKeys);
  }

  const byDate = new Map<string, { count: number; revenue: number }>();
  valid.forEach((delivery) => {
    const current = byDate.get(delivery.reportDateKey) ?? {
      count: 0,
      revenue: 0,
    };
    byDate.set(delivery.reportDateKey, {
      count: current.count + 1,
      revenue: current.revenue + money(delivery.value),
    });
  });

  return dateKeys.map((dateKey) => {
    const current = byDate.get(dateKey) ?? { count: 0, revenue: 0 };
    const date = dateFromKey(dateKey);
    return {
      key: dateKey,
      dateKey,
      label: formatReportDate(date),
      count: current.count,
      revenue: Number(current.revenue.toFixed(2)),
    };
  });
}

function buildWeekdays(
  deliveries: ReportDelivery[],
  period: ReportPeriod,
): ReportBucket[] {
  const counts = Array.from({ length: 7 }, () => ({
    count: 0,
    revenue: 0,
    occurrences: 0,
  }));

  deliveries.forEach((delivery) => {
    if (!delivery.reportDateKey) return;
    const index = weekdayIndexFromKey(delivery.reportDateKey);
    counts[index].count += 1;
    counts[index].revenue += money(delivery.value);
  });

  let dateKeys: string[];
  if (period.start) {
    dateKeys = enumerateDateKeys(
      saoPauloDateKey(period.start),
      saoPauloDateKey(period.end),
    );
  } else {
    dateKeys = Array.from(
      new Set(
        deliveries
          .map((delivery) => delivery.reportDateKey)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  dateKeys.forEach((dateKey) => {
    counts[weekdayIndexFromKey(dateKey)].occurrences += 1;
  });

  return counts.map((item, index) => ({
    key: String(index),
    label: WEEKDAY_LABELS[index],
    count: item.count,
    revenue: Number(item.revenue.toFixed(2)),
    average:
      item.occurrences > 0
        ? Number((item.count / item.occurrences).toFixed(2))
        : 0,
    sampleSize: item.occurrences,
  }));
}

function buildRouteTimings(
  routes: Route[],
  deliveries: ReportDelivery[],
): { trusted: RouteTimingRow[]; suspicious: number } {
  const deliveryRouteIds = new Set(deliveries.map((delivery) => delivery.route_id));
  const trusted: RouteTimingRow[] = [];
  let suspicious = 0;

  routes.forEach((route) => {
    if (!deliveryRouteIds.has(route.id)) return;
    if (route.status !== 'fechada') return;

    const start = parseTimestamp(route.started_at ?? route.departure_time);
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
    }

    trusted.push({
      routeId: route.id,
      routeName: route.name || route.id,
      motoboyName: route.motoboy_name || 'Não atribuído',
      durationMinutes: Number(durationMinutes.toFixed(1)),
      deliveryCount: deliveries.filter(
        (delivery) => delivery.route_id === route.id,
      ).length,
    });
  });

  return { trusted, suspicious };
}

function buildQuality(
  deliveries: ReportDelivery[],
  suspiciousRoutes: number,
): DataQualityIssue[] {
  const missingDate = deliveries.filter((delivery) => !delivery.reportDate).length;
  const missingOrigin = deliveries.filter(
    (delivery) => delivery.originLabel === 'Origem não registrada',
  ).length;
  const missingPayment = deliveries.filter(
    (delivery) => delivery.paymentLabel === 'Não informado',
  ).length;
  const missingNeighborhood = deliveries.filter(
    (delivery) => !delivery.neighborhood,
  ).length;
  const missingRoute = deliveries.filter((delivery) => !delivery.route).length;

  return [
    {
      key: 'missing-date',
      label: 'Sem timestamp de criação',
      count: missingDate,
      description:
        'Não entram em métricas temporais. Continuam preservados no banco; nenhuma data é inventada.',
    },
    {
      key: 'missing-origin',
      label: 'Origem não registrada',
      count: missingOrigin,
      description:
        'Não são convertidos silenciosamente para iFood ou Loja.',
    },
    {
      key: 'missing-payment',
      label: 'Pagamento não informado',
      count: missingPayment,
      description: 'Ficam visíveis como não informados no relatório financeiro.',
    },
    {
      key: 'missing-neighborhood',
      label: 'Bairro sem cobertura cadastral',
      count: missingNeighborhood,
      description:
        'O relatório não tenta descobrir o bairro usando o último hífen do endereço.',
    },
    {
      key: 'missing-route',
      label: 'Entrega sem rota vinculada',
      count: missingRoute,
      description:
        'Conta em volume e financeiro quando os demais dados são válidos, mas não em análises de rota.',
    },
    {
      key: 'suspicious-route-time',
      label: 'Rota com duração não confiável',
      count: suspiciousRoutes,
      description:
        'Continua contando em volume e faturamento, mas não entra em duração ou eficiência temporal.',
    },
  ];
}

export function buildReportModel(input: {
  deliveries: Delivery[];
  routes: Route[];
  customers: Customer[];
  periodKey: ReportPeriodKey;
}): ReportModel {
  const routeMap = new Map(input.routes.map((route) => [route.id, route]));
  const customerMap = new Map(
    input.customers.map((customer) => [customer.id, customer]),
  );

  const normalized: ReportDelivery[] = input.deliveries.map((delivery) => {
    const reportDate = deliveryTimestamp(delivery);
    const customer = customerMap.get(delivery.customer_id) ?? null;

    return {
      ...delivery,
      reportDate,
      reportDateKey: reportDate ? saoPauloDateKey(reportDate) : null,
      reportHour: reportDate ? saoPauloHour(reportDate) : null,
      route: routeMap.get(delivery.route_id) ?? null,
      customer,
      neighborhood: normalizeNeighborhood(customer),
      originLabel: normalizeOrigin(delivery),
      paymentLabel: normalizePayment(delivery),
    };
  });

  const period = buildPeriod(input.periodKey, normalized);

  // Itens sem data não são incluídos em filtros temporais. Em "Todo período",
  // eles continuam nas métricas não temporais para que não desapareçam.
  const current =
    input.periodKey === 'all'
      ? normalized
      : normalized.filter((delivery) =>
          inPeriod(delivery, period.start, period.end),
        );

  const previous =
    period.previousStart && period.previousEnd
      ? normalized.filter((delivery) =>
          inPeriod(delivery, period.previousStart, period.previousEnd as Date),
        )
      : [];

  const currentRevenue = current.reduce(
    (sum, delivery) => sum + money(delivery.value),
    0,
  );
  const previousRevenue = previous.reduce(
    (sum, delivery) => sum + money(delivery.value),
    0,
  );

  const daily = buildDaily(
    current.filter((delivery) => Boolean(delivery.reportDate)),
    period,
  );

  const payments = aggregate(current, (delivery) => delivery.paymentLabel).sort(
    (a, b) => b.count - a.count,
  );
  const origins = aggregate(current, (delivery) => delivery.originLabel).sort(
    (a, b) => b.count - a.count,
  );
  const hours = aggregate(
    current,
    (delivery) =>
      delivery.reportHour == null ? null : String(delivery.reportHour),
    (key) => `${String(Number(key)).padStart(2, '0')}h`,
  ).sort((a, b) => Number(a.key) - Number(b.key));

  const weekdays = buildWeekdays(current, period);

  const logisticsCurrent = current.filter((delivery) => isDeliveryFulfillment(delivery));

  const neighborhoods = aggregate(
    logisticsCurrent,
    (delivery) => delivery.neighborhood,
  ).sort((a, b) => b.count - a.count);

  const motoboys = aggregate(
    logisticsCurrent,
    (delivery) => delivery.route?.motoboy_name?.trim() || 'Não atribuído',
  ).sort((a, b) => b.count - a.count);

  const routeTiming = buildRouteTimings(input.routes, logisticsCurrent);

  return {
    period,
    deliveries: current,
    previousDeliveries: previous,
    metrics: {
      totalDeliveries: current.length,
      totalRevenue: Number(currentRevenue.toFixed(2)),
      averageTicket:
        current.length > 0
          ? Number((currentRevenue / current.length).toFixed(2))
          : 0,
      deliveryVariation:
        period.key === 'all'
          ? null
          : variation(current.length, previous.length),
      revenueVariation:
        period.key === 'all'
          ? null
          : variation(currentRevenue, previousRevenue),
      validDateCount: current.filter((delivery) => delivery.reportDate).length,
      ignoredDateCount: current.filter((delivery) => !delivery.reportDate).length,
    },
    dailyVolume: daily,
    dailyRevenue: daily,
    payments,
    origins,
    hours,
    weekdays,
    neighborhoods,
    motoboys,
    routeTimings: routeTiming.trusted,
    quality: buildQuality(logisticsCurrent, routeTiming.suspicious),
  };
}
