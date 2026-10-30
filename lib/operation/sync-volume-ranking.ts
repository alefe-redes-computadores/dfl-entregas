import type { SyncDiagnostic } from '@/lib/sync-diagnostics';

/** Estatística do último conjunto de sucessos locais. NÃO são leituras faturadas. */
export type SyncCollectionHotspot = {
  name: string;
  latest: number;
  average: number;
  peak: number;
  samples: number;
};

/** Apenas nomes de coleções e contagens sanitizadas; nenhum dado pessoal. */
export function rankSyncCollectionVolumes(
  entries: readonly SyncDiagnostic[], limit = 5,
): SyncCollectionHotspot[] {
  const recent = entries.filter(entry => entry.status === 'success').slice(0, 5);
  if (!recent.length) return [];
  const buckets = new Map<string, { sum: number; peak: number; samples: number }>();
  for (const entry of recent) {
    for (const [name, raw] of Object.entries(entry.collections || {})) {
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(name) ||
          !Number.isFinite(raw) || raw < 0) continue;
      const count = Math.min(1_000_000_000, Math.trunc(raw));
      const current = buckets.get(name) || { sum: 0, peak: 0, samples: 0 };
      current.sum += count;
      current.peak = Math.max(current.peak, count);
      current.samples++;
      buckets.set(name, current);
    }
  }
  const latest = recent[0]?.collections || {};
  return [...buckets.entries()]
    .map(([name, stats]) => ({
      name,
      latest: Number.isFinite(latest[name]) ? Math.max(0, Math.trunc(latest[name])) : 0,
      average: Math.round(stats.sum / stats.samples),
      peak: stats.peak,
      samples: stats.samples,
    }))
    .sort((a, b) => b.average - a.average || b.latest - a.latest || a.name.localeCompare(b.name))
    .slice(0, Math.min(12, Math.max(0, Math.trunc(limit))));
}
