// lib/delivery-intelligence/selectHighlights.ts
import type { OperationalInsight } from './types';

const WEIGHT = {
  warning: 400,
  attention: 300,
  positive: 200,
  info: 100,
} as const;

export function selectOperationalHighlights(
  insights: OperationalInsight[],
  options?: {
    limit?: number;
    minimumSample?: number;
  },
): OperationalInsight[] {
  const limit = Math.max(options?.limit ?? 3, 1);
  const minimumSample = Math.max(options?.minimumSample ?? 2, 1);

  return [...insights]
    .filter((item) => item.sampleSize >= minimumSample)
    .sort((a, b) => {
      const severity = WEIGHT[b.severity] - WEIGHT[a.severity];
      if (severity !== 0) return severity;
      return b.sampleSize - a.sampleSize;
    })
    .slice(0, limit);
}
