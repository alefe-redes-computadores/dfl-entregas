// lib/stock-intelligence.ts
import type { StockMovement, StockProduct } from '@/types';
import { purchaseSuggestion, replenishmentTarget } from '@/lib/stock';

export type StockRecommendationConfidence = 'baixa' | 'media' | 'alta';

export interface StockRecommendation {
  productId: string;
  configuredQuantity: number;
  recommendedQuantity: number;
  targetQuantity: number;
  averageDailyConsumption: number;

  // Compatibilidade: continua sendo "dias até zerar", mas fica secundário.
  coverageDays: number | null;

  // Métrica operacional principal.
  daysUntilMinimum: number | null;
  minimumReached: boolean;

  consumptionEvents: number;
  distinctConsumptionDays: number;
  observedDays: number;
  confidence: StockRecommendationConfidence;
  usesHistory: boolean;
  dataQuality: 'ok' | 'sem_consumo' | 'sem_alerta';
  explanation: string;
}

const DAY = 86_400_000;
const LOOKBACK_DAYS = 30;
const SAFETY_BUFFER_DAYS = 3;

const validDate = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

const normalizeReason = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

const isOperationalConsumption = (movement: StockMovement) => {
  // Saída real de operação. Perda é tratada à parte em relatórios e não
  // representa demanda normal. Contagem/ajuste também não entram.
  if (movement.type !== 'saida') return false;

  // Entradas revertidas de compras usam supply_id e não podem virar consumo.
  if (movement.supply_id) return false;

  const reason = normalizeReason(movement.reason);
  if (
    /estorno|revers|correc|ajuste|contagem|saldo inicial/.test(reason)
  ) {
    return false;
  }

  return movement.quantity > 0;
};

const consumptionMovements = (
  movements: StockMovement[],
  productId: string,
  now: Date,
) => {
  const start = now.getTime() - LOOKBACK_DAYS * DAY;

  return movements
    .filter((movement) => {
      if (movement.product_id !== productId) return false;
      if (!isOperationalConsumption(movement)) return false;

      const date = validDate(movement.occurred_at);
      return Boolean(
        date &&
          date.getTime() >= start &&
          date.getTime() <= now.getTime(),
      );
    })
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() -
        new Date(b.occurred_at).getTime(),
    );
};

const rateForWindow = (
  events: StockMovement[],
  now: Date,
  days: number,
) => {
  const start = now.getTime() - days * DAY;
  const total = events
    .filter(
      (movement) =>
        new Date(movement.occurred_at).getTime() >= start,
    )
    .reduce((sum, movement) => sum + movement.quantity, 0);

  return total / days;
};

const weightedDailyRate = (
  events: StockMovement[],
  now: Date,
) => {
  // Mais peso ao comportamento recente, sem abandonar a tendência do mês.
  const r7 = rateForWindow(events, now, 7);
  const r14 = rateForWindow(events, now, 14);
  const r30 = rateForWindow(events, now, 30);

  return r7 * 0.55 + r14 * 0.3 + r30 * 0.15;
};

export function buildStockRecommendation(
  product: StockProduct,
  movements: StockMovement[],
  now = new Date(),
): StockRecommendation {
  const configuredQuantity = purchaseSuggestion(product);
  const configuredTarget = replenishmentTarget(product);
  const events = consumptionMovements(
    movements,
    product.id,
    now,
  );

  const minimumReached =
    product.current_quantity <= product.minimum_quantity;

  if (events.length === 0) {
    return {
      productId: product.id,
      configuredQuantity,
      recommendedQuantity: configuredQuantity,
      targetQuantity: configuredTarget,
      averageDailyConsumption: 0,
      coverageDays: null,
      daysUntilMinimum: minimumReached ? 0 : null,
      minimumReached,
      consumptionEvents: 0,
      distinctConsumptionDays: 0,
      observedDays: 0,
      confidence: 'baixa',
      usesHistory: false,
      dataQuality:
        product.minimum_quantity <= 0
          ? 'sem_alerta'
          : 'sem_consumo',
      explanation:
        product.minimum_quantity <= 0
          ? 'Sem nível mínimo configurado. A reposição usa apenas a meta cadastrada.'
          : minimumReached
            ? 'O estoque já atingiu o mínimo configurado. Sem saídas operacionais suficientes para estimar ritmo.'
            : 'Ainda sem saídas operacionais suficientes; mantendo a regra configurada.',
    };
  }

  const first = validDate(events[0]?.occurred_at)!;
  const observedDays = Math.max(
    1,
    Math.min(
      LOOKBACK_DAYS,
      Math.ceil(
        (now.getTime() - first.getTime()) / DAY,
      ) + 1,
    ),
  );

  const distinctConsumptionDays = new Set(
    events.map(
      (movement) =>
        validDate(movement.occurred_at)!
          .toISOString()
          .slice(0, 10),
    ),
  ).size;

  const averageDailyConsumption =
    weightedDailyRate(events, now);

  const confidence: StockRecommendationConfidence =
    events.length >= 10 &&
    distinctConsumptionDays >= 7 &&
    observedDays >= 21
      ? 'alta'
      : events.length >= 4 &&
          distinctConsumptionDays >= 3 &&
          observedDays >= 10
        ? 'media'
        : 'baixa';

  const usesHistory =
    confidence !== 'baixa' &&
    averageDailyConsumption > 0;

  /*
   * Histórico pode elevar a meta para que, ao comprar, exista uma pequena
   * margem acima do mínimo. Nunca reduz mínimo/meta configurados.
   */
  const historyTarget = usesHistory
    ? product.minimum_quantity +
      averageDailyConsumption * SAFETY_BUFFER_DAYS
    : 0;

  const targetQuantity = Math.max(
    configuredTarget,
    historyTarget,
  );

  const recommendedQuantity = Math.max(
    0,
    targetQuantity - product.current_quantity,
  );

  const coverageDays =
    averageDailyConsumption > 0
      ? product.current_quantity /
        averageDailyConsumption
      : null;

  const daysUntilMinimum =
    averageDailyConsumption <= 0
      ? null
      : minimumReached
        ? 0
        : Math.max(
            0,
            (product.current_quantity -
              product.minimum_quantity) /
              averageDailyConsumption,
          );

  const sampleText = `${events.length} saída${
    events.length === 1 ? '' : 's'
  } operacional${
    events.length === 1 ? '' : 'is'
  } em ${distinctConsumptionDays} dia${
    distinctConsumptionDays === 1 ? '' : 's'
  }`;

  return {
    productId: product.id,
    configuredQuantity,
    recommendedQuantity,
    targetQuantity,
    averageDailyConsumption,
    coverageDays,
    daysUntilMinimum,
    minimumReached,
    consumptionEvents: events.length,
    distinctConsumptionDays,
    observedDays,
    confidence,
    usesHistory,
    dataQuality:
      product.minimum_quantity <= 0
        ? 'sem_alerta'
        : 'ok',
    explanation: minimumReached
      ? `${sampleText}. O saldo já está no/abaixo do mínimo; a prioridade é recompor até a meta.`
      : usesHistory
        ? `${sampleText}. Consumo ponderado recente de ${averageDailyConsumption.toLocaleString(
            'pt-BR',
            { maximumFractionDigits: 2 },
          )}/dia; a leitura prioriza quando o saldo alcança o mínimo.`
        : `${sampleText}. Amostra ainda pequena; o consumo é exibido, mas a quantidade sugerida continua protegida pela regra configurada.`,
  };
}

export function buildStockRecommendations(
  products: StockProduct[],
  movements: StockMovement[],
  now = new Date(),
) {
  return products.map((product) =>
    buildStockRecommendation(
      product,
      movements,
      now,
    ),
  );
}

export function stockIntelligenceSummary(
  products: StockProduct[],
  movements: StockMovement[],
) {
  const recommendations =
    buildStockRecommendations(
      products,
      movements,
    );

  return {
    recommendations,
    historyBacked: recommendations.filter(
      (item) => item.usesHistory,
    ).length,
    withoutSafetyStock: products.filter(
      (item) => item.minimum_quantity <= 0,
    ).length,
    nearMinimum: recommendations.filter(
      (item) =>
        item.daysUntilMinimum !== null &&
        item.daysUntilMinimum <= 2,
    ).length,
    minimumReached: recommendations.filter(
      (item) => item.minimumReached,
    ).length,
    // Compatibilidade com consumidores antigos.
    lowCoverage: recommendations.filter(
      (item) =>
        item.coverageDays !== null &&
        item.coverageDays < 2,
    ).length,
  };
}
