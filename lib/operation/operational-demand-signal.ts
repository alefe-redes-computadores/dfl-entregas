/**
 * DFL Entregas R246 — observação interna de pressão operacional.
 * Não é disponibilidade pública, estimativa de entrega, nem autoridade de abertura do Site.
 * Puro: nenhuma leitura/gravação, rede, relógio global ou dependência de Firebase.
 */
export type DemandLevel = 'unknown' | 'normal' | 'attention' | 'high';
export type DemandFreshness = 'fresh' | 'offline' | 'stale' | 'unverified' | 'sync_error';
export type DemandConfidence = 'none' | 'limited' | 'partial' | 'moderate';

export type DemandDelivery = Readonly<{
  id: string;
  route_id?: string;
  completed?: boolean;
  created_at?: string;
  createdAt?: string;
  source_system?: string;
  external_order_id?: string;
  site_order_status?: string;
  scheduled_for?: string | null;
  operational_dismissed_at?: string | null;
  fulfillment_mode?: string;
  developer_test?: boolean;
  exclude_from_reports?: boolean;
}>;
export type DemandRoute = Readonly<{
  id: string;
  status?: string;
  motoboy_id?: string;
  motoboy_name?: string;
  started_at?: string;
  created_at?: string;
  departure_time?: string;
}>;
export type DemandMotoboy = Readonly<{ id: string; name: string; active: boolean }>;
export type DemandSnapshotInput = Readonly<{
  nowMs: number;
  lastSuccessfulSyncMs: number | null;
  online: boolean;
  lastSyncFailed?: boolean;
  localOperationOpen?: boolean | null;
  deliveries: readonly DemandDelivery[];
  routes: readonly DemandRoute[];
  motoboys: readonly DemandMotoboy[];
}>;
export type DemandSignal = Readonly<{
  level: DemandLevel;
  freshness: DemandFreshness;
  confidence: DemandConfidence;
  sampledOrders: number;
  queue: number;
  preparing: number;
  pendingCommercial: number;
  futureScheduled: number;
  routeAssembly: number;
  routesOnStreet: number;
  driversActive: number;
  driversFree: number;
  driverAssignmentUnknown: number;
  conflictingIdentities: number;
  ageSeconds: number | null;
  reason: string;
  publicStoreAuthority: 'unknown';
  mayPublish: false;
  etaMinutes: null;
}>;
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
function spDay(time: number): string {
  const parts = DAY.formatToParts(new Date(time));
  const value = (key: string) => parts.find(part => part.type === key)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
const parse = (raw?: string | null): number | null => {
  if (!raw || typeof raw !== 'string') return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
};
const normalized = (value?: string) => (value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
const cancelled = new Set(['cancelado', 'cancelada', 'cancelled', 'canceled']);
const production = new Set(['em_producao', 'em_preparo', 'em_preparacao', 'preparando', 'preparacao']);
const awaitingCommercial = new Set(['pendente', 'agendado', 'aguardando_pagamento']);
const isSiteCancelled = (item: DemandDelivery) => item.source_system === 'dfl_site' && cancelled.has(normalized(item.site_order_status));
const finite = (value: number) => Number.isFinite(value);
export const DEMAND_SYNC_FRESH_MS = 6 * 60_000;
export const DEMAND_STABILITY_COOLDOWN_MS = 2 * 60_000;

/** Confiabilidade temporal antecede qualquer cálculo de pressão. */
export function demandFreshness(input: Pick<DemandSnapshotInput, 'nowMs' | 'online' | 'lastSuccessfulSyncMs' | 'lastSyncFailed'>): DemandFreshness {
  if (!input.online) return 'offline';
  if (input.lastSyncFailed) return 'sync_error';
  const last = input.lastSuccessfulSyncMs;
  if (last === null || !finite(last) || !finite(input.nowMs) || last > input.nowMs + 5_000) return 'unverified';
  return input.nowMs - last > DEMAND_SYNC_FRESH_MS ? 'stale' : 'fresh';
}

/**
 * Exclui pedidos cancelados, finalizados, testes e futuros. Não mistura pedidos de
 * plataforma com capacidade de motoboy DFL. Duas identidades externas divergentes
 * contam uma vez e acrescentam revisão, nunca aumentam artificialmente demanda.
 */
export function deriveOperationalDemand(input: DemandSnapshotInput): DemandSignal {
  const freshness = demandFreshness(input);
  const now = input.nowMs;
  const today = finite(now) ? spDay(now) : '';
  let queue = 0, preparing = 0, pendingCommercial = 0, futureScheduled = 0, sampledOrders = 0;
  let conflictingIdentities = 0;
  const seen = new Set<string>();
  for (const item of input.deliveries) {
    if (!item || !item.id || item.completed || item.operational_dismissed_at || item.developer_test || item.exclude_from_reports || isSiteCancelled(item)) continue;
    const identity = item.source_system === 'dfl_site' && item.external_order_id?.trim()
      ? `site:${item.external_order_id.trim()}` : `delivery:${item.id}`;
    if (seen.has(identity)) { conflictingIdentities++; continue; }
    seen.add(identity);
    const created = parse(item.created_at) ?? parse(item.createdAt);
    if (created === null || !today || spDay(created) !== today) continue;
    const scheduled = parse(item.scheduled_for);
    if (scheduled !== null && scheduled > now) { futureScheduled++; continue; }
    if (created <= now && created >= now - 2 * 60 * 60_000) sampledOrders++;
    const siteStatus = normalized(item.site_order_status);
    if (item.source_system === 'dfl_site' && production.has(siteStatus)) preparing++;
    if (item.source_system === 'dfl_site' && awaitingCommercial.has(siteStatus)) pendingCommercial++;
    // Preparação e retirada entram no retrato de cozinha, não na fila dos motoboys.
    if (item.fulfillment_mode === 'pickup' || item.fulfillment_mode === 'counter' || item.fulfillment_mode === 'external_delivery') continue;
    if (!item.route_id?.trim()) queue++;
  }

  const active = input.motoboys.filter(item => item.active);
  const assignedDriverIds = new Set<string>();
  let assembly = 0, onStreet = 0, assignmentUnknown = 0;
  for (const route of input.routes) {
    if (!route || route.status !== 'aberta') continue;
    const routeAt = parse(route.started_at) ?? parse(route.created_at) ?? parse(route.departure_time);
    if (routeAt === null || !today || spDay(routeAt) !== today) continue;
    if (route.started_at || route.departure_time) {
      onStreet++;
      if (route.motoboy_id) assignedDriverIds.add(route.motoboy_id);
      else {
        const names = active.filter(driver => normalized(driver.name) === normalized(route.motoboy_name));
        if (names.length === 1) assignedDriverIds.add(names[0].id);
        else assignmentUnknown++;
      }
    } else assembly++;
  }
  const driversActive = active.length;
  const driversFree = Math.max(0, driversActive - assignedDriverIds.size - assignmentUnknown);
  const confidence: DemandConfidence = freshness !== 'fresh' || input.localOperationOpen === false
    ? 'none' : sampledOrders >= 12 && conflictingIdentities === 0 && assignmentUnknown === 0
      ? 'moderate' : sampledOrders >= 4 ? 'partial' : 'limited';
  let level: DemandLevel = 'unknown';
  let reason = 'Aguardando dados atuais e verificáveis da operação.';
  if (freshness === 'offline') reason = 'Sem rede: retrato local pode estar desatualizado.';
  else if (freshness === 'stale') reason = 'Última sincronização antiga: demanda atual desconhecida.';
  else if (freshness === 'sync_error') reason = 'Falha de sincronização: não inferir capacidade atual.';
  else if (freshness === 'unverified') reason = 'Sem confirmação recente de sincronização.';
  else if (input.localOperationOpen === false) reason = 'Operação marcada fechada no Entregas. A autoridade pública é do Site.';
  else if (conflictingIdentities) { level = 'attention'; reason = 'Possível identidade externa duplicada: conferir pedidos antes de agir.'; }
  else if (queue >= 8 || (queue >= 4 && driversFree === 0) || preparing >= 12) {
    level = 'high'; reason = 'Acúmulo observável no retrato local; confirmar situação com equipe.';
  } else if (queue >= 4 || preparing >= 6 || (queue > 0 && driversActive === 0) || assignmentUnknown > 0) {
    level = 'attention'; reason = 'Fila ou equipe precisam de conferência operacional.';
  } else if (sampledOrders >= 4 && driversActive > 0 && assignmentUnknown === 0) {
    level = 'normal'; reason = 'Sem alerta quantitativo no retrato local; não equivale a capacidade disponível.';
  } else {
    reason = 'Amostra pequena para classificar pressão sem suposição.';
  }
  return {
    level, freshness, confidence, sampledOrders, queue, preparing, pendingCommercial,
    futureScheduled, routeAssembly: assembly, routesOnStreet: onStreet,
    driversActive, driversFree, driverAssignmentUnknown: assignmentUnknown,
    conflictingIdentities,
    ageSeconds: input.lastSuccessfulSyncMs !== null && finite(input.lastSuccessfulSyncMs) && finite(now)
      ? Math.max(0, Math.round((now - input.lastSuccessfulSyncMs) / 1_000)) : null,
    reason, publicStoreAuthority: 'unknown', mayPublish: false, etaMinutes: null,
  };
}

export type DemandStability = Readonly<{ level: DemandLevel; changedAtMs: number; candidate: DemandLevel; candidateSinceMs: number }>;
/**
 * Histerese para reduzir oscilação: piora imediata; melhora só após período contínuo.
 * Offline, stale ou erro prevalecem imediatamente (nunca seguram sinal otimista).
 */
export function stabilizeDemandLevel(previous: DemandStability | null, next: DemandLevel, nowMs: number): DemandStability {
  if (!previous || !finite(nowMs)) return { level: next, changedAtMs: nowMs, candidate: next, candidateSinceMs: nowMs };
  if (previous.level === next) return { ...previous, candidate: next, candidateSinceMs: nowMs };
  const rank: Record<DemandLevel, number> = { unknown: -1, normal: 0, attention: 1, high: 2 };
  if (next === 'unknown' || previous.level === 'unknown' || rank[next] > rank[previous.level]) {
    return { level: next, changedAtMs: nowMs, candidate: next, candidateSinceMs: nowMs };
  }
  if (previous.candidate !== next) return { ...previous, candidate: next, candidateSinceMs: nowMs };
  if (nowMs - previous.candidateSinceMs >= DEMAND_STABILITY_COOLDOWN_MS) {
    return { level: next, changedAtMs: nowMs, candidate: next, candidateSinceMs: nowMs };
  }
  return previous;
}

/** Override é apenas visual, em memória; jamais libera envio, ETA, cobrança ou loja. */
export function observedDemandLevel(stable: DemandLevel, override: 'automatic' | 'review' | 'high', freshness: DemandFreshness): DemandLevel {
  if (freshness !== 'fresh' || stable === 'unknown') return 'unknown';
  if (override === 'high') return 'high';
  if (override === 'review') return stable === 'high' ? 'high' : 'attention';
  return stable;
}
