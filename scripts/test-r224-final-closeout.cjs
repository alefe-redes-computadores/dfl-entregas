#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function ok(v,msg){ assert.ok(v,`R224: ${msg}`);checks++;console.log('OK R224:',msg); }
const paths=[
  'lib/operation/action-latency.ts',
  'store/useAppStore.ts',
  'components/home/DeliveryCard.tsx',
  'components/home/RouteAccordion.tsx',
  'components/store/SiteInboxPanel.tsx',
  'components/stock/StockBarcodeFinder.tsx',
  'components/routes/RouteDepartureChecklist.tsx',
  'app/mais/diagnostico/page.tsx',
  'scripts/pre-apk.cjs',
];
for(const file of paths.filter(p=>p.endsWith('.ts')||p.endsWith('.tsx'))){
 const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(tree.parseDiagnostics.length) {
  const diag=tree.parseDiagnostics[0];throw Error(`${file}: ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
 }
 ok(true,'AST '+file);
}
const q=read('lib/operation/action-latency.ts');
const events=[];
const memory=new Map();
const browser={
  localStorage:{getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
  dispatchEvent:e=>events.push(e.type),
};
const fakeEvent=class{constructor(type){this.type=type}};
const mod={exports:{}};
const compiled=ts.transpileModule(q,{fileName:'action-latency.ts',compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,window:browser,Event:fakeEvent,Date,JSON,Math,Number,Array,Object,String}, {filename:'action-latency.ts'});
const latency=mod.exports;
latency.recordActionLatency('stop_completion',1800,'confirmed',2);
latency.recordActionLatency('delivery_critical',8500,'failed',1);
ok(latency.readActionLatencies().length===2,'registrador opera sem rede');
ok(latency.readActionLatencies()[0].kind==='delivery_critical'&&latency.readActionLatencies()[1].itemCount===2,'categorias e contagem preservadas');
ok(events.length===2&&events.every(e=>e===latency.ACTION_LATENCY_EVENT),'atualizacao sob evento local');
latency.recordActionLatency('private_customer_id',3000,'confirmed',1);
latency.recordActionLatency('stop_completion',Number.NaN,'confirmed',1);
ok(latency.readActionLatencies().length===2,'evento invalido nao entra no historico');
for(let i=0;i<90;i++)latency.recordActionLatency('route_start',100+i,'confirmed',1);
ok(latency.readActionLatencies().length===60,'historico e limitado');
ok(!JSON.stringify(latency.readActionLatencies()).includes('private_customer_id'),'sem IDs arbitrarios no registro');
const malicious=[{...latency.readActionLatencies()[0],kind:'pedido:joao',extra:'telefone'},{...latency.readActionLatencies()[1],at:'not-a-date'},{kind:'stop_completion',durationMs:2300,itemCount:1,status:'partial',at:new Date().toISOString(),extra:'name'}];
const safe=latency.sanitizeActionLatencies(malicious);
ok(safe.length===1&&Object.keys(safe[0]).sort().join(',')==='at,durationMs,itemCount,kind,status','sanitizacao elimina campos desconhecidos e registros falsos');
const summary=latency.summarizeActionLatencies(latency.readActionLatencies());
ok(summary.length>0&&summary[0].kind==='route_start'&&summary[0].p90Ms>0,'resumo inclui tempos e P90');
ok(latency.actionLatencyDiagnosticText(latency.readActionLatencies()).includes('sem IDs'),'copia nao contem identidade');
latency.clearActionLatencies();
ok(latency.readActionLatencies().length===0,'limpar historico operacional funciona');
const store=read('store/useAppStore.ts');
ok(store.includes("import { recordActionLatency } from '@/lib/operation/action-latency'"),'store utiliza métrica local');
ok(store.includes("recordActionLatency('delivery_critical', total, 'confirmed')")&&store.includes("recordActionLatency('delivery_queue', Math.max(0, criticalRemoteStartedAt - criticalQueuedAt), 'confirmed')"),'separacao de espera local e commit');
ok(store.includes("recordActionLatency('delivery_critical', Date.now() - criticalQueuedAt, 'failed')"),'falha transacional também medida');
ok(store.includes('const [currentSnap, routeSnap] = await Promise.all([')&&store.includes('assertRemoteDeliveryTransition(deliveryToUpdate, remoteDelivery, dataWithTimestamp, remoteRoute, needsRoute)'),'R222 e autoridade remota intactas');
ok(store.includes("queueDeliveryDocuments(queueEntityWrite, [id], () =>")&&store.includes("queueEntityWrite('customers', customer.id, commitCritical)"),'R93/R94 preservam fila dos documentos');
ok(store.includes('if (deliveryCommitCompleted)')&&store.includes('if (deletionCommitted)'),'sem rollback tardio de escrita confirmada');
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes("recordActionLatency('stop_completion', completionTotalMs, 'confirmed', targets.length)"),'baixa confirmada gera medição');
ok(card.includes("completedIds.size ? 'partial' : 'failed'"),'baixa parcial nao é sucesso integral');
ok(card.includes('for (const item of targets)')&&card.includes('await updateDelivery(item.id, updatePayload)'),'integração por pedido e erros individuais preservados');
ok(card.includes('completionBusyRef.current')&&card.includes('disabled={completionBusy}'),'trava antiduplo toque mantida');
const route=read('components/home/RouteAccordion.tsx');
ok(route.includes("recordActionLatency('route_start', latencyMs, 'confirmed')")&&route.includes("recordActionLatency('route_close', Date.now() - closeStartedAt, 'confirmed')"),'início e fechamento medidos depois de persistir');
ok(route.includes("if (!closePersisted) recordActionLatency('route_close'")&&route.includes('routeActionLock.current = true'),'sem falso erro depois do commit e sem duplo fechamento');
for(const file of ['components/store/SiteInboxPanel.tsx','components/stock/StockBarcodeFinder.tsx']){
 const x=read(file);
 ok(x.includes('createPortal(')&&x.includes('document.body'),'modal fora do contexto transformado: '+file);
 ok(x.includes('100dvh')&&x.includes('overscroll-contain')&&x.includes('safe-area-inset-bottom'),'tela compacta, rolagem e safe area: '+file);
}
ok(read('components/routes/RouteDepartureChecklist.tsx').includes('data-dfl-checklist-footer="true"'),'checklist possui footer fixo');
const diag=read('app/mais/diagnostico/page.tsx');
ok(diag.includes('data-dfl-action-latency="true"')&&diag.includes('summarizeActionLatencies(latencies)'),'diagnóstico de tempos renderizado na tela admin');
ok(diag.includes('actionLatencyDiagnosticText(latencies)')&&diag.includes('clearActionLatencies()'),'exportação e limpeza cobrem tempos locais');
ok(!q.includes('firebase/firestore')&&!q.includes('fetch(')&&!q.includes('getDocs('),'registrador local não cria nenhuma chamada remota');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r224-final-closeout.cjs'")&&pre.includes("'scripts/test-r222-preopening-fastlane.cjs'"),'R224 e R222 registradas no gate');
const risky=['firestore.rules','firebase.json','lib/access/roles.ts'];
ok(!paths.some(file=>risky.includes(file)),'nenhuma regra, permissao ou credencial mudada');
console.log(`R224 FECHAMENTO: ${checks} verificacoes executaveis/estruturais aprovadas`);
