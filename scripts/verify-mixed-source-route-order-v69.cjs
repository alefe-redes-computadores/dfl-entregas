const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('lib/route-stops.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  require(id) {
    if (id === '@/lib/integration/site-order') {
      return { isCancelledSiteDelivery: () => false };
    }
    if (id === '@/lib/operational-address') {
      return { canonicalizeOperationalAddress: (value) => ({ address: String(value || '') }) };
    }
    if (id === '@/lib/customer-identity') {
      return { normalizeCustomerAddress: (value) => String(value || '').trim().toLowerCase() };
    }
    throw new Error('Dependência inesperada: ' + id);
  },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: 'route-stops.transpiled.cjs' });
const { groupDeliveriesByStop, moveStopToIndex } = sandbox.module.exports;

const route = 'rota-mista';
const make = (id, order, source, completed) => ({
  id,
  route_id: route,
  address_string: 'Rua ' + id + ', 1',
  order_index: order,
  source_system: source,
  ...(completed === undefined ? {} : { completed }),
});

// Reproduz o dado real: locais persistem false; Site legado pode omitir o campo.
const mixed = [
  make('whatsapp', 0, undefined, false),
  make('site-a', 1, 'dfl_site', undefined),
  make('ifood', 2, undefined, false),
  make('site-b', 3, 'dfl_site', undefined),
];

const ids = (items) => groupDeliveriesByStop(items).map((g) => g.representative.id);
const expect = (actual, wanted, label) => {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(wanted);
  if (left !== right) throw new Error(label + ': esperado ' + right + ', recebido ' + left);
  console.log('OK:', label);
};

expect(ids(mixed), ['whatsapp', 'site-a', 'ifood', 'site-b'], 'fila inicial mistura todos os canais');

const siteUp = moveStopToIndex(mixed, 'site-b', 1);
expect(siteUp, ['whatsapp', 'site-b', 'site-a', 'ifood'], 'Site atravessa Site e iFood ao subir');
expect(ids(mixed.map((item) => ({ ...item, order_index: siteUp.indexOf(item.id) }))), siteUp, 'render respeita ordem mista salva');

const localDown = moveStopToIndex(mixed, 'whatsapp', 2);
expect(localDown, ['site-a', 'ifood', 'whatsapp', 'site-b'], 'WhatsApp atravessa Site ao descer');
expect(ids(mixed.map((item) => ({ ...item, order_index: localDown.indexOf(item.id) }))), localDown, 'ordem inversa também é estável');

const completed = [...mixed, make('concluido', -1, 'dfl_site', true)];
expect(ids(completed).at(-1), 'concluido', 'concluído permanece após todos os pendentes');

if (!source.includes('const aCompleted = a.completed === true') || !source.includes('const bCompleted = b.completed === true')) {
  throw new Error('normalização booleana não encontrada na autoridade central');
}
console.log('\nV69 ORDEM MISTA SITE + IFOOD + WHATSAPP: CONTRATOS OK');
