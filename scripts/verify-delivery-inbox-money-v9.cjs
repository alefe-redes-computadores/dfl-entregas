const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/delivery-inbox.ts', 'utf8');
const start = source.indexOf('// DFL_MONEY_HELPER_START');
const end = source.indexOf('// DFL_MONEY_HELPER_END');

if (start < 0 || end <= start) {
  throw new Error('Normalizador monetário da caixa de entrada não encontrado.');
}

const snippet = source.slice(start, end)
  .replace('// DFL_MONEY_HELPER_START', '') +
  '\nmodule.exports = { parseInboxMoney };';
const javascript = ts.transpileModule(snippet, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(javascript, sandbox);
const { parseInboxMoney } = sandbox.module.exports;

const cases = [
  ['15,00', 15],
  ['15.00', 15],
  ['R$ 1.234,56', 1234.56],
  ['1,234.56', 1234.56],
  ['1.234', 1234],
  [12.5, 12.5],
  ['', 0],
  [undefined, 0],
];

for (const [input, expected] of cases) {
  const actual = parseInboxMoney(input);
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error('Falha para ' + String(input) + ': esperado ' + expected + ', recebido ' + actual);
  }
}

if (!source.includes('parseInboxMoney(parsed.customerCharge)')) {
  throw new Error('Deduplicação ainda não usa o normalizador monetário.');
}

console.log('OK: valores BR/internacionais são comparados corretamente na deduplicação.');
