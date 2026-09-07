// lib/delivery-intelligence/statistics.ts
export function median(values: number[]): number | null {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;

  const middle = Math.floor(valid.length / 2);
  return valid.length % 2
    ? valid[middle]
    : (valid[middle - 1] + valid[middle]) / 2;
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

export function confidenceFromSample(
  sampleSize: number,
  minimumSample: number,
): 'low' | 'medium' | 'high' {
  if (sampleSize >= Math.max(minimumSample * 4, 12)) return 'high';
  if (sampleSize >= Math.max(minimumSample * 2, 6)) return 'medium';
  return 'low';
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
