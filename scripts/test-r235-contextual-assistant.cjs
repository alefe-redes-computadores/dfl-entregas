'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const read = path => fs.readFileSync(path, 'utf8');
const moduleSource = read('lib/operation/contextual-signals.ts');
const code = ts.transpileModule(moduleSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module('r235-contextual-signals', module);
mod.filename = `${process.cwd()}/lib/operation/contextual-signals.ts`;
mod.paths = module.paths;
mod._compile(code, mod.filename);
const {routeContextSignals, stockContextSignals, purchaseContextSignals, inboxContextSignals} = mod.exports;

assert.deepEqual(routeContextSignals({dateKey:'2026-11-03',montando:0,rua:0,prontas:0}), []);
assert.equal(routeContextSignals({dateKey:'2026-11-03',montando:2,rua:1,prontas:1})[0].target, 'prontas');
assert.equal(routeContextSignals({dateKey:'2026-11-03',montando:2,rua:1,prontas:0})[0].target, 'montando');
assert.match(routeContextSignals({dateKey:'2026-11-03',montando:1,rua:0,prontas:0})[0].message, /1 rota permanece/);
assert.deepEqual(stockContextSignals({zero:0,low:0,openPurchases:0}), []);
assert.equal(stockContextSignals({zero:4,low:3,openPurchases:2})[0].target,'zero');
assert.equal(stockContextSignals({zero:0,low:2,openPurchases:0})[0].target,'baixo');
assert.deepEqual(purchaseContextSignals({invalid:0,selected:0,suggested:0,checklistRemaining:0}), []);
assert.equal(purchaseContextSignals({invalid:2,selected:2,suggested:10,checklistRemaining:3})[0].target,'selecionados');
assert.equal(purchaseContextSignals({invalid:0,selected:2,suggested:10,checklistRemaining:3})[0].target,'checklist');
assert.equal(purchaseContextSignals({invalid:0,selected:0,suggested:10,checklistRemaining:0})[0].target,'sugestoes');
assert.deepEqual(inboxContextSignals({siteReady:0,siteReview:0,siteCommercial:0,manualReview:0,manualDuplicates:0,manualReady:0}),[]);
assert.equal(inboxContextSignals({siteReady:2,siteReview:1,siteCommercial:0,manualReview:0,manualDuplicates:2,manualReady:0})[0].target,'site');
assert.equal(inboxContextSignals({siteReady:0,siteReview:0,siteCommercial:0,manualReview:2,manualDuplicates:1,manualReady:0})[0].target,'manual-review');
assert.equal(stockContextSignals({zero:NaN,low:-2,openPurchases:Infinity}).length,0,'não inventar métricas quando não houver valor finito');

const card = read('components/assistant/ContextualAssistantCard.tsx');
assert.ok(card.includes('useHiddenInsightsToday()') && card.includes('hideForToday(signal.id)'), 'dispensa contextual existente');
assert.ok(card.includes('signals.find(item => !hiddenIds.has(item.id))'), 'rotatividade sem repetição');
assert.ok(!card.includes('fetch(') && !card.includes('onSnapshot(') && !card.includes('runTransaction('), 'card não consulta nem grava remotamente');
assert.ok(!moduleSource.includes('fetch(') && !moduleSource.includes('onSnapshot(') && !moduleSource.includes('runTransaction('), 'motor puro');
assert.ok(card.includes('aria-label="Dispensar este insight por hoje"'), 'botão acessível');
const routes = read('app/rotas/page.tsx');
const stock = read('app/estoque/page.tsx');
const inbox = read('app/loja/caixa-de-entrada/page.tsx');
const purchase = read('app/estoque/compras/page.tsx');
const intents = read('lib/operation/assistant-intent.ts');
assert.ok(routes.includes('routeContextSignals({ dateKey: selectedDate') && routes.includes("setFilter(target)"), 'rotas usam seus próprios filtros e estado');
assert.ok(stock.includes('stockContextSignals({zero:stockCounts.zero') && stock.includes("rememberAndPush('/estoque/compras')"), 'estoque usa contadores reais');
assert.ok(inbox.includes('inboxContextSignals({siteReady:siteBacklog.ready') && inbox.includes("setView('revisar')"), 'inbox reutiliza projeção e triagem');
assert.ok(purchase.includes('purchaseContextSignals({invalid:invalidSelected.length') && purchase.includes('setMarketExpanded(true)'), 'compras reutilizam checklist e validação');
assert.ok(purchase.includes("new URLSearchParams(window.location.search).get('q')") && purchase.includes('setShowAll(true)'), 'busca 360 localiza também produtos fora das sugestões');
assert.ok(intents.includes("url('/estoque/compras', {q:item||undefined})"), 'navegação da Home preserva busca de produto');
// O contrato de navegação é exercitado, não somente procurado como texto.
const intentJs = ts.transpileModule(intents, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const intentMod = new Module('r235-assistant-intent', module);
intentMod.filename = `${process.cwd()}/lib/operation/assistant-intent.ts`;
intentMod.paths = module.paths;
intentMod.require = id => id === '@/lib/operation/searchR99' ? {
  normalizeOperationSearch(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); },
  matchesOperationSearch(haystack, q) { return String(haystack).includes(String(q)); },
} : require(id);
intentMod._compile(intentJs,intentMod.filename);
assert.match(intentMod.exports.assistantDestinations('buscar bacon na compra')[0].href, /\/estoque\/compras\?q=bacon/);
assert.equal(intentMod.exports.assistantDestinations('compras')[0].href, '/estoque/compras');

assert.ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r235-contextual-assistant.cjs'"), 'suíte R235 registrada');
assert.ok(read('app/page.tsx').includes('homeToolsOpen &&') && read('app/page.tsx').includes('<OperationalAssistant') && read('app/mais/page.tsx').includes('<OperationalRadar'), 'Home R234 preservada; Radar relocado e carregado sob demanda em Mais');
console.log('R235: contratos de contexto, navegação, frequência, segurança, coexistência e offline OK');
