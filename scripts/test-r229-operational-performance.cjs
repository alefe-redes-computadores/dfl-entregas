#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const read=file=>fs.readFileSync(file,'utf8');
let checks=0;
const ok=(value,message)=>{assert.ok(value,'R229: '+message);checks++;console.log('R229 OK:',message)};
const pure='lib/operation/route-sparse-order.ts';
const source=read(pure);
const tree=ts.createSourceFile(pure,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
ok(tree.parseDiagnostics.length===0,'helper sparse TypeScript sintaticamente correto');
ok(!/firebase\/firestore|@\/lib\/firebase|onSnapshot|fetch\(/.test(source),'helper puro, sem Firestore ou rede');
const built=ts.transpileModule(source,{fileName:pure,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loadedModule={exports:{}};
vm.runInNewContext(built,{exports:loadedModule.exports,module:loadedModule,Map,Set,Array,console},{filename:pure,timeout:1000});
const changed=loadedModule.exports.changedRouteOrderDocuments;
ok(typeof changed==='function','função de diff exportada');
const before=Array.from({length:80},(_,i)=>({id:'order-'+i,order_index:i,order_locked:false,order_source:'smart',updated_at:'old'}));
const after=before.map(x=>({...x}));
[after[32],after[33]]=[{...after[33],order_index:32},{...after[32],order_index:33}];
const result=changed(before,after,{order_source:'manual',order_updated_at:'now'});
ok(result.length===2&&result.every(item=>item.id==='order-32'||item.id==='order-33'),'troca adjacente em 80 pedidos grava só 2');
ok(changed(before,before,{order_source:'manual'}).length===0,'sem alteração não gera commit vazio nem metadados artificiais');
const same=before.map(x=>({...x}));
same[4]={...same[4],order_locked:true};
ok(changed(before,same,{order_locked:true}).length===80,'trava explícita em lote continua cobrindo todos os pedidos que precisam travar');
ok(changed(before,before,{order_locked:false}).length===0,'trava já confirmada evita gravação redundante');
const grouped=[{id:'a',order_index:0},{id:'b',order_index:1},{id:'c',order_index:2},{id:'d',order_index:3}];
const groupedNext=[{...grouped[2],order_index:0},{...grouped[3],order_index:1},{...grouped[0],order_index:2},{...grouped[1],order_index:3}];
ok(changed(grouped,groupedNext).length===4,'parada multipedido move todos os documentos envolvidos');
const sparse=changed(before,[{id:'new',order_index:0}]);
ok(sparse.length===1,'registro novo nunca é ignorado');
const store=read('store/useAppStore.ts');
// R229-R2: the first `toggleDeliveryExpansion:` appears in the Zustand
// interface, BEFORE the runtime setDeliveryOrder implementation. Scope
// the test to the action implementation, not the interface declaration.
const runtimeStart=store.indexOf('      setDeliveryOrder: async (routeId, orderedPendingIds, options) => withRouteOrderWriteLock(routeId, async () => {');
const runtimeEnd=store.indexOf('      toggleDeliveryExpansion: (id, isExpanded) => {',runtimeStart);
ok(runtimeStart >= 0 && runtimeEnd > runtimeStart, 'teste encontra o bloco real da ação de ordenação');
const routeBlock=store.slice(runtimeStart,runtimeEnd);
ok(routeBlock.includes('changedRouteOrderDocuments(routeDeliveries, normalized, metadata)'),'store aplica diff à mesma autoridade de ordem');
ok(routeBlock.includes('changed.forEach((delivery) => {'),'batch persiste apenas mudança efetiva');
ok(routeBlock.includes('queueDeliveryDocuments(queueEntityWrite, normalized.map((delivery) => delivery.id), () => batch.commit())'),'lock de documentos mantém contrato concorrente R94');
ok(routeBlock.includes('rollbackRouteOrderFields(')&&routeBlock.includes('new Set(changed.map((delivery) => delivery.id))'),'rollback limita-se a mudanças da tentativa falha');
ok(routeBlock.includes("recordActionLatency('route_order_commit'")&&routeBlock.includes("'failed', changed.length"),'telemetria separa falha e confirmação do lote');
const card=read('components/home/DeliveryCard.tsx');
const route=read('components/home/RouteAccordion.tsx');
ok(card.includes('data-dfl-stop-id={delivery.id}') && route.includes('previousStopPositions'),'identidade de parada permite animação sem trocar conteúdo');
ok(route.includes('useLayoutEffect(') && route.includes('element.animate([') && route.includes("prefers-reduced-motion: reduce"),'FLIP anima deslocamento e respeita acessibilidade');
ok(card.includes('Posição atualizada localmente · confirmando no servidor')&&card.includes('reorderBusyRef.current = false'),'posição local e confirmação remota distintas');
ok(card.includes('disabled={reorderBusy || orderLocked || (position || 1) <= 1}'),'reordenação concorrente bloqueada até confirmação');
const purchase=read('components/stock-supplies/StockSupplyForm.tsx');
ok(purchase.includes('purchaseConfirmationTimer.current = setTimeout(')&&purchase.includes('clearTimeout(purchaseConfirmationTimer.current)'),'compra lenta dá feedback e limpa timer');
ok(purchase.includes('remotePurchaseSavedRef.current = true;')&&purchase.includes('await onSubmit({')&&purchase.includes('ainda não é uma gravação confirmada'),'compra preserva confirmação remota e rascunho');
const create=read('app/entregas/nova/page.tsx');
ok(create.includes('deliveryConfirmationTimer.current = setTimeout(')&&create.includes('clearTimeout(deliveryConfirmationTimer.current)'),'cadastro lento dá feedback sem novo request');
ok(create.includes("recordActionLatency('delivery_form_confirm'")&&create.includes('submitFlight.current=false;setIsSaving(false)'),'cadastro mantém proteção contra duplo envio e cronômetros');
const diag=read('lib/operation/action-latency.ts');
ok(diag.includes("route_order_commit: 'Rota · confirmar ordem (lote enxuto)'")&&diag.includes("'route_order_commit'"),'diagnóstico expõe tempo de confirmação da rota');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r229-operational-performance.cjs'")&&pre.includes("'scripts/test-v112-r94-delivery-concurrency.cjs'")&&pre.includes("'scripts/test-r228-r4-regression-compat.cjs'"),'regressões novas e antigas preservadas no PRE-APK');
for(const file of ['store/useAppStore.ts','components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx','components/stock-supplies/StockSupplyForm.tsx','app/entregas/nova/page.tsx']){
 const syntax=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(syntax.parseDiagnostics.length)for(const d of syntax.parseDiagnostics.slice(0,2))console.error(file,ts.flattenDiagnosticMessageText(d.messageText,' '));
 ok(syntax.parseDiagnostics.length===0,'AST TypeScript/JSX '+file);
}
console.log(`R229: ${checks} contratos e cenários estruturais aprovados.`);
