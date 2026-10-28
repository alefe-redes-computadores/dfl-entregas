export type SyncDiagnostic = {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'error';
  totalDocuments: number;
  collections: Record<string, number>;
  message?: string;
};

const STORAGE_KEY = 'dfl-sync-diagnostics-v1';
const MAX_ENTRIES = 30;

/** Diagnósticos são compartilháveis: nunca registrar URLs, emails, tokens ou IDs pessoais. */
export function safeSyncErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  // Os códigos do Firebase são suficientes para triagem sem salvar dados sensíveis.
  const code = raw.match(/(?:firebase\/)?(?:auth|firestore)\/[a-z][a-z0-9-]{1,70}|\b(?:permission-denied|unavailable|deadline-exceeded|failed-precondition|unauthenticated|resource-exhausted|cancelled)\b/i);
  if (code) return `Falha operacional: ${code[0].toLowerCase()}`;
  if (/offline|network|rede|internet|conex[aã]o|timeout|temporarily unavailable/i.test(raw)) return 'Falha operacional: conexão ou tempo limite';
  return 'Falha operacional: detalhes privados omitidos';
}

export type SyncHealthSummary = {
  attempts: number;
  successes: number;
  errors: number;
  latestFailed: boolean;
  consecutiveFailures: number;
  latestSuccessAt: string | null;
  recentHighVolume: boolean;
  averageReturnedDocuments: number;
  slowestDurationMs: number;
};

/** Apenas dados locais, sem listeners ou leituras Firebase. Quantidade de documentos não é custo faturado. */
export function summarizeSyncHealth(entries: readonly SyncDiagnostic[]): SyncHealthSummary {
  const recent = sanitizeSyncDiagnostics(entries).slice(0, 10);
  const successes = recent.filter(entry => entry.status === 'success');
  const errors = recent.length - successes.length;
  return {
    attempts: recent.length,
    successes: successes.length,
    errors,
    latestFailed: recent[0]?.status === 'error',
    consecutiveFailures: recent.findIndex(entry => entry.status === 'success') === -1
      ? recent.length : recent.findIndex(entry => entry.status === 'success'),
    latestSuccessAt: successes[0]?.finishedAt ?? null,
    recentHighVolume: successes.slice(0, 3).filter(entry => entry.totalDocuments >= 300).length >= 2,
    averageReturnedDocuments: successes.length ? Math.round(successes.reduce((sum, entry) => sum + entry.totalDocuments, 0) / successes.length) : 0,
    slowestDurationMs: recent.reduce((max, entry) => Math.max(max, entry.durationMs), 0),
  };
}
export const SYNC_DIAGNOSTIC_EVENT = 'dfl:sync-diagnostic-recorded';

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 48 && Number.isFinite(Date.parse(value));
}

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1_000_000_000, value)) : 0;
}

/** Never trust localStorage: older builds or a WebView may leave partial records. */
export function sanitizeSyncDiagnostics(value: unknown): SyncDiagnostic[] {
  if (!Array.isArray(value)) return [];
  const result: SyncDiagnostic[] = [];
  const ids = new Set<string>();
  for (const candidate of value.slice(0, MAX_ENTRIES * 4)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const item = candidate as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || item.id.length > 128 || ids.has(item.id)) continue;
    if (!validDate(item.startedAt) || !validDate(item.finishedAt)) continue;
    if (item.status !== 'success' && item.status !== 'error') continue;
    const collections: Record<string, number> = {};
    if (item.collections && typeof item.collections === 'object' && !Array.isArray(item.collections)) {
      for (const [key, count] of Object.entries(item.collections).slice(0, 60)) {
        if (key.length <= 80 && typeof count === 'number' && Number.isFinite(count) && count >= 0) {
          // Prevent dangerous keys from changing the object's prototype.
          if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            collections[key] = Math.min(Math.trunc(count), 1_000_000_000);
          }
        }
      }
    }
    result.push({
      id: item.id, startedAt: item.startedAt, finishedAt: item.finishedAt,
      durationMs: nonNegative(item.durationMs),
      status: item.status, totalDocuments: nonNegative(item.totalDocuments),
      collections,
      ...(safeSyncErrorMessage(item.message) ? { message: safeSyncErrorMessage(item.message) } : {}),
    });
    ids.add(item.id);
    if (result.length >= MAX_ENTRIES) break;
  }
  return result;
}

export function readSyncDiagnostics(): SyncDiagnostic[] {
  if (typeof window === 'undefined') return [];
  try {
    return sanitizeSyncDiagnostics(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function recordSyncDiagnostic(
  entry: Omit<SyncDiagnostic, 'id'>,
) {
  if (typeof window === 'undefined') return;
  const next: SyncDiagnostic = {
    ...entry,
    // Nunca manter a mensagem original por spread quando o sanitizador a omite.
    message: safeSyncErrorMessage(entry.message),
    id: `${entry.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([next, ...readSyncDiagnostics()].slice(0, MAX_ENTRIES)),
    );
    window.dispatchEvent(new CustomEvent(SYNC_DIAGNOSTIC_EVENT, { detail: next }));
  } catch {
    // Diagnóstico nunca pode interromper a operação.
  }
}

export function latestSyncDiagnostic() {
  return readSyncDiagnostics()[0] || null;
}

/** Falhas recentes nunca devem virar o rótulo 'Atualizado agora'. */
export function latestSuccessfulSyncDiagnostic() {
  return readSyncDiagnostics().find((item) => item.status === 'success') || null;
}

export function clearSyncDiagnostics() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem efeito operacional.
  }
}

export function syncDiagnosticText(entries: SyncDiagnostic[]) {
  entries = sanitizeSyncDiagnostics(entries);
  if (!entries.length) return 'DFL Entregas — nenhum diagnóstico registrado.';
  return [
    'DFL Entregas — diagnóstico local de sincronização',
    ...entries.map((entry) => {
      const detail = Object.entries(entry.collections)
        .map(([name, count]) => `${name}=${count}`)
        .join(', ');
      return `${entry.finishedAt} | ${entry.status} | ${entry.durationMs}ms | documentos=${entry.totalDocuments} | ${detail}${entry.message ? ` | ${entry.message}` : ''}`;
    }),
  ].join('\n');
}
