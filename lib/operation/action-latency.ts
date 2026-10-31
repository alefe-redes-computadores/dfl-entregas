/**
 * R224 — telemetria operacional LOCAL, limitada e sem identificadores.
 * Não envia eventos à rede, não contém nomes, IDs, URLs, valores, endereços
 * ou dados de autenticação. Medidas não são uma confirmação de Firestore.
 */
export type ActionLatencyKind =
  | 'stop_completion'
  | 'delivery_critical'
  | 'delivery_queue'
  | 'route_start'
  | 'route_close'
  | 'stock_movement'
  | 'stock_supply';
export type ActionLatencyStatus = 'confirmed' | 'failed' | 'partial';
export type ActionLatencySample = {
  kind: ActionLatencyKind;
  status: ActionLatencyStatus;
  durationMs: number;
  itemCount: number;
  at: string;
};
export const ACTION_LATENCY_EVENT = 'dfl:action-latency-recorded';
const STORAGE_KEY = 'dfl-action-latency-v1';
const MAX_SAMPLES = 60;
const KINDS: readonly ActionLatencyKind[] = [
  'stop_completion', 'delivery_critical', 'delivery_queue',
  'route_start', 'route_close', 'stock_movement', 'stock_supply',
];
const STATUSES: readonly ActionLatencyStatus[] = ['confirmed', 'failed', 'partial'];
const safeMs = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 300_000
    ? Math.round(value) : null;
const count = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 400 ? value : 1;

export function sanitizeActionLatencies(raw: unknown): ActionLatencySample[] {
  if (!Array.isArray(raw)) return [];
  const result: ActionLatencySample[] = [];
  for (const item of raw.slice(0, MAX_SAMPLES * 2)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const value = item as Record<string, unknown>;
    if (!KINDS.includes(value.kind as ActionLatencyKind) ||
        !STATUSES.includes(value.status as ActionLatencyStatus)) continue;
    const durationMs = safeMs(value.durationMs);
    if (durationMs === null || typeof value.at !== 'string' ||
        value.at.length > 48 || !Number.isFinite(Date.parse(value.at))) continue;
    result.push({
      kind: value.kind as ActionLatencyKind,
      status: value.status as ActionLatencyStatus,
      durationMs,
      itemCount: count(value.itemCount),
      at: value.at,
    });
    if (result.length >= MAX_SAMPLES) break;
  }
  return result;
}

export function readActionLatencies(): ActionLatencySample[] {
  if (typeof window === 'undefined') return [];
  try { return sanitizeActionLatencies(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return []; }
}

export function recordActionLatency(
  kind: ActionLatencyKind,
  durationMs: number,
  status: ActionLatencyStatus,
  itemCount = 1,
): void {
  // Registro opcional: nunca pode atrasar nem impedir uma baixa.
  if (typeof window === 'undefined' || !KINDS.includes(kind) || !STATUSES.includes(status)) return;
  const bounded = safeMs(durationMs);
  if (bounded === null) return;
  try {
    const next = [{ kind, status, durationMs: bounded, itemCount: count(itemCount), at: new Date().toISOString() },
      ...readActionLatencies()].slice(0, MAX_SAMPLES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ACTION_LATENCY_EVENT));
  } catch { /* Armazenamento privado/indisponível: operação continua. */ }
}

export function clearActionLatencies(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(ACTION_LATENCY_EVENT));
  } catch { /* Apenas diagnóstico local. */ }
}

export const ACTION_LATENCY_LABEL: Record<ActionLatencyKind, string> = {
  stop_completion: 'Baixa da parada',
  delivery_critical: 'Gravação crítica',
  delivery_queue: 'Espera na fila local',
  route_start: 'Início de rota',
  route_close: 'Fechamento de rota',
  stock_movement: 'Movimentação de estoque',
  stock_supply: 'Compra de estoque',
};

export function summarizeActionLatencies(samples: readonly ActionLatencySample[]) {
  return KINDS.map((kind) => {
    const matches = samples.filter((sample) => sample.kind === kind);
    const durations = matches.filter((sample) => sample.status === 'confirmed')
      .map((sample) => sample.durationMs).sort((a, b) => a - b);
    const averageMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
    const p90Ms = durations.length ? durations[Math.ceil(durations.length * 0.9) - 1] : 0;
    return { kind, label: ACTION_LATENCY_LABEL[kind], total: matches.length,
      confirmed: durations.length,
      failures: matches.filter((sample) => sample.status !== 'confirmed').length,
      averageMs, p90Ms, slow: durations.filter((ms) => ms >= 4000).length };
  }).filter((group) => group.total > 0);
}

export function actionLatencyDiagnosticText(samples: readonly ActionLatencySample[]): string {
  const rows = summarizeActionLatencies(sanitizeActionLatencies(samples));
  return ['DFL Entregas · tempos locais (últimas 60 ações, sem IDs)',
    ...rows.map((row) => `${row.label}: ${row.total} registros; ${row.confirmed} confirmados; ${row.failures} falhas/parciais; média ${row.averageMs}ms; P90 ${row.p90Ms}ms; lentos ${row.slow}`),
    rows.length ? 'Medição do cliente, não diagnóstico completo de rede/servidor.' : 'Sem amostras nesta instalação.',
  ].join('\n');
}
