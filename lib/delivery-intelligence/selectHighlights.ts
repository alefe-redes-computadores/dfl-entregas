import type { OperationalInsight } from './types';

const SEVERITY_WEIGHT = {
  warning: 500,
  attention: 400,
  positive: 180,
  info: 100,
} as const;

const CONFIDENCE_WEIGHT = {
  high: 90,
  medium: 35,
  low: -120,
} as const;

function insightFamily(insight: OperationalInsight): string {
  /*
   * Insights de duração de rota podem nascer de motores diferentes
   * olhando para o mesmo fenômeno. Para a interface isso é uma família,
   * não dois alertas independentes.
   */
  if (
    insight.category === 'routes' &&
    (
      insight.id.includes('duration') ||
      insight.id.includes('contextual')
    )
  ) {
    return 'routes-duration';
  }

  if (insight.category === 'data-quality') {
    return `quality:${insight.id}`;
  }

  return insight.id;
}

function usefulnessScore(insight: OperationalInsight): number {
  let score =
    SEVERITY_WEIGHT[insight.severity] +
    CONFIDENCE_WEIGHT[insight.confidence] +
    Math.min(insight.sampleSize, 30);

  /*
   * Um insight quantitativo/comparativo é mais explicável que
   * uma observação genérica.
   */
  if (insight.comparison) score += 35;
  if (insight.evidence.length >= 2) score += 15;

  /*
   * Data quality é importante, mas não deve ocupar todo o radar
   * operacional quando não é warning.
   */
  if (
    insight.category === 'data-quality' &&
    insight.severity !== 'warning'
  ) {
    score -= 55;
  }

  /*
   * Leituras puramente informativas e de baixa confiança continuam
   * disponíveis no relatório completo, mas não disputam destaque.
   */
  if (
    insight.severity === 'info' &&
    insight.confidence === 'low'
  ) {
    score -= 120;
  }

  return score;
}

export function selectOperationalHighlights(
  insights: OperationalInsight[],
  options?: {
    limit?: number;
    minimumSample?: number;
  },
): OperationalInsight[] {
  const limit = Math.max(options?.limit ?? 3, 1);
  const minimumSample = Math.max(options?.minimumSample ?? 3, 1);

  const eligible = insights
    .filter((insight) => insight.sampleSize >= minimumSample)
    .filter((insight) => {
      /*
       * Baixa confiança não vira destaque de rotina.
       * Warning permanece visível por segurança operacional.
       */
      if (
        insight.confidence === 'low' &&
        insight.severity !== 'warning'
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const score = usefulnessScore(b) - usefulnessScore(a);
      if (score !== 0) return score;

      return b.sampleSize - a.sampleSize;
    });

  const selected: OperationalInsight[] = [];
  const families = new Set<string>();

  for (const insight of eligible) {
    const family = insightFamily(insight);

    if (families.has(family)) continue;

    families.add(family);
    selected.push(insight);

    if (selected.length >= limit) break;
  }

  return selected;
}
