#!/usr/bin/env node
'use strict';
/** Gate hermético: R299 P4. Não toca rede/Firestore/mensagens. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
const ok=(cond,msg)=>{assert.ok(cond,'R299 P4: '+msg);checks++;};
const eq=(a,b,msg)=>{assert.equal(a,b,'R299 P4: '+msg);checks++;};

const file='lib/reports/report-order-status.ts';
const transpiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const sandboxModule={exports:{}};
vm.runInNewContext(transpiled,{module:sandboxModule,exports:sandboxModule.exports}, {filename:file,timeout:1000});
const {reportOrderStatus}=sandboxModule.exports;
eq(reportOrderStatus({origin:'keeta',completed:false}),'Pendente','Keeta pendente');
eq(reportOrderStatus({origin:'ifood',completed:true}),'Concluído','iFood concluído sem falar em pago');
eq(reportOrderStatus({source_system:'dfl_site',site_order_status:'cancelado',completed:false}),'Cancelado','cancelamento do Site');
eq(reportOrderStatus({source_system:'dfl_site',site_order_status:'Cancelada',completed:true}),'Cancelado','cancelamento Site prevalece sobre concluído');
eq(reportOrderStatus({source_system:'dfl_site',site_order_status:'em_preparo',completed:false}),'Pendente','pedido do Site em preparo');
eq(reportOrderStatus({source_system:'dfl_site',site_order_status:'concluido',completed:true}),'Concluído','pedido do Site concluído');
eq(reportOrderStatus({origin:'loja',site_order_status:'cancelado',completed:false}),'Pendente','status Site não contamina pedido de Loja');
const orders=[{completed:false},{completed:true},{source_system:'dfl_site',site_order_status:'cancelado'},{completed:false,origin:'keeta'}];
eq(orders.reduce((acc,x)=>(acc[reportOrderStatus(x)]=(acc[reportOrderStatus(x)]||0)+1,acc),{}).Pendente,2,'contagem consistente de pendentes');

const model=read('lib/reports/buildReportModel.ts');
const types=read('lib/reports/types.ts');
const origins=read('components/reports/Charts/OriginChart.tsx');
const pulse=read('components/reports/ReportOrderPulse.tsx');
const page=read('app/relatorios/page.tsx');
const sheet=read('components/reports/ReportDrilldownSheet.tsx');
const clients=read('app/clientes/details/page.tsx');
const ordersPage=read('app/entregas/page.tsx');
const home=read('app/page.tsx');
const pre=read('scripts/pre-apk.cjs');
ok(model.includes("delivery.source_system === 'dfl_site') return 'Site'"),'Site é canal separado, origem não vira Loja');
ok(types.includes("'Keeta' | 'Site' | 'Loja'"),'tipos de origem distinguem Site');
ok(origins.includes("site: { name:'Site'"),'gráfico contém Site distinto');
ok(page.includes("'Keeta','Site','Loja'"),'relatório gráfico inclui Site');
ok(model.includes('statuses = aggregate(current') && model.includes('reportOrderStatus(delivery)'),'cada pedido classificado uma só vez');
ok(model.includes('statuses,\n    hours,'),'status inclui resultado do modelo');
ok(model.includes("isDeliveryFulfillment(delivery) && !delivery.route && reportOrderStatus(delivery) !== 'Cancelado'"),'retirada/balcão/parceira não cria erro de rota');
ok(model.includes('export function normalizeLogisticsProvider'),'modelo compartilha classificação logística');
ok(sheet.includes('? normalizeLogisticsProvider(delivery)'),'drilldown Keeta não vira plataforma genérica');
ok(sheet.includes("case 'status':") && sheet.includes('return model.statuses'),'lista clicável filtra status');
ok(sheet.includes('deliveryEconomicValue(delivery)'),'valor comercial no detalhe segue modelo');
ok(!sheet.includes('money(delivery.value || 0)'),'valor de detalhe não usa preço bruto inconsistente');
ok(sheet.includes('Abrir pedido individual')&&sheet.includes('router.push(`/entregas/details?id='),'drilldown abre ficha exata');
ok(pulse.includes('onStatus(key)')&&pulse.includes('onOrigin(item.key)'),'cards de relatório são ações reais');
ok(page.includes('<ReportOrderPulse statuses={model.statuses}'),'painel de relatórios está integrado');
ok(clients.includes('`/entregas?customer=${encodeURIComponent(customer.id)}&allDates=1`'),'ficha abre todos pedidos do cliente');
ok(ordersPage.includes('deliveryBelongsToCustomer(delivery, selectedCustomer)'),'consulta do cliente valida vínculo forte');
ok(ordersPage.includes('if (allDatesForCustomer) return true;'),'histórico não fica preso ao dia atual');
ok(ordersPage.includes('if (customerFilterId && (!selectedCustomer'),'filtro não mostra pedidos de terceiros');
ok(ordersPage.includes('Limpar filtro')&&ordersPage.includes('Todo o período'),'escopo do filtro visível e reversível');
ok(home.includes('const [storeOrdersOpen, setStoreOrdersOpen] = useState(false);'),'Home inicia recolhida');
ok(home.includes('storeOrdersOpen && storeOrdersDoDia.slice(0, storeOrdersVisibleLimit)'),'cards secundários não são montados fechados');
ok(home.includes('storeOrdersDoDia.length > 0 && !globalMotoboy'),'Home preserva acesso por período');
ok(pre.includes("'scripts/test-r299-relatorios-p4.cjs'"),'regressão P4 integra PRE-APK');
for(const marker of ['test-r299-core-p1.cjs','test-r299-clientes-p2.cjs','test-r299-parser-p3.cjs'])ok(pre.includes(marker),'P1/P2/P3 preservados: '+marker);
for(const sourcePath of ['lib/reports/types.ts','lib/reports/report-order-status.ts','lib/reports/buildReportModel.ts','components/reports/Charts/OriginChart.tsx','components/reports/ReportDrilldownSheet.tsx','components/reports/ReportOrderPulse.tsx','app/relatorios/page.tsx','app/clientes/details/page.tsx','app/entregas/page.tsx','app/page.tsx']){
 const text=read(sourcePath);
 const ast=ts.createSourceFile(sourcePath,text,ts.ScriptTarget.Latest,true,sourcePath.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,`sintaxe TS: ${sourcePath} ${ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(', ')}`);
}
console.log(`R299 P4: ${checks} contratos/condições PASS. Sem rede, Firestore ou WhatsApp.`);
