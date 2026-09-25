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

export function readSyncDiagnostics(): SyncDiagnostic[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
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
    id: `${entry.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([next, ...readSyncDiagnostics()].slice(0, MAX_ENTRIES)),
    );
  } catch {
    // Diagnóstico nunca pode interromper a operação.
  }
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
