const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const module = { exports: {} };
  cache.set(relative, module);
  const js = ts.transpileModule(fs.readFileSync(relative, 'utf8'), {
    fileName: relative,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (name) => {
    if (name.startsWith('@/lib/')) return load(path.posix.join('lib', name.slice('@/lib/'.length) + '.ts'));
    return require(name);
  };
  new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
  return module.exports;
}

const { planStockSupplyLedger, groupStockSupplyItems } = load('lib/stock-supply-ledger.ts');
const { buildStockPriceInsights } = load('lib/stock-pricing.ts');
const product = {
  id: 'p1', name: 'Coca 2L', unit: 'un', current_quantity: 5,
  average_cost: 8, minimum_quantity: 2, active: true,
};
const purchase = {
  id: 'compra', occurred_at: '2026-10-17T18:00:00-03:00', created_at: '2026-10-17T17:00:00-03:00',
  status: 'recebido', items: [
    { id: 'a', stock_product_id: 'p1', name: 'Coca pacote', unit: 'un', quantity: 2, unit_price: 10 },
    { id: 'b', stock_product_id: 'p1', name: 'Coca avulsa', unit: 'un', quantity: 3, unit_price: 20 },
  ],
};
const now = '2026-10-17T20:00:00-03:00';
assert.equal(groupStockSupplyItems(purchase).size, 1, 'linhas são agrupadas por produto');
const posted = planStockSupplyLedger(purchase, new Map([['p1', product]]), 'integrate', now);
assert.equal(posted.changed.length, 1, 'apenas UMA atualização do produto');
assert.equal(posted.changed[0].current_quantity, 10, 'ambas as linhas entram no saldo');
assert.deepEqual(posted.records.map((row) => [row.balance_before, row.balance_after]), [[5, 7], [7, 10]]);
assert.equal(posted.changed[0].average_cost, 12, 'custo médio ponderado das duas linhas');
assert.equal(new Set(posted.records.map((row) => row.id)).size, 2, 'movimentos preservados sem colisão');
const reversed = planStockSupplyLedger(purchase, new Map([['p1', posted.changed[0]]]), 'reverse', now);
assert.equal(reversed.changed.length, 1);
assert.equal(reversed.changed[0].current_quantity, 5);
assert.equal(reversed.changed[0].average_cost, 8, 'estorno reconstrói custo médio sem consumo intermediário');
assert.deepEqual(reversed.records.map((row) => [row.balance_before, row.balance_after]), [[10, 7], [7, 5]]);
assert.throws(() => planStockSupplyLedger(purchase, new Map([['p1', { ...product, current_quantity: 4 }]]), 'reverse', now), /ultrapassa o saldo/);
assert.throws(() => groupStockSupplyItems({ items: [] }), /sem itens/);
assert.throws(() => groupStockSupplyItems({ items: [purchase.items[0], purchase.items[0]] }), /duplicada/);
assert.throws(() => groupStockSupplyItems({ items: [{ ...purchase.items[0], quantity: NaN }] }), /Quantidade inválida/);
assert.throws(() => planStockSupplyLedger({ ...purchase, items: [{ ...purchase.items[0], unit: 'kg' }] }, new Map([['p1', product]]), 'integrate', now), /Unidade incompatível/);
assert.throws(() => planStockSupplyLedger(purchase, new Map(), 'integrate', now), /não encontrado/);
const fresh = planStockSupplyLedger(purchase, new Map([['p1', { ...product, current_quantity: 0, average_cost: undefined }]]), 'integrate', now);
assert.equal(fresh.changed[0].average_cost, 16, 'sem custo histórico não assume custo zero');
const tiny = { ...purchase, items: [{ id: 'tiny', stock_product_id: 'kg', name: 'Tomate', quantity: .5, unit: 'kg', total_price: 4 }] };
const fractional = planStockSupplyLedger(tiny, new Map([['kg', { ...product, id: 'kg', unit: 'kg', current_quantity: 1, average_cost: 6 }]]), 'integrate', now);
assert.equal(fractional.changed[0].current_quantity, 1.5);
assert.equal(fractional.records[0].unit_cost, 8, 'preço total dividido pela quantidade física');
const pricing = buildStockPriceInsights([product], [purchase, { ...purchase, id: 'older', occurred_at: '2026-10-15', items: [{ ...purchase.items[0], unit_price: 5 }] }], []);
assert.equal(pricing.length, 1);
assert.equal(pricing[0].samples, 3);
assert.equal(pricing[0].median, 10);
assert.equal(pricing[0].latest, 10);
assert.equal(pricing[0].lowest, 5);
assert.equal(pricing[0].confidence, 'média');
const store = fs.readFileSync('store/useAppStore.ts', 'utf8');
const relevant = store.slice(store.indexOf('integrateStockSupply: async (id) => {',store.indexOf('addStockMovement: async')),
  store.indexOf('countStockProducts: async (counts, responsible) => {',store.indexOf('addStockMovement: async')));
assert.equal((relevant.match(/planStockSupplyLedger\(/g) || []).length, 2, 'mesmo planejador para entrada e estorno');
assert.equal((relevant.match(/groupStockSupplyItems\(/g) || []).length, 2, 'leituras deduplicadas nos dois sentidos');
assert.match(relevant, /set\(\(state\) => \(/, 'store usa atualização funcional após transação');
assert.doesNotMatch(relevant, /set\(\{ stockProducts: previousProducts/, 'não desfaz mudanças alheias em falha transacional');
console.log('V100.3: 21 cenários de estoque, estorno, custos, preços e sincronização OK');
