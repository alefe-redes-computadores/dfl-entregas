/** R235 — sinais contextuais determinísticos. Nenhuma consulta remota ou mutação. */
export type ContextualSignal = {
  id: string;
  title: string;
  message: string;
  action: string;
  target: string;
  tone: 'amber' | 'emerald' | 'sky';
};

const safeCount = (value: number) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function routeContextSignals(input: {
  dateKey: string;
  montando: number;
  rua: number;
  prontas: number;
}): ContextualSignal[] {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ? input.dateKey : 'periodo';
  const ready = safeCount(input.prontas);
  const assembling = safeCount(input.montando);
  const active = safeCount(input.rua);
  const items: ContextualSignal[] = [];
  if (ready) items.push({ id: `r235:routes:ready:${dateKey}`, title: 'Rotas prontas para conferência', message: `${plural(ready, 'rota está pronta', 'rotas estão prontas')} para revisar o encerramento.`, action: 'Ver rotas prontas', target: 'prontas', tone: 'emerald' });
  if (assembling) items.push({ id: `r235:routes:assembling:${dateKey}`, title: 'Montagem em andamento', message: `${plural(assembling, 'rota permanece', 'rotas permanecem')} em montagem neste dia.`, action: 'Abrir montagem', target: 'montando', tone: 'amber' });
  if (active) items.push({ id: `r235:routes:street:${dateKey}`, title: 'Rotas na rua', message: `${plural(active, 'rota está', 'rotas estão')} em andamento.`, action: 'Acompanhar rotas', target: 'na-rua', tone: 'sky' });
  return items;
}

export function stockContextSignals(input: {
  zero: number;
  low: number;
  openPurchases: number;
}): ContextualSignal[] {
  const zero = safeCount(input.zero);
  const low = safeCount(input.low);
  const purchases = safeCount(input.openPurchases);
  const items: ContextualSignal[] = [];
  if (zero) items.push({ id: 'r235:stock:zero', title: 'Estoque zerado', message: `${plural(zero, 'produto está zerado', 'produtos estão zerados')} no cadastro atual.`, action: 'Ver produtos zerados', target: 'zero', tone: 'amber' });
  if (low) items.push({ id: 'r235:stock:low', title: 'Estoque abaixo do mínimo', message: `${plural(low, 'produto está', 'produtos estão')} abaixo do limite cadastrado.`, action: 'Ver estoque baixo', target: 'baixo', tone: 'amber' });
  if (purchases) items.push({ id: 'r235:stock:purchases', title: 'Compras abertas', message: `${plural(purchases, 'compra está aberta', 'compras estão abertas')} para consulta.`, action: 'Abrir compras', target: 'compras', tone: 'sky' });
  return items;
}

export function purchaseContextSignals(input: {
  invalid: number;
  selected: number;
  suggested: number;
  checklistRemaining: number;
}): ContextualSignal[] {
  const invalid = safeCount(input.invalid);
  const selected = safeCount(input.selected);
  const suggested = safeCount(input.suggested);
  const remaining = safeCount(input.checklistRemaining);
  const items: ContextualSignal[] = [];
  if (invalid) items.push({ id: 'r235:purchases:invalid', title: 'Quantidades precisam revisão', message: `${plural(invalid, 'seleção está', 'seleções estão')} com quantidade inválida. Nenhuma compra é alterada.`, action: 'Revisar selecionados', target: 'selecionados', tone: 'amber' });
  if (remaining) items.push({ id: 'r235:purchases:checklist', title: 'Checklist ainda aberto', message: `${plural(remaining, 'item ainda não foi marcado', 'itens ainda não foram marcados')} como comprado.`, action: 'Conferir checklist', target: 'checklist', tone: 'sky' });
  if (suggested && !selected) items.push({ id: 'r235:purchases:suggestions', title: 'Sugestões disponíveis', message: `${plural(suggested, 'produto tem', 'produtos têm')} sugestão revisável de compra.`, action: 'Ver sugestões', target: 'sugestoes', tone: 'emerald' });
  return items;
}

export function inboxContextSignals(input: {
  siteReady: number;
  siteReview: number;
  siteCommercial: number;
  manualReview: number;
  manualDuplicates: number;
  manualReady: number;
}): ContextualSignal[] {
  const siteReview = safeCount(input.siteReview);
  const siteReady = safeCount(input.siteReady);
  const commercial = safeCount(input.siteCommercial);
  const manualDuplicates = safeCount(input.manualDuplicates);
  const manualReview = safeCount(input.manualReview);
  const manualReady = safeCount(input.manualReady);
  const items: ContextualSignal[] = [];
  if (siteReview) items.push({ id: 'r235:inbox:site-review', title: 'Pedidos do Site para revisão', message: `${plural(siteReview, 'pedido precisa', 'pedidos precisam')} de verificação antes da rota.`, action: 'Conferir pedidos do Site', target: 'site', tone: 'amber' });
  if (manualDuplicates) items.push({ id: 'r235:inbox:duplicates', title: 'Possíveis duplicados', message: `${plural(manualDuplicates, 'rascunho pede', 'rascunhos pedem')} análise de duplicidade. Não serão importados automaticamente.`, action: 'Revisar importação', target: 'manual-review', tone: 'amber' });
  if (siteReady) items.push({ id: 'r235:inbox:site-ready', title: 'Pedidos liberados pelo Site', message: `${plural(siteReady, 'pedido está liberado', 'pedidos estão liberados')} para organizar.`, action: 'Abrir pedidos do Site', target: 'site', tone: 'emerald' });
  if (manualReview) items.push({ id: 'r235:inbox:manual-review', title: 'Importações para revisar', message: `${plural(manualReview, 'rascunho precisa', 'rascunhos precisam')} de conferência.`, action: 'Ver rascunhos', target: 'manual-review', tone: 'amber' });
  if (commercial) items.push({ id: 'r235:inbox:commercial', title: 'Pedidos aguardando liberação', message: `${plural(commercial, 'pedido aguarda', 'pedidos aguardam')} confirmação comercial do Site.`, action: 'Ver Caixa do Site', target: 'site', tone: 'sky' });
  if (manualReady) items.push({ id: 'r235:inbox:manual-ready', title: 'Importações prontas', message: `${plural(manualReady, 'rascunho está pronto', 'rascunhos estão prontos')} para revisão antes de lançar.`, action: 'Conferir prontos', target: 'manual-ready', tone: 'emerald' });
  return items;
}
