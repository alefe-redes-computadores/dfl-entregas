/** R237 — prioridade de insights contextual, pureza e silêncio por relevância. */
import type { ContextualSignal } from '@/lib/operation/contextual-signals';

const BLOCKED = new Set(['r235:routes:street']);

export function assistantSignalPriority(signal: ContextualSignal): number {
  if (BLOCKED.has(signal.id.split(/:\d{4}-\d{2}-\d{2}$/)[0])) return -1;
  const title = signal.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  if (/duplicad|invalida|revisa|zerad/.test(title)) return 400;
  if (/abaixo|sem rota|penden|montagem/.test(title)) return 300;
  if (/liberado|pronta|checklist/.test(title)) return 220;
  if (/aberta|disponivel|aguardando/.test(title)) return 130;
  return signal.tone === 'amber' ? 100 : 40;
}

/** Apenas um sinal relevante; oculta leitura genérica, respeita dispensa e mantém desempate estável. */
export function chooseContextualSignal(signals: readonly ContextualSignal[], hiddenIds: ReadonlySet<string>): ContextualSignal | null {
  let best: ContextualSignal | null = null;
  let bestScore = 0;
  for (const signal of signals) {
    if (hiddenIds.has(signal.id) || !signal.action?.trim() || !signal.message?.trim()) continue;
    const score = assistantSignalPriority(signal);
    if (score > bestScore) { best = signal; bestScore = score; }
  }
  return best;
}
