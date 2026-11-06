'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const read = file => fs.readFileSync(file, 'utf8');
const source = read('lib/operation/assistant-intent.ts');
const searchSource = read('lib/operation/searchR99.ts');
function transpile(name, input, dependency) {
  const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(name, module);
  mod.filename = `${process.cwd()}/${name}.ts`;
  mod.paths = module.paths;
  mod.require = id => id === '@/lib/operation/searchR99' ? dependency : require(id);
  mod._compile(code, mod.filename);
  return mod.exports;
}
const search = transpile('searchR99', searchSource);
const {assistantDestinations, assistantSearchSubject, searchAssistantSnapshot} = transpile('assistant-intent', source, search);
assert.equal(assistantSearchSubject('Buscar pedido do João'), 'joao');
assert.match(assistantDestinations('ver rotas em montagem', '2026-11-03')[0].href, /filter=montando/);
assert.match(assistantDestinations('mostrar entregas pendentes', '2026-11-03')[0].href, /status=pendentes/);
assert.match(assistantDestinations('pagamentos pendentes', '2026-11-03')[0].href, /payment=pending/);
assert.match(assistantDestinations('produtos abaixo do mínimo')[0].href, /filter=baixo/);
assert.match(assistantDestinations('buscar bacon no estoque')[0].href, /q=bacon/);
assert.match(assistantDestinations('compras de ontem')[0].href, /estoque\/compras/);
assert.match(assistantDestinations('caixa de entrada')[0].href, /caixa-de-entrada/);
assert.equal(assistantDestinations('ver rotas', '../../etc')[0].href.includes('..'), false, 'não usa data de navegação inválida');
const data = {
  deliveries:[{id:'delivery-1',order_id:'845211',customer_id:'customer-1',customer_name:'João Silva',address_string:'Rua 16'}],
  customers:[{id:'customer-1',name:'João Silva'}],
  routes:[{id:'route-1',name:'Rota Azul',motoboy_name:'Bruno'}],
  products:[{id:'product-1',name:'Bacon',category:'Alimentos',active:true,barcode:'789123'}],
};
assert.equal(searchAssistantSnapshot('bacon', data)[0].kind, 'stock');
assert.equal(searchAssistantSnapshot('pedido do João', data)[0].kind, 'delivery');
assert.equal(searchAssistantSnapshot('845211', data)[0].kind, 'delivery');
assert.equal(searchAssistantSnapshot('Bruno', data)[0].kind, 'route');
assert.equal(searchAssistantSnapshot('bacon',data,0).length,0);
const assistant = read('components/home/OperationalAssistant.tsx');
const home = read('app/page.tsx');
const deliveries = read('app/entregas/page.tsx');
const routes = read('app/rotas/page.tsx');
const stock = read('app/estoque/page.tsx');
const inbox = read('app/loja/caixa-de-entrada/page.tsx');
assert.ok(home.includes('OperationalAssistant dayDeliveries={deliveriesDoDia}') && home.includes('homeToolsOpen &&') && !home.includes('legacyRadarOpen &&') && read('app/mais/page.tsx').includes('legacyRadarOpen &&'), 'Busca 360 recolhida na Home; Radar legado acessível em Mais');
assert.ok(assistant.includes('useDeferredValue') && assistant.includes('useMemo') && !assistant.includes('fetch(') && !assistant.includes('onSnapshot('), 'busca local sem I/O');
assert.ok(assistant.includes('privacy ? []') && assistant.includes('hideForToday'), 'privacidade e dispensa por dia');
assert.ok(deliveries.includes("searchParams.get('q')") && deliveries.includes('paymentPending'), 'Entregas recebe filtro da Busca 360');
assert.ok(routes.includes("searchParams.get('filter')") && routes.includes("searchParams.get('q')"), 'Rotas recebe parâmetros validados');
assert.ok(stock.includes("params.get('q')") && stock.includes("params.get('filter')"), 'Estoque reutiliza busca existente');
assert.ok(inbox.includes("params.get('q')"), 'Inbox reutiliza busca de rascunhos');
assert.ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r234-assistant-navigation.cjs'"), 'Gate obrigatório registrado');
console.log('R234 Busca 360: intenção local, integração, privacidade, navegação e não mutação OK');
