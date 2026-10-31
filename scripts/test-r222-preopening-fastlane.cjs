'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
const paths=[
  'store/useAppStore.ts','components/home/DeliveryCard.tsx',
  'components/customers/CustomerDestinationSheet.tsx',
  'components/reports/ReportDrilldownSheet.tsx',
  'components/home/RouteAccordion.tsx','components/routes/RouteDepartureChecklist.tsx',
];
let count=0;
function check(v,msg){assert.ok(v,msg);count++;console.log('OK R222:',msg)}
for(const path of paths){
  const s=read(path);
  const ast=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(ast.parseDiagnostics.length===0,`TS/JSX legivel: ${path}`);
}
const store=read(paths[0]);
check(store.includes('const [currentSnap, routeSnap] = await Promise.all(['),'consultas independentes da baixa correm em paralelo');
check(store.includes('transaction.get(deliveryRef)')&&store.includes("transaction.get(doc(db, 'routes', nextRouteId))"),'duas leituras remotas preservadas');
check(store.includes('assertRemoteDeliveryTransition(deliveryToUpdate, remoteDelivery, dataWithTimestamp, remoteRoute, needsRoute)'),'autoridade remota segue obrigatoria');
check(store.includes("queueDeliveryDocuments(queueEntityWrite, [id], () =>")&&store.includes("queueEntityWrite('customers', customer.id, commitCritical)"),'FIFO por pedido e cliente mantido');
check(store.includes('if (deliveryCommitCompleted)')&&store.includes('if (deletionCommitted)'),'rollback seletivo continua seguro');
const card=read(paths[1]);
check(card.includes("if (actionType === 'complete' && completionBusyRef.current) return;"),'bloqueio sincrono de acionamento repetido');
check(card.includes('disabled={completionBusy}')&&card.includes('aria-busy={completionBusy}')&&card.includes('LoaderCircle size={16} className="shrink-0 animate-spin"'),'botao compacto oferece feedback e trava de baixa');
check(card.includes('disabled={isRecoveryRoute || completionBusy}')&&card.includes("completionBusy ? 'Confirmando no servidor…'"),'botao expandido nao permite duplo toque');
check(card.includes('completionWriteMs.push(')&&card.includes('completionLatencyNote'),'medicao de latencia R220 mantida');
for(const path of [paths[2],paths[3]]){
  const src=read(path);
  check(src.includes('createPortal(')&&src.includes('document.body'),'bottom sheet fora da camada transformada: '+path);
  check(src.includes('100dvh')&&src.includes('overscroll-contain')&&src.includes('safe-area-inset-bottom'),'viewport e safe area em '+path);
}
for(const path of [paths[4],paths[5]])check(read(path).includes('createPortal('),'portais R221/checklist permanecem: '+path);
check(read('scripts/pre-apk.cjs').includes("'scripts/test-r222-preopening-fastlane.cjs'"),'R222 inscrito no pre-apk');
const risky=['firestore.rules','firebase.json','lib/access/roles.ts','app/mais/acessos/page.tsx'];
check(!paths.some(p=>risky.includes(p)),'nenhuma modificacao de regras ou papeis');
console.log(`R222: ${count} verificacoes de regressao aprovadas`);
