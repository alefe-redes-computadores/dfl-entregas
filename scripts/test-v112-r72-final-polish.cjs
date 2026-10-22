require('typescript');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('lib/stock-purchase-session.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(compiled, { module: moduleValue, exports: moduleValue.exports, require });
const { parseStockPurchaseDraft, compactStockPurchaseDraft } = moduleValue.exports;

const now = Date.parse('2026-10-22T12:00:00.000Z');
const valid = JSON.stringify({
  version: 1,
  updatedAt: '2026-10-22T11:00:00.000Z',
  selected: { a: true, removido: true },
  quantities: { a: '2', removido: '99' },
  presentationIds: { a: 'caixa-12', removido: 'legado' },
});
const parsed = parseStockPurchaseDraft(valid, now);
if (!parsed) throw new Error('rascunho válido não foi recuperado');
const compact = compactStockPurchaseDraft(parsed, new Set(['a', 'b']));
if (!compact.selected.a || compact.selected.removido) throw new Error('produto removido não foi saneado');
if (compact.quantities.a !== '2' || compact.presentationIds.a !== 'caixa-12') throw new Error('campos da compra não foram preservados');

const expired = JSON.stringify({ ...JSON.parse(valid), updatedAt: '2026-10-01T10:00:00.000Z' });
if (parseStockPurchaseDraft(expired, now) !== null) throw new Error('rascunho expirado foi restaurado');
if (parseStockPurchaseDraft('{quebrado', now) !== null) throw new Error('JSON inválido não foi isolado');

console.log('V112 R72: comportamento do rascunho de compra aprovado');
