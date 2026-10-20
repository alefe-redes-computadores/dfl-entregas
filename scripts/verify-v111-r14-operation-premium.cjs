/* V111 R14: functional regressions + no weakening of past contracts. */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const read = file => fs.readFileSync(file,'utf8');
let checks = 0;
function ok(assertion, name) { assert.ok(assertion, name); checks++; console.log('OK:',name); }
function load(file, mocks={}) {
  const transformed = ts.transpileModule(read(file), {fileName:file, reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  ok(!(transformed.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'sintaxe TS '+file);
  const exports={};
  vm.runInNewContext(transformed.outputText, {exports, module:{exports}, WeakMap, Map,
    require: id => {if(id in mocks)return mocks[id];throw Error('Import inesperado '+id)}}, {filename:file});
  return exports;
}
const cancel = item => item.source_system==='dfl_site' && item.site_order_status==='cancelado';
const {pendingOperationalStopDeliveries} = load('lib/delivery-stop-pending.ts',{
  '@/lib/integration/site-order':{isCancelledSiteDelivery:cancel},
});
const sample = [
  {id:'pending',completed:false},
  {id:'done',completed:true},
  {id:'cancelled',completed:false,source_system:'dfl_site',site_order_status:'cancelado'},
  {id:'pending-2',completed:false},
];
const result = pendingOperationalStopDeliveries(sample);
ok(result.length===2 && result[0]===sample[0] && result[1]===sample[3],'baixa da parada só recebe pedidos ativos e pendentes');
ok(sample.length===4,'histórico original da parada permanece intacto');
ok(pendingOperationalStopDeliveries([sample[1],sample[2]]).length===0,'cancelados e concluídos não são reenviados');
const {isDeliveryExpanded} = load('lib/delivery-expansion-index.ts');
const arr = [{id:'one',is_expanded:false},{id:'two',is_expanded:true}];
ok(!isDeliveryExpanded(arr,'one') && isDeliveryExpanded(arr,'two'),'expansão específica por card');
ok(!isDeliveryExpanded(arr,'missing'),'card inexistente não expande');
const next = [{...arr[0],is_expanded:true},arr[1]];
ok(isDeliveryExpanded(next,'one') && !isDeliveryExpanded(arr,'one'),'novo snapshot invalida cache sem alterar snapshot antigo');
const card = read('components/home/DeliveryCard.tsx');
ok(card.includes('isDeliveryExpanded(state.deliveries, delivery.id)'),'card usa seleção indexada');
ok(card.includes('const targets = pendingOperationalStopDeliveries(groupedDeliveries)'),'baixa agrupada usa apenas alvos operacionais');
ok(card.includes('const newStatus = pendingGroupedDeliveries.length > 0 || !delivery.completed;'),'grupo parcialmente concluído ainda permite completar pendentes');
ok(card.includes('const wasComplete = groupedPending > 0;'),'gesto de baixa só opera grupo pendente');
ok(card.includes('const stopCompleted = isGroupedStop ? groupedPending === 0 : delivery.completed;'),'card agrupado só fica verde quando todos os pedidos ativos terminam');
ok(card.includes("await updateDelivery(delivery.id, { completed: false })"),'desfazer baixa individual preservado');
ok(card.includes('failed.length > 0') && card.includes('pendingLabels.join'),'falhas parciais da baixa são comunicadas');
ok(!/\b(onSnapshot|runTransaction|collection\()/.test(card),'cards sem novas operações Firestore');
const page = read('app/entregas/page.tsx');
ok(page.includes('const routeById = useMemo(() => new Map('),'rotas indexadas por snapshot na lista');
ok(page.includes('const customerById = useMemo(() => new Map('),'clientes indexados por snapshot na lista');
ok(page.includes('routeById.get(delivery.route_id'),'sem busca linear de rota por pedido');
ok(page.includes('customerById.get(delivery.customer_id'),'sem busca linear de cliente por pedido');
ok(!page.includes('routes.find((item) => item.id === delivery.route_id)'),'busca quadrática de rota removida');
ok(!page.includes('customers.find((item) => item.id === delivery.customer_id)'),'busca quadrática de cliente removida');
ok(page.includes('normalizedQuery') && page.includes('haystack.includes(normalizedQuery)'),'busca normalizada uma vez por alteração');
const routes = read('app/rotas/page.tsx');
ok(routes.includes('const searchTerm = useMemo(') && routes.includes('includes(searchTerm)'),'termo da busca de rotas normalizado uma vez');
const radar = read('components/home/OperationalRadar.tsx');
ok(radar.includes('new Set(routes.map(') && radar.includes('routeIds.has(id)'),'radar resolve referência por Set');
console.log(`V111 R14: ${checks} contratos funcionais/estruturais aprovados`);
