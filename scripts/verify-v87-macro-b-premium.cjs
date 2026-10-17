const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, label) => { if (!value) throw new Error(`V87 B: ${label}`); console.log('OK:', label); };

const source = read('lib/stock-search.ts');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = new Module('v87-stock-search', module);
mod.filename = process.cwd() + '/lib/stock-search.ts';
mod.paths = module.paths;
mod._compile(js, mod.filename);
const products = [
  { id: '1', name: 'Tomate Italiano', category: 'Hortifruti' },
  { id: '2', name: 'Coca-Cola 2L', category: 'Bebidas' },
  { id: '3', name: 'Copinho 30 ml', category: 'Embalagens' },
];
assert.equal(mod.exports.rankStockProducts(products, 'coca cola')[0].id, '2');
assert.equal(mod.exports.rankStockProducts(products, 'hortífruti')[0].id, '1');
assert.equal(mod.exports.rankStockProducts(products, 'tomte')[0].id, '1');
assert.equal(mod.exports.rankStockProducts(products, 'produto inexistente').length, 0);
console.log('OK: busca normaliza acento, categoria e erro simples');

const page = read('app/estoque/page.tsx');
const form = read('components/stock-supplies/StockSupplyForm.tsx');
const draft = read('lib/stock-supply-draft.ts');
const notifications = read('lib/native/notifications.ts');
ok(page.indexOf('Buscar produto ou categoria') < page.indexOf('<StockCriticalBanner'), 'busca fica antes da inteligência');
ok(page.includes('painéis ocultos durante a busca') && page.includes('rankStockProducts'), 'busca prioriza catálogo e relevância');
ok(page.includes('setMoreOpen(v=>!v)') && page.includes('setBrainOpen(v=>!v)'), 'atalhos e recomendações são compactos');
ok(draft.includes('STOCK_SUPPLY_DRAFT_VERSION') && form.includes('writeStockSupplyDraft'), 'compra possui rascunho versionado');
ok(form.includes('Rascunho da compra recuperado') && form.includes('Salvar rascunho e sair') && form.includes('Descartar alterações'), 'recuperação e saída possuem escolhas explícitas');
ok(form.indexOf('await onSubmit({') < form.lastIndexOf('removeStockSupplyDraft(draftKey)'), 'rascunho só é removido após submissão concluída');
ok(notifications.includes("document.visibilityState === 'visible'") && notifications.includes('dflGroupedStockAlert'), 'estoque não gera spam Android em primeiro plano');
console.log('\nV87 MACROCIRURGIA B: CONTRATOS OK');
