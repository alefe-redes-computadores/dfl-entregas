"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p,'utf8');
const card = read('components/home/DeliveryCard.tsx');
const stock = read('app/abastecimentos/detalhes/page.tsx');
const route = read('components/home/RouteAccordion.tsx');
assert.ok(card.includes('aria-label="Editar pedido sem expandir o card"'), 'lapis disponivel no card compacto');
assert.ok(card.includes('Copiar parada') && card.includes('Copiar pedido'), 'atalho copiar mantido');
assert.ok(!card.includes('Editar entrega sem expandir o card'), 'linha de edicao redundante removida');
assert.ok(card.indexOf('aria-label="Editar pedido sem expandir o card"') > card.indexOf('aria-label="Ações rápidas da parada"'), 'lapis na linha de acoes');
assert.ok(stock.includes('stockActionLock.current = true'), 'toque duplicado bloqueado imediatamente');
assert.ok(stock.includes('await integrate(supply.id)'), 'commit transacional preservado');
assert.ok(stock.includes("confirmAction !== 'reverse'"), 'estorno exige intencao explicita');
assert.ok(stock.includes('Ações avançadas do estoque') && stock.includes('<details className='), 'estorno oculto no fluxo normal');
assert.ok(stock.includes('Conferindo estoque…') && stock.includes('aria-busy={busy}'), 'feedback de conferência imediato');
assert.ok(route.includes('void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)'), 'helper nao espera vibracao nativa');
for(const path of ['app/entregas/editar/page.tsx','lib/ui-feedback.ts']){
  assert.ok(!read(path).includes('await Haptics.'), 'operacao nao deve esperar haptics: '+path);
}
// Preservar contratos V66 e V100.6 sem aguardar vibracao nas chamadas.
assert.ok(read('app/entregas/details/page.tsx').includes('await Haptics.impact({ style });'), 'compatibilidade V66');
assert.ok(read('app/confirmacoes/page.tsx').includes('await Haptics.impact({ style });'), 'compatibilidade V100.6');
assert.ok(read('components/routes/RouteDepartureChecklist.tsx').includes('createPortal('), 'checklist escapa da camada do card');
assert.ok(read('components/routes/RouteDepartureChecklist.tsx').includes('document.body'), 'checklist ancorado na viewport');
assert.ok(read('components/routes/RouteDepartureChecklist.tsx').includes('data-dfl-checklist-scroll'), 'rolagem interna isolada');
assert.ok(read('components/routes/RouteDepartureChecklist.tsx').includes('data-dfl-checklist-footer'), 'botao de inicio em rodape visivel');
assert.ok(read('components/routes/RouteDepartureChecklist.tsx').includes('100dvh'), 'altura real do viewport mobile');
assert.ok(route.includes('max-h-[calc(100dvh-12px)]'), 'otimizador usa viewport dinamico');
assert.ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r220-urgent-ux.cjs'"), 'regressao registrada');
console.log('R220-R3: UX, viewport, haptics e compras auditados');
