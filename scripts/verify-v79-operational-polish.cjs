const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = process.cwd();
const cache = new Map();
let copied = '';
let clipboardFails = false;
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console: { ...console, error: () => {} }, URL,
    navigator: { clipboard: { writeText: async text => {
      if (clipboardFails) throw new Error('Clipboard denied');
      copied = text;
    } } },
    require(id) {
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), id) + '.ts');
      throw new Error('Dependência inesperada no teste puro: ' + id);
    },
  }, { filename: file });
  return module.exports;
}
const { buildIfoodParseGuide } = load('lib/ifood-parser-quality.ts');
const { parseIfoodOrdersText } = load('lib/ifood-order-parser.ts');
const field = (text, key) => buildIfoodParseGuide(text).find(item => item.key === key);
assert.equal(field('12', 'order').state, 'partial');
assert.equal(field('1234', 'order').state, 'complete');
assert.equal(field('#1234 123', 'ifood').state, 'partial');
assert.equal(field('#1234 123', 'ifood').hint, 'Faltam 5 dígitos');
assert.equal(field('ID: 12345678', 'ifood').state, 'complete');
assert.equal(field('ID: 123456789', 'ifood').state, 'partial');
assert.match(field('ID: 123456789', 'ifood').hint, /Confira/);
assert.equal(field('Rua Exemplo 123 456', 'ifood').state, 'missing');
assert.equal(field('R$ 123 456', 'ifood').state, 'missing');
assert.equal(field('34999229439', 'order').state, 'missing');
assert.equal(field('', 'ifood').state, 'missing');
const sample = '1234 12345678\nCliente: Maria Silva\nRua das Flores, 100 - Centro\nPago no app\nR$ 25,00';
const parsed = parseIfoodOrdersText(sample)[0];
assert.equal(parsed.ifoodId, '12345678');
assert.equal(buildIfoodParseGuide(sample, parsed).find(item => item.key === 'ifood').state, 'complete');
const read = file => fs.readFileSync(file, 'utf8');
const page = read('app/entregas/nova/page.tsx');
assert.ok(page.includes('buildIfoodParseGuide(deferredMagicText, liveParsedOrders[0])'));
assert.ok(page.includes('aria-busy={parserUpdating}'));
assert.ok(page.includes("item.state==='partial'&&item.value"));
const card = read('components/home/DeliveryCard.tsx');
assert.ok(!card.includes('await Haptics.impact'));
assert.ok(card.includes('const copied = await copyDeliveryToClipboard'));
assert.ok(card.includes('if (copied) toast.success'));
assert.ok(card.includes('if (copyBusyRef.current) return'));
const gate = read('scripts/pre-apk.cjs');
assert.ok(!gate.includes('.filter(fs.existsSync)'));
// Run the actual gate with a missing file: no child test may run.
let exitCode;
try {
  vm.runInNewContext(gate, {
    require: id => id === 'fs' ? { existsSync: () => false } : {
      spawnSync: () => { throw new Error('Teste executado sem manifesto completo'); },
    },
    console: { error: () => {}, log: () => {} },
    process: { exit: code => { exitCode = code; throw new Error('EXPECTED_EXIT'); } },
  });
} catch (error) { assert.equal(error.message, 'EXPECTED_EXIT'); }
assert.equal(exitCode, 1);
async function run() {
  const { copyDeliveryToClipboard } = load('lib/whatsapp.ts');
  const first = { id: 'a', route_id: 'r', origin: 'ifood', customer_name: 'Maria', ifood_id: '12345678', address_string: 'Rua das Flores, 100 - Centro', is_paid: true, payment_method: 'cartao', customer_charge: 25 };
  const second = { ...first, id: 'b', customer_name: 'João', ifood_id: '87654321' };
  assert.equal(await copyDeliveryToClipboard(first, 'Maria', '', [first, second]), true);
  assert.match(copied, /Todos os pedidos estão pagos/);
  assert.match(copied, /12345678/);
  assert.match(copied, /87654321/);
  assert.match(copied, /https:\/\//);
  assert.match(copied, /CÓDIGO DE 4 DÍGITOS/);
  assert.equal(await copyDeliveryToClipboard(first, 'Maria', '', [first, { ...second, is_paid: false, payment_method: 'dinheiro', customer_charge: 30 }]), true);
  assert.match(copied, /Alguns pedidos pagos · cobrar R\$ 30,00 dos pendentes/);
  assert.doesNotMatch(copied, /Pagamento misto/);
  assert.match(copied, /30,00/);
  assert.match(copied, /https:\/\//);
  clipboardFails = true;
  assert.equal(await copyDeliveryToClipboard(first), false);
  console.log('V79: guia progressivo, clipboard real, mensagens agrupadas e bloqueio de suítes ausentes OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
