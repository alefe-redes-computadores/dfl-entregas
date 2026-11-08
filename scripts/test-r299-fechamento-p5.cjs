#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const read=p=>fs.readFileSync(p,'utf8');
const ok=(a,b)=>{assert.ok(a,'R299 P5: '+b);checks++};
const eq=(a,b,c)=>{assert.equal(a,b,'R299 P5: '+c);checks++};
const load=(file,stubs={})=>{
 const compiled=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)((name)=>{if(Object.hasOwn(stubs,name))return stubs[name];throw Error('R299 P5 teste isolado não autoriza módulo '+name)},module,module.exports);
 return module.exports;
};
const clock=new Date('2026-11-08T12:00:00-03:00');
const relation=load('lib/customer-relationship-score.ts');
const create=(i,date='2026-11-01T12:00:00-03:00',extra={})=>({id:'id-'+i,created_at:date,completed:true,customer_id:'a',...extra});
const score=arr=>relation.customerRelationshipScore(arr,clock);
eq(score([]).score,0,'sem pedidos não cria pontuação');
eq(score([]).tier,'novo','sem compras é novo');
eq(score([create(1)]).completedOrders,1,'uma compra concluída real');
eq(score([create(1),create(1)]).completedOrders,1,'mesmo ID não duplica score');
eq(score([create(1,{},{})].filter(Boolean)).completedOrders,1,'suporte a datas sem confiança sem inventar timestamp');
const five=Array.from({length:5},(_,i)=>create(i));
eq(score(five).tier,'frequente','marco legado em cinco concluídos');
const ten=Array.from({length:10},(_,i)=>create(i));
eq(score(ten).tier,'vip','marco legado em dez concluídos');
const mixed=[...five, create(41,undefined,{developer_test:true}),create(42,undefined,{exclude_from_reports:true}),create(43,undefined,{exclude_customer_metrics:true}),create(44,undefined,{completed:false}),create(45,undefined,{source_system:'dfl_site',site_order_status:'cancelado'})];
eq(score(mixed).completedOrders,5,'teste, exclusão, pendente e cancelado fora');
eq(score(mixed).tier,'frequente','não penalizar cancelamento no ranking');
eq(score([create(1,'2025-10-01T12:00:00-03:00')]).tier,'inativo','inativo após 180 dias');
ok(score(ten).score>=score(five).score,'recorrência aumenta pontuação com mesmo recorte');
ok(score(ten).score<=100,'score no máximo 100');
// R299 P5: analisar o código, ignorando comentários.
const scoreSource=read('lib/customer-relationship-score.ts');
const scoreAst=ts.createSourceFile(
  'lib/customer-relationship-score.ts',
  scoreSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
let readsUpdateTimestamp=false;
(function inspect(node){
  if(ts.isIdentifier(node) &&
    (node.text==='updated_at' || node.text==='updatedAt'))
    readsUpdateTimestamp=true;
  if(ts.isStringLiteral(node) &&
    (node.text==='updated_at' || node.text==='updatedAt'))
    readsUpdateTimestamp=true;
  ts.forEachChild(node,inspect);
})(scoreAst);
ok(
  !readsUpdateTimestamp &&
  scoreSource.includes('delivery.created_at || delivery.createdAt'),
  'score não infere compra pelo updated_at'
);
ok(!/fetch\(|runTransaction\(|setDoc\(|localStorage/.test(read('lib/customer-relationship-score.ts')),'score puro sem escrita');

const analytics=load('lib/motoboy-analytics.ts',{
 '@/lib/route-stops':{groupDeliveriesByStop:items=>items.map(item=>({representative:item,deliveries:[item]}))},
 '@/lib/route-closure-eligibility':{activeRouteDeliveries:items=>items},
 '@/lib/route-cash-flow':{routeCashFlow:()=>({cashOrders:[],customerCharges:0,tenderedCash:0})},
});
const driver={id:'m1',name:'Willian',payment_rule:{type:'per_delivery',delivery_fee:5}};
const route={id:'r1',motoboy_id:'m1',motoboy_name:'Willian',created_at:'2026-11-08T13:00:00-03:00',status:'aberta'};
const orders=[{id:'1',route_id:'r1',completed:true,is_paid:true,payment_method:'pix'},{id:'2',route_id:'r1',completed:false,is_paid:true,payment_method:'pix'}];
const real=analytics.getMotoboyDayData(driver,'2026-11-08',[route],orders);
const simulation=analytics.getMotoboyDayData(driver,'2026-11-08',[route],orders,[],true,{},true);
eq(real.orderCount,1,'acerto real só conta baixas confirmadas');
eq(simulation.orderCount,2,'simulação inclui pedidos pendentes');
eq(real.fee.amount,5,'diária real intacta');
eq(simulation.fee.amount,10,'diária projetada distinta');
const settlement=read('app/motoboys/acerto/page.tsx');
ok(settlement.includes('const data=useMemo(')&&settlement.includes('const forecastData=useMemo('),'acerto distingue data e forecastData');
ok(settlement.includes('SIMULAÇÃO · NÃO RECEBIDO · NÃO QUITADO'),'previsão de dinheiro rotulada');
ok(settlement.includes('const confirm=')&&settlement.includes('getMotoboyDayData'),'fechamento continua usando motor original');
const details=read('app/entregas/details/page.tsx');
const start=details.indexOf('const executeCompletion');const end=details.indexOf('const handleCompletionAction',start);
const completion=details.slice(start,end);
ok(start>=0&&end>start,'marcadores de conclusão preservados');
ok(completion.includes("router.replace('/');")&&completion.indexOf('await updateDelivery(delivery.id, payload)')<completion.indexOf("router.replace('/');"),'só retorna Home depois de confirmar persistência');
ok(!completion.includes('router.replace(deliveriesReturn)'),'conclusão não manda para lista Entregas');
const routes=read('app/rotas/nova/page.tsx');
ok(routes.includes('routeOrderingMode')&&routes.includes('Ordenação ')&&routes.includes('definida em Loja'),'modo de ordenação visível na criação');
const whatsapp=read('lib/whatsapp.ts');
ok(whatsapp.includes('const compactChecklist: string[] = []')&&whatsapp.includes('const compactStops = groupDeliveriesByStop(deliveries);'),'checklist compacto agrupado por parada');
ok(whatsapp.includes('COBRANÇAS POR PARADA E CLIENTE')&&whatsapp.includes('pixCents/100')&&whatsapp.includes('cardCents/100'),'Pix/cartão detalhados por pedido e pagamento dividido');
ok(whatsapp.includes('código(s) iFood a solicitar')&&whatsapp.includes('stop.deliveries.filter(item => item.origin'), 'código por entrega e parada');
ok(whatsapp.includes('PEGAR BEBIDAS')&&whatsapp.includes('EQUIPAMENTOS E TROCO'),'equipamentos antes de códigos');
ok(whatsapp.includes("messageDetailMode === 'guided' ? msg2 : compactChecklist"),'modo guiado preservado');
const clients=read('app/clientes/details/page.tsx');
ok(clients.includes('CustomerRelationshipPanel')&&clients.includes('stats.deliveries'),'score usa pedidos da ficha');
const panel=read('components/customers/CustomerRelationshipPanel.tsx');
ok(panel.includes('Sem score ou benefício')&&panel.includes('Benefícios dependem de aprovação da loja'),'cliente interno e benefícios protegidos');
for(const file of ['lib/customer-relationship-score.ts','components/customers/CustomerRelationshipPanel.tsx','app/clientes/details/page.tsx','lib/whatsapp.ts','app/entregas/details/page.tsx','app/rotas/nova/page.tsx','app/motoboys/acerto/page.tsx','lib/motoboy-analytics.ts']){
 const node=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(node.parseDiagnostics.length===0,'AST '+file+': '+node.parseDiagnostics[0]?.messageText);
}
const gate=read('scripts/pre-apk.cjs');
ok(gate.includes("'scripts/test-r299-fechamento-p5.cjs'")&&gate.includes("'scripts/test-r299-relatorios-p4.cjs'"),'P4 e P5 preservados no PRE-APK');
console.log(`R299 P5: ${checks} contratos e cenários herméticos OK`);
