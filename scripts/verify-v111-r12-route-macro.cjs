'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
let checks = 0;
function ok(value, name) { assert.ok(value, name); checks++; console.log('OK:', name); }
function loadTS(file, mocks = {}) {
  const code = read(file);
  const result = ts.transpileModule(code, { fileName:file, reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} });
  ok(!(result.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error), `TS válido: ${file}`);
  const exports = {};
  vm.runInNewContext(result.outputText, {
    exports, module:{exports},
    require(id) { if (Object.prototype.hasOwnProperty.call(mocks,id)) return mocks[id]; throw Error(`Mock inesperado ${id} em ${file}`); },
  }, { filename:file });
  return exports;
}
const store = read('store/useAppStore.ts');
const hook = read('hooks/useOptimizedDeliveries.ts');
const card = read('components/home/DeliveryCard.tsx');
const {withRouteOrderWriteLock,rollbackRouteOrderFields} = loadTS('lib/route-order-write-guard.ts');
const cancel = item => item.source_system === 'dfl_site' && item.site_order_status === 'cancelado';
const {routeCashFlow} = loadTS('lib/route-cash-flow.ts', {
  '@/lib/delivery-finance':{deliveryCustomerCharge:delivery => delivery.customer_charge ?? delivery.value,deriveDeliveryPaymentState:delivery => delivery.is_paid || delivery.payment_state === 'paid' ? 'paid' : delivery.payment_state || (delivery.payment_method === 'dinheiro' ? 'collect_on_delivery' : 'pending')},
  '@/lib/integration/site-order':{isCancelledSiteDelivery:cancel},
});
const {summarizeRoutePerformance} = loadTS('lib/route-performance.ts', {
  '@/lib/operational-time':{routeStartedAt:route => route.started_at},
  '@/lib/reports/time':{firstValidTimestamp:date => date ? new Date(date) : null},
  '@/lib/route-stops':{groupDeliveriesByStop:deliveries => {
    const groups = new Map();
    for (const item of deliveries) {
      const group = groups.get(item.address_string) || { deliveries:[] };
      group.deliveries.push(item);
      groups.set(item.address_string,group);
    }
    return [...groups.values()];
  }},
  '@/lib/route-closure-eligibility':{activeRouteDeliveries:deliveries => deliveries.filter(item => !cancel(item))},
  '@/lib/motoboy-analytics':{calculateMotoboyFee:(_rule,stops) => ({amount:stops * 7})},
});
ok(store.includes('withRouteOrderWriteLock(routeId, async () => {'), 'reordenação protegida por lock da rota');
ok(store.includes('rollbackRouteOrderFields('), 'rollback somente de campos escritos');
ok(!store.includes('set({ deliveries: state.deliveries });'), 'falha de sequência não restaura snapshot global');
ok(store.includes('if (normalized.length > 500)'), 'limite físico do batch antes da gravação otimista');
ok(store.includes('const selectedIds = new Set(validIds)'), 'IDs ausentes detectados com Set sem busca quadrática');
ok(store.includes('byDeliveryId.get(id)'), 'organizador evita busca linear por item');
ok(hook.includes('const customerById = new Map('), 'cliente indexado no snapshot');
ok(hook.includes('const pendingGroups = groups.flatMap('), 'grupo pendente reaproveita grupo calculado');
ok(card.includes('disabled={copyBusy}') && card.includes('aria-busy={copyBusy}'), 'copiar bloqueia toque duplo com feedback');
ok(card.includes('setPointerCapture(event.pointerId)') && card.includes('clearReorderGesture();'), 'arrastar trata perda de captura');
const paid = {id:'a',value:64,payment_method:'dinheiro',is_paid:false,address_string:'Rua A'};
const canceled = {...paid,id:'b',value:200,change_for:400,source_system:'dfl_site',site_order_status:'cancelado',address_string:'Rua B'};
const normal = {...paid,id:'c',value:20,change_for:50,address_string:'Rua B'};
const physical = routeCashFlow([paid,canceled,normal],30);
ok(physical.cashOrders.length === 2, 'cancelado não entra no caixa físico');
ok(physical.customerCharges === 84, 'cobrança física mantém somente pedidos ativos');
ok(physical.tenderedCash === 114, 'dinheiro previsto ignora cancelado');
ok(physical.requiredChange === 30, 'troco não inclui pedidos cancelados');
ok(physical.plannedPixChange === 0, 'troco em Pix calculado sobre pedidos reais');
const report = summarizeRoutePerformance({name:'Rota',motoboy_name:'Moto',status:'fechada',end_time:'2026-10-18T19:00:00-03:00',started_at:'2026-10-18T18:00:00-03:00'},
  [{...paid,completed:true},canceled,{...normal,completed:false}], {payment_rule:{type:'per_delivery',delivery_fee:7}});
ok(report.orders === 2 && report.completedOrders === 1, 'relatório ignora cancelamento sem esconder conclusão');
ok(report.stops === 2 && report.completedStops === 1, 'motoboy remunerado por parada física concluída');
ok(report.fee === 7, 'taxa física não conta cancelados');
const previous = [{id:'a',order_index:2,order_locked:false,order_source:'smart',updated_at:'previous'}, {id:'b',order_index:1,updated_at:'previous'}];
const during = [{...previous[0],order_index:0,order_source:'manual',updated_at:'attempt',completed:true,customer_name:'Nome novo'}, {...previous[1],order_index:2,updated_at:'next',completed:true}, {id:'new',order_index:9,updated_at:'next'}];
const restored = rollbackRouteOrderFields(during,previous,new Set(['a','b']),'attempt');
ok(restored[0].order_index === 2 && restored[0].order_source === 'smart', 'ordem otimista volta quando falha');
ok(restored[0].completed && restored[0].customer_name === 'Nome novo', 'rollback não apaga baixa nem dados do cliente');
ok(restored[1].order_index === 2 && restored[1].updated_at === 'next', 'alteração posterior não sobrescrita');
ok(restored[2] === during[2], 'pedido novo preservado');
async function run() {
  let release;
  const pending = withRouteOrderWriteLock('route-a',() => new Promise(resolve => {release=resolve}));
  const other = await withRouteOrderWriteLock('route-b',async () => 'independente');
  ok(other === 'independente','outra rota não bloqueada');
  let completedQueued = false;
  const queued = withRouteOrderWriteLock('route-a',async()=> 'segundo salvo');
  queued.then(() => { completedQueued = true; });
  await Promise.resolve();
  ok(!completedQueued,'mesma rota serializa gravação concorrente');
  release('salvou');
  ok(await pending === 'salvou','primeira gravação conclui');
  ok(await queued === 'segundo salvo','gravação na fila conclui depois');
  ok(await withRouteOrderWriteLock('route-a',async()=>42) === 42, 'lock liberado após sucesso');
  await assert.rejects(()=>withRouteOrderWriteLock('route-a',async()=>{throw new Error('offline')}), /offline/);
  ok(true, 'falha remota propagada');
  ok(await withRouteOrderWriteLock('route-a',async()=> 'tente novamente') === 'tente novamente','lock liberado após falha');
  console.log(`V111 R12: ${checks} verificações executáveis/estruturais aprovadas`);
}
run().catch(error=>{console.error(error);process.exitCode=1});
