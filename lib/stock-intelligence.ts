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
  coverageDays: number | null;
  consumptionEvents: number;
  observedDays: number;
  confidence: StockRecommendationConfidence;
  usesHistory: boolean;
  dataQuality: 'ok' | 'sem_consumo' | 'sem_alerta';
  explanation: string;
}

const DAY = 86_400_000;
const LOOKBACK_DAYS = 42;
const COVERAGE_TARGET_DAYS = 3;

const validDate = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

const consumptionMovements = (
  movements: StockMovement[],
  productId: string,
  now: Date,
) => {
  const start = now.getTime() - LOOKBACK_DAYS * DAY;
  return movements.filter((movement) => {
    if (movement.product_id !== productId) return false;
    // Entrada e estorno de compra não são consumo operacional.
    if (movement.supply_id) return false;
    if (movement.type !== 'saida' && movement.type !== 'perda') return false;
    if (!(movement.quantity > 0)) return false;
    const date = validDate(movement.occurred_at);
    return Boolean(date && date.getTime() >= start && date.getTime() <= now.getTime());
  });
};

export function buildStockRecommendation(
  product: StockProduct,
  movements: StockMovement[],
  now = new Date(),
): StockRecommendation {
  const configuredQuantity = purchaseSuggestion(product);
  const configuredTarget = replenishmentTarget(product);
  const events = consumptionMovements(movements, product.id, now)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  if (events.length === 0) {
    return {
      productId: product.id,
      configuredQuantity,
      recommendedQuantity: configuredQuantity,
      targetQuantity: configuredTarget,
      averageDailyConsumption: 0,
      coverageDays: null,
      consumptionEvents: 0,
      observedDays: 0,
      confidence: 'baixa',
      usesHistory: false,
      dataQuality: product.minimum_quantity <= 0 ? 'sem_alerta' : 'sem_consumo',
      explanation:
        product.minimum_quantity <= 0
          ? 'Sem estoque de segurança configurado e sem consumo suficiente para estimar.'
          : 'Ainda sem saídas/perdas suficientes; mantendo a reposição configurada.',
    };
  }

  const first = validDate(events[0]?.occurred_at)!;
  const observedDays = Math.max(
    7,
    Math.min(
      LOOKBACK_DAYS,
      Math.ceil((now.getTime() - first.getTime()) / DAY) + 1,
    ),
  );
  const totalConsumed = events.reduce((sum, movement) => sum + movement.quantity, 0);
  const averageDailyConsumption = totalConsumed / observedDays;

  const distinctDays = new Set(
    events.map((movement) => validDate(movement.occurred_at)!.toISOString().slice(0, 10)),
  ).size;

  const confidence: StockRecommendationConfidence =
    events.length >= 8 && distinctDays >= 6 && observedDays >= 21
      ? 'alta'
      : events.length >= 4 && distinctDays >= 3 && observedDays >= 14
        ? 'media'
        : 'baixa';

  // Histórico só influencia quantidade com amostra minimamente confiável.
  const usesHistory = confidence !== 'baixa' && averageDailyConsumption > 0;
  const historyTarget = usesHistory
    ? averageDailyConsumption * COVERAGE_TARGET_DAYS
    : 0;

  // Nunca reduz a proteção já configurada automaticamente.
  const targetQuantity = Math.max(configuredTarget, historyTarget);
  const recommendedQuantity = Math.max(0, targetQuantity - product.current_quantity);
  const coverageDays =
    averageDailyConsumption > 0
      ? product.current_quantity / averageDailyConsumption
      : null;

  return {
    productId: product.id,
    configuredQuantity,
    recommendedQuantity,
    targetQuantity,
    averageDailyConsumption,
    coverageDays,
    consumptionEvents: events.length,
    observedDays,
    confidence,
    usesHistory,
    dataQuality: product.minimum_quantity <= 0 ? 'sem_alerta' : 'ok',
    explanation: usesHistory
      ? `Histórico de ${observedDays} dias: média ${averageDailyConsumption.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/dia; alvo protege cerca de ${COVERAGE_TARGET_DAYS} dias sem reduzir o mínimo configurado.`
      : `Amostra ainda ${confidence === 'baixa' ? 'pequena' : 'insuficiente'}; mantendo a regra configurada até ganhar confiança.`,
  };
}

export function buildStockRecommendations(
  products: StockProduct[],
  movements: StockMovement[],
  now = new Date(),
) {
  return products.map((product) => buildStockRecommendation(product, movements, now));
}

export function stockIntelligenceSummary(
  products: StockProduct[],
  movements: StockMovement[],
) {
  const recommendations = buildStockRecommendations(products, movements);
  return {
    recommendations,
    historyBacked: recommendations.filter((item) => item.usesHistory).length,
    withoutSafetyStock: products.filter((item) => item.minimum_quantity <= 0).length,
    lowCoverage: recommendations.filter(
      (item) => item.coverageDays !== null && item.coverageDays < 2,
    ).length,
  };
}
