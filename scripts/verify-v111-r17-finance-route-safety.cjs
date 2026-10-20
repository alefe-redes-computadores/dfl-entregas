#!/usr/bin/env node
/** V111 R17: contratos executáveis de cobrança física e resiliência da Home. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
let count = 0;
function check(label, value) { assert.ok(value, label); console.log('OK R17:', label); count++; }
const source = file => fs.readFileSync(file,'utf8');
function transpile(file,mocks={}){
  const output=ts.transpileModule(source(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  check(`transpilação ${file}`,!(output.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error));
  const mod = new Module(path.resolve(file),module);
  mod.filename=path.resolve(file);mod.paths=module.paths;
  const fallback=mod.require.bind(mod);
  mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:fallback(id);
  mod._compile(output.outputText,mod.filename);
  return mod.exports;
}
const finance=transpile('lib/delivery-finance.ts');
const state=(payment,isPaid=false,method='dinheiro')=>finance.deriveDeliveryPaymentState({payment_state:payment,is_paid:isPaid,payment_method:method});
check('pagamento quitado vence cobrança antiga',state('collect_on_delivery',true)==='paid');
check('pagamento quitado vence pendência Pix antiga',state('pending',true,'pix')==='paid');
check('legado sem payment_state continua pago',state(undefined,true)==='paid');
check('pendência Pix legítima preservada',state('pending',false,'pix')==='pending');
check('cobrança legítima preservada',state('collect_on_delivery',false)==='collect_on_delivery');
check('dinheiro legado sem estado ainda cobra',state(undefined,false)==='collect_on_delivery');
const cancel=item=>item.source_system==='dfl_site'&&item.site_order_status==='cancelado';
const cash=transpile('lib/route-cash-flow.ts',{
  '@/lib/delivery-finance':finance,
  '@/lib/integration/site-order':{isCancelledSiteDelivery:cancel},
});
const make=(id,value,extra={})=>({id,value,customer_charge:value,payment_method:'dinheiro',is_paid:false,...extra});
const entries=[make('a',64,{change_for:100}),make('paid',23,{is_paid:true,payment_state:'collect_on_delivery',change_for:100}),make('past',31,{payment_state:'paid',change_for:100}),make('cancel',200,{change_for:500,source_system:'dfl_site',site_order_status:'cancelado'}),make('pix',55,{payment_method:'pix',payment_state:'pending'}),make('b',15,{change_for:20})];
const flow=cash.routeCashFlow(entries,30);
check('troco: apenas pedidos ainda cobrados em espécie',flow.cashOrders.map(item=>item.delivery.id).join(',')==='a,b');
check('troco: total econômico físico sem quitados/cancelados/Pix',flow.customerCharges===79);
check('troco: previsão de cédulas recebidas correta',flow.tenderedCash===120);
check('troco: R$ 41 de troco, não o troco de quitados',flow.requiredChange===41);
check('troco: usa R$ 30 da bag e R$ 11 de Pix',flow.plannedCashChange===30&&flow.plannedPixChange===11);
check('troco: valor físico retornado permanece consistente',flow.expectedPhysicalReturn===120);
check('troco: inicial inválido não contamina totais',cash.routeCashFlow([],Infinity).initialCash===0);
check('ação Dinheiro presente somente com cobrança real',cash.hasPhysicalCashForRoute(entries,0));
check('ação Dinheiro ausente quando só há pagos ou Pix',!cash.hasPhysicalCashForRoute(entries.filter(item=>['paid','past','pix','cancel'].includes(item.id)),0));
check('ação Dinheiro presente quando há troco inicial real',cash.hasPhysicalCashForRoute([],15));
check('ação Dinheiro ausente com troco não finito',!cash.hasPhysicalCashForRoute([],Infinity));

const attention=transpile('lib/operational-attention.ts',{
  '@/lib/delivery-finance':finance,
  '@/lib/integration/site-order':{
    isCancelledSiteDelivery:cancel,
    isSiteOrderAwaitingConfirmation:()=>false,
    isSiteOrderReleasedToLogistics:()=>false,
  },
  '@/lib/delivery-mode':{isDeliveryFulfillment:()=>true},
});
const tasks=attention.operationalAttentionTasks(entries);
check('fila não volta a cobrar pedido quitado',!tasks.some(task=>task.deliveryId==='paid'||task.deliveryId==='past'));
check('fila preserva somente cobranças operacionais reais',tasks.filter(task=>task.kind==='collect').length===2);
check('fila preserva pendência de Pix real',tasks.some(task=>task.deliveryId==='pix'&&task.kind==='pix_pending'));
const storage=transpile('lib/route-ui-storage.ts');
check('leitura segura em SSR',storage.readRememberedRouteId()===null);
storage.rememberOpenRouteId('rota-teste');check('gravação segura em SSR',true);
const memory=new Map();
global.window={localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,v)=>memory.set(key,v)}};
storage.rememberOpenRouteId('route-1');
check('última rota aberta preservada',storage.readRememberedRouteId()==='route-1');
check('chave de operação também preservada',memory.get('dfl-active-operational-route-v1')==='route-1');
check('cadastro recupera rota ativa',storage.readActiveOperationalRouteId()==='route-1');
storage.rememberActiveOperationalRouteId('route-3');
check('cadastro grava seleção manual',memory.get('dfl-active-operational-route-v1')==='route-3');
global.window={get localStorage(){throw Error('SecurityError')}};
check('leitura não quebra com acesso bloqueado pelo Android',storage.readRememberedRouteId()===null&&storage.readActiveOperationalRouteId()===null);
storage.rememberOpenRouteId('route-2');storage.rememberActiveOperationalRouteId('route-2');check('escrita não quebra com Storage indisponível',true);
global.window={localStorage:{getItem:()=> 'x'.repeat(1000),setItem:()=>{throw Error('QuotaExceededError')}}};
check('rota persistida inválida não reinicia Home',storage.readRememberedRouteId()===null);
storage.rememberOpenRouteId('route-2');check('falha de quota não impede ações da rota',true);
delete global.window;
const home=source('components/home/RouteAccordion.tsx');
check('card usa armazenamento seguro',home.includes('readRememberedRouteId()')&&home.includes('rememberOpenRouteId(route.id)'));
check('card de dinheiro utiliza motor financeiro único',home.includes('hasPhysicalCashForRoute(pendingDeliveries, route.change_money)'));
check('checklist ignora troco antigo de pedidos pagos',home.includes("change: deriveDeliveryPaymentState(delivery) === 'collect_on_delivery'"));
check('modal mantém opção Dinheiro somente com dinheiro físico',home.includes('hasPhysicalCash'));
check('liberação da rota não remove confirmação externa iFood',home.includes('confirmation_code'));
const creation=source('app/entregas/nova/page.tsx');
check('nova entrega recupera rota sem acessar Storage diretamente',creation.includes('readActiveOperationalRouteId()'));
check('nova entrega preserva escolha manual mesmo sem Storage',creation.includes('rememberActiveOperationalRouteId(r.id)'));
check('seleção de rota não depende de gravação no navegador',!creation.includes("localStorage.setItem('dfl-active-operational-route-v1'"));
for(const file of ['app/entregas/nova/page.tsx','components/home/RouteAccordion.tsx','lib/delivery-finance.ts','lib/route-cash-flow.ts','lib/route-ui-storage.ts']){
  const ast=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(`árvore TS sem erro: ${file}`,ast.parseDiagnostics.length===0);
}
const pre=source('scripts/pre-apk.cjs');
check('R17 registrada mantendo R16 e R15',pre.includes('verify-v111-r17-finance-route-safety.cjs')&&pre.includes('verify-v111-r16-premium-closeout.cjs')&&pre.includes('verify-v111-r15-global-premium.cjs'));
console.log(`V111 R17: ${count} verificações aprovadas`);
