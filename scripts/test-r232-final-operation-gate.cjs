#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const read = path => fs.readFileSync(path, 'utf8');
let count = 0;
function ok(condition, message) { assert.ok(condition, 'R232: '+message); count++; console.log('R232 OK:', message); }
for (const path of [
  'lib/operation/manual-delivery-id.ts',
  'app/entregas/nova/page.tsx',
  'scripts/pre-apk.cjs',
]) {
  if (path.endsWith('.cjs')) continue;
  const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  ok(tree.parseDiagnostics.length===0,'AST sem erro: '+path+' '+tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('|'));
}
const source=read('lib/operation/manual-delivery-id.ts');
const compiled=ts.transpileModule(source,{fileName:'manual-delivery-id.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
ok(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'helper transpila');
const evaluate=(cryptoStub,dateNow=()=>12345)=>{
  const m={exports:{}};
  const ctx={module:m,exports:m.exports,Math,Date:{now:dateNow},Uint8Array,Array,crypto:cryptoStub};
  vm.runInNewContext(compiled.outputText,ctx,{filename:'manual-delivery-id.ts',timeout:5000});
  return m.exports.createManualDeliveryId;
};
const cryptoUuid=evaluate({randomUUID:(()=>{let n=0;return ()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;})()});
const ids=new Set(Array.from({length:3000},()=>cryptoUuid()));
ok(ids.size===3000,'3000 cadastros no mesmo milissegundo recebem IDs distintos via UUID');
ok([...ids].every(id=>id.startsWith('dfl-')),'IDs manuais opacos e sem código comercial embutido');
const withBytes=evaluate({getRandomValues:(arr)=>{withBytes.n++;arr.fill(withBytes.n%256);return arr;}});
withBytes.n=0;
ok(new Set(Array.from({length:70},()=>withBytes())).size===70,'fallback criptográfico sem colisão quando randomUUID indisponível');
const withFallback=evaluate(undefined,()=>50);
ok(new Set(Array.from({length:900},()=>withFallback())).size===900,'WebView antigo: contador evita colisão no mesmo relógio');
const page=read('app/entregas/nova/page.tsx');
ok(page.includes("import { createManualDeliveryId } from '@/lib/operation/manual-delivery-id';"),'cadastro usa fonte única de IDs');
ok(page.includes('deliveriesToCreate.push({id:createManualDeliveryId()'),'multi-pedido gera ID próprio por linha');
const inlineManualId=page.includes('try {await addDelivery({id:createManualDeliveryId()');
// R305 introduziu registrationStage entre a criacao do ID e a escrita.
// Validar invariantes reais em vez de exigir tokens adjacentes no source.
const reusedManualId =
  page.includes('const manualDeliveryId = createManualDeliveryId();') &&
  /try\s*\{\s*await\s+addDelivery\(\{\s*id\s*:\s*manualDeliveryId\s*,/.test(page) &&
  page.includes('kickManualCreated(manualDeliveryId).then(');
ok(inlineManualId || reusedManualId,'cadastro individual usa ID sem colisão de relógio');
ok(!page.includes('id:Date.now().toString()') && !page.includes('id:index===0?Date.now().toString()'),'caminhos antigos de ID temporal excluídos');
const store=read('store/useAppStore.ts');
ok(store.includes('const canonicalId = deliveryImportDocumentId(delivery);')&&store.includes('if (canonicalId) delivery = { ...delivery, id: canonicalId };'),'iFood/99Food permanecem sob identidade comercial canônica');
ok(store.includes('assertFreshRemoteImportIds(') && store.includes('runTransaction(db, async (transaction)'),'importação de plataforma continua idempotente e transacional');
ok(store.includes('isCancelledSiteDelivery('),'cancelamento do Site permanece bloqueado');
ok(store.includes('changedRouteOrderDocuments(routeDeliveries, normalized, metadata)') && store.includes('withRouteOrderWriteLock(routeId'),'performance de rota e lock preservados');
ok(store.includes("beginOperationalWrite('route_order'")&&store.includes("beginOperationalWrite('stock_integration'"),'diário R230 ainda observa operações críticas');
const inbox=read('components/store/SiteInboxPanel.tsx');
// R232-R2: o componente obtém allocateSiteDelivery da store com alias local `allocate`.
// Verificamos o vínculo, a validação e a chamada efetiva; não exigimos o nome
// da ação exportada como chamada direta, pois isso reprovaria o fluxo correto.
ok(
  inbox.includes('const allocate = useAppStore(state=>state.allocateSiteDelivery);') &&
  inbox.includes('siteInboxProjection(deliveries,clock)') &&
  inbox.includes('const issue=siteAllocationPreflight({') &&
  inbox.includes('if(issue){setSaveError(issue);toast.warning(issue);return;}') &&
  inbox.includes('const routeId=await allocate(delivery.id,') &&
  store.includes('allocateSiteDelivery: async (deliveryId, target) => {') &&
  store.includes('const saved = await runTransaction(db, async (transaction) => {') &&
  store.includes('assertSiteRouteAllocation({'),
  'Site entra pela Caixa, valida o pedido e exige alocação explícita transacional'
);
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes('swipeCanCompleteOrUndo') && card.includes("handleTriggerAction('complete')"),'arrastar para desfazer baixa continua disponível');
const workflow=read('.github/workflows/main.yml');
ok(workflow.includes('name: Build Android APK DFL Entregas')&&workflow.includes('workflow_dispatch:'),'workflow Android existe e permite disparo manual');
ok(workflow.includes('node scripts/pre-apk.cjs')&&workflow.includes('node node_modules/typescript/bin/tsc --noEmit'),'Android Action exige todo gate TypeScript e PRE-APK');
ok(workflow.includes('dflStableDebug') && workflow.includes('ASSINATURA ANDROID VALIDADA'),'APK verifica assinatura estável antes da distribuição');
ok(workflow.includes('actions/upload-artifact@v4') && workflow.includes('retention-days: 14'),'APK é disponibilizado como artefato por 14 dias');
ok(!/\bfirebase deploy\b|\bgcloud\s+firestore\b/.test(workflow),'Action de APK não faz deploy de regras Firebase');
const pre=read('scripts/pre-apk.cjs');
for(const f of ['scripts/test-r232-final-operation-gate.cjs','scripts/test-r231-global-closeout.cjs','scripts/test-r230-offline-recovery.cjs','scripts/test-r229-r3-swipe-undo.cjs','scripts/test-r228-r4-regression-compat.cjs'])ok(pre.includes(`'${f}'`),'cadeia de regressão intacta: '+f);
console.log(`R232: ${count} contratos aprovados`);
