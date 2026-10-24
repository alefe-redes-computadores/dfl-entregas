/**
 * R89: um calculo historico compartilhado por snapshot imutavel do Zustand.
 * A mesma rota pode exibir dois cards inteligentes com os mesmos insumos;
 * useMemo isolado por componente nao evita reconstruir o mesmo relatorio.
 *
 * WeakMap nao retém arrays antigos. Entradas limitadas e TTL protegem contra
 * revisita do mesmo snapshot por muito tempo (ex.: virada de periodo).
 * Nenhuma leitura, escrita, timer ou efeito colateral de rede.
 */
import { buildOperationalIntelligence } from '@/lib/delivery-intelligence';

type IntelligenceInput = Parameters<typeof buildOperationalIntelligence>[0];
type IntelligenceOutput = ReturnType<typeof buildOperationalIntelligence>;
type Cached = {
  routes: IntelligenceInput['routes'];
  customers: IntelligenceInput['customers'];
  motoboys: IntelligenceInput['motoboys'];
  stockSupplies: IntelligenceInput['stockSupplies'];
  lookbackDays: IntelligenceInput['lookbackDays'];
  minimumSample: IntelligenceInput['minimumSample'];
  now: IntelligenceInput['now'];
  window: IntelligenceInput['window'];
  includeUndatedQuality: IntelligenceInput['includeUndatedQuality'];
  expiresAt: number;
  result: IntelligenceOutput;
};
const CACHE_TTL_MS = 60_000;
const MAX_VARIANTS = 6;
const snapshotCache = new WeakMap<object, Cached[]>();

export function cachedOperationalIntelligence(input: IntelligenceInput): IntelligenceOutput {
  const now = Date.now();
  const entries = snapshotCache.get(input.deliveries) || [];
  const same = entries.find(entry =>
    entry.routes === input.routes &&
    entry.customers === input.customers &&
    entry.motoboys === input.motoboys &&
    entry.stockSupplies === input.stockSupplies &&
    entry.lookbackDays === input.lookbackDays &&
    entry.minimumSample === input.minimumSample &&
    entry.now === input.now &&
    entry.window === input.window &&
    entry.includeUndatedQuality === input.includeUndatedQuality &&
    entry.expiresAt > now,
  );
  if (same) return same.result;

  const result = buildOperationalIntelligence(input);
  const next = entries.filter(entry => entry.expiresAt > now && !(
    entry.routes === input.routes &&
    entry.customers === input.customers &&
    entry.motoboys === input.motoboys &&
    entry.stockSupplies === input.stockSupplies &&
    entry.lookbackDays === input.lookbackDays &&
    entry.minimumSample === input.minimumSample &&
    entry.now === input.now &&
    entry.window === input.window &&
    entry.includeUndatedQuality === input.includeUndatedQuality
  ));
  next.push({
    routes: input.routes,
    customers: input.customers,
    motoboys: input.motoboys,
    stockSupplies: input.stockSupplies,
    lookbackDays: input.lookbackDays,
    minimumSample: input.minimumSample,
    now: input.now,
    window: input.window,
    includeUndatedQuality: input.includeUndatedQuality,
    expiresAt: now + CACHE_TTL_MS,
    result,
  });
  snapshotCache.set(input.deliveries, next.slice(-MAX_VARIANTS));
  return result;
}
