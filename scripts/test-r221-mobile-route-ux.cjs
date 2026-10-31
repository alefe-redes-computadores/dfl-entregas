#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = f => fs.readFileSync(f, 'utf8');
const card = read('components/home/DeliveryCard.tsx');
const route = read('components/home/RouteAccordion.tsx');
const whatsapp = read('lib/whatsapp.ts');
const pre = read('scripts/pre-apk.cjs');
let passed = 0;
function check(condition, message) {
  assert.ok(condition, 'R221: ' + message);
  console.log('R221 OK:', message);
  passed++;
}
for (const [file, source] of [['components/home/DeliveryCard.tsx', card], ['components/home/RouteAccordion.tsx', route], ['lib/whatsapp.ts', whatsapp]]) {
  const t = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  check(t.parseDiagnostics.length === 0, 'AST valido ' + file);
}
check(card.includes("import { createPortal } from 'react-dom';"), 'card suporta portal para camada independente');
for (const name of ['attemptOpen','deleteOpen','moveSheetOpen','isIfoodModalOpen']) {
  check(card.includes(`{${name} && typeof document !== 'undefined' && createPortal(`), 'modal fora do card animado: ' + name);
}
check(card.includes('z-[330]') && card.includes('role="dialog" aria-modal="true" aria-label="Mover ou fixar parada"'), 'mover/fixar acima da barra inferior');
check(card.includes('max-h-[calc(100dvh-20px)]') && card.includes('overscroll-contain') && card.includes('env(safe-area-inset-bottom)'), 'rolagem segura e safe area');
const nav = card.indexOf('Navegação sem abrir o mapa');
const order = card.indexOf('Ferramentas · ajustar ordem');
const history = card.indexOf('Histórico e localização');
check(nav >= 0 && order > nav && history > order, 'ordem secundaria fica abaixo das acoes de navegacao');
check(card.includes('Próxima ação operacional') && card.includes('Pagamento e finalização'), 'passo e pagamento continuam preservados');
check(card.includes('Registrar tentativa (sem dar baixa)') && card.includes('Mover / Fixar parada') && card.includes('Desfazer Baixa'), 'operacoes criticas continuam disponiveis');
check(card.includes('onClick={() => handleTriggerAction(\'complete\')}') && card.includes('completionBusyRef.current = true'), 'baixa permanece no handler protegido');
check(route.includes("import { createPortal } from 'react-dom';"), 'route accordion suporta portal');
for (const name of ['optimizerOpen','isCopyMenuOpen','isDispatchModalOpen','isReopenModalOpen','fuzzyModalOpen']) {
  check(route.includes(`{${name} && typeof document !== 'undefined' && createPortal(`), 'modal de rota acima da navegacao: '+name);
}
check(route.includes('max-h-[calc(100dvh-12px)]') && route.includes('overscroll-contain'), 'sheet de rota usa viewport real');
check(whatsapp.includes("const ifoodPortalLines = (items: readonly Delivery[], alreadyListed = false)"), 'helper permite nao repetir dados do pedido');
for(const call of ['ifoodPortalLines(groupedOrders, true)','ifoodPortalLines([delivery], true)','ifoodPortalLines(deliveries, true)']) {
  check(whatsapp.includes(call), 'portal unico abaixo das informacoes: '+call);
}
check(whatsapp.includes("lines.push('', '🌐 *Abrir portal de confirmação:*', IFOOD_DRIVER_CONFIRMATION_URL)"), 'link ao final da instrucao');
check(whatsapp.includes('Abrir o link não confirma') === false || whatsapp.includes('Salvar o código no DFL ou abrir o link não confirma'), 'confirmacao externa diferenciada do DFL');
check(whatsapp.includes('PEDIR O CÓDIGO') && whatsapp.includes('ifood_id'), 'ID e coleta individual preservados');
check(pre.includes("'scripts/test-r221-mobile-route-ux.cjs'"), 'R221 integrada ao PRE-APK');
const semantics = read('scripts/verify-action-semantics-v24-2.cjs');
check(semantics.includes("route.includes('safe-bottom') && route.includes('max-h-[calc(100dvh-12px)]') && route.includes('overscroll-contain')"), 'V24.2 valida altura responsiva, rolagem e safe-bottom');
check(!semantics.includes("route.includes('max-h-[88dvh]')"), 'V24.2 nao exige altura antiga');
console.log(`R221: ${passed} contratos estruturais aprovados`);
