#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = file => fs.readFileSync(file, 'utf8');
let passed = 0;
const check = (value, label) => { assert.ok(value, 'R231: ' + label); passed++; console.log('R231 OK:', label); };
const targets = [
  'lib/operation/pwa-reload-guard.ts',
  'components/pwa/PwaRuntime.tsx',
  'components/stock-supplies/StockSupplyForm.tsx',
  'components/operation/ConnectivityRecovery.tsx',
  'components/store/SiteInboxPanel.tsx',
  'components/home/DeliveryCard.tsx',
];
for (const path of targets) {
  const tree = ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  check(tree.parseDiagnostics.length === 0, 'AST sem erro: ' + path + ' ' + tree.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(' | '));
}
const src=read('lib/operation/pwa-reload-guard.ts');
const built=ts.transpileModule(src,{fileName:'pwa-reload-guard.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
check((built.diagnostics||[]).every(d=>d.category!==ts.DiagnosticCategory.Error),'helper compila sem diagnóstico');
const m={exports:{}};
vm.runInNewContext(built.outputText,{module:m,exports:m.exports,Number}, {filename:'pwa-reload-guard.ts',timeout:1200});
const safe=m.exports.mayApplyPwaUpdate;
check(typeof safe==='function','política de PWA é testável separadamente');
for (const [context,expected,label] of [
 [{pendingWrites:0,unverifiedWrites:0,editingForm:false},true,'sem pendências e sem edição pode atualizar'],
 [{pendingWrites:1,unverifiedWrites:0,editingForm:false},false,'uma gravação bloqueia reload'],
 [{pendingWrites:99,unverifiedWrites:0,editingForm:false},false,'fila longa bloqueia reload'],
 [{pendingWrites:0,unverifiedWrites:1,editingForm:false},false,'operação incerta bloqueia reload'],
 [{pendingWrites:0,unverifiedWrites:4,editingForm:false},false,'pendências antigas não liberam atualização'],
 [{pendingWrites:0,unverifiedWrites:0,editingForm:true},false,'rascunho em edição bloqueia reload'],
 [{pendingWrites:1,unverifiedWrites:1,editingForm:true},false,'todos os bloqueios coexistem'],
 [{pendingWrites:NaN,unverifiedWrites:0,editingForm:false},false,'contador inválido é conservador'],
 [{pendingWrites:Infinity,unverifiedWrites:0,editingForm:false},false,'contador infinito é conservador'],
 [{pendingWrites:-1,unverifiedWrites:0,editingForm:false},false,'contador negativo nunca libera'],
 ]) check(safe(context)===expected,label);
const pwa=read('components/pwa/PwaRuntime.tsx');
check(pwa.includes("readWriteJournal(owner)")&&pwa.includes("writeJournalSummary("),'PWA consulta status do diário R230');
check(pwa.includes("document.querySelector('[data-dfl-unsaved-form=\"true\"]')"),'PWA consulta edição ainda ativa');
check(pwa.includes('mayApplyPwaUpdate({')&&pwa.includes('pendingWrites: journal.pending')&&pwa.includes('unverifiedWrites: journal.unverified'),'PWA usa política central para reload');
check(pwa.indexOf('mayApplyPwaUpdate({')<pwa.indexOf('window.location.reload();'),'reload sucede a proteção');
check(pwa.includes("window.addEventListener(WRITE_JOURNAL_EVENT, applyUpdateWhenSafe)"),'pendências confirmadas reavaliam atualização');
check(pwa.includes("'dfl:operation-form-state'"),'estado do formulário reavalia atualização');
check(pwa.includes("'controllerchange'")&&pwa.includes("'SKIP_WAITING'")&&pwa.includes("await registration.update()"),'autoridade SW e atualização preservadas');
check(pwa.includes('Capacitor.isNativePlatform()'),'APK não registra worker');
check(pwa.includes('disposed = true;')&&pwa.includes('removeEventListener(WRITE_JOURNAL_EVENT')&&pwa.includes("removeEventListener('focus'"),'listeners PWA limpos no unmount');
check(!/getDocs\(|onSnapshot\(|runTransaction\(|setDoc\(/.test(pwa),'PWA não adiciona consultas nem escritas Firestore');
const supply=read('components/stock-supplies/StockSupplyForm.tsx');
check(supply.includes("data-dfl-unsaved-form={dirty || submitting ? 'true' : undefined}"),'compra marca rascunho/commit em curso');
check(supply.includes("new Event('dfl:operation-form-state')"),'mudança de edição notifica runtime');
check(supply.includes('await onSubmit({')&&supply.includes('submitInFlight.current = true;'),'compra mantém persistência e trava de duplo toque');
check(/finally\s*\{\s*submitInFlight\.current = false;/.test(supply),'compra libera lock no finally (V100.2)');
check(supply.includes('writeStockSupplyDraft(draftKey, formDraft)'),'rascunho preservado quando confirmação falha');
const recovery=read('components/operation/ConnectivityRecovery.tsx');
check(recovery.includes("const hasUnverified = readWriteJournal(owner).some(x => x.status === 'unverified')"),'recuperação distingue operação de reinício');
check(recovery.includes('const wasOffline = offlineSeen.current || hasUnverified'),'retomada permite reconsultar histórico incerto');
check(recovery.includes("document.addEventListener('visibilitychange', onForeground)")&&recovery.includes("window.addEventListener('dfl:app-foreground', onForeground)"),'retomada PWA e APK tratada');
check(recovery.includes('lastAttempt.current = Date.now();')&&recovery.indexOf('lastAttempt.current = Date.now();') > recovery.indexOf('timer.current = setTimeout('),'cooldown só inicia quando consulta realmente ocorre');
check(recovery.includes('mayReconcileAfterReconnect({')&&recovery.includes('RECONNECT_DELAY_MS'),'cooldown e política R230 preservados');
check(!/setInterval\(|onSnapshot\(|getDocs\(/.test(recovery),'nenhum polling ou listener Firestore novo');
check(recovery.includes('current.user?.uid !== owner')&&recovery.includes('current.isSyncing'),'reconciliação não cruza login ou sync concorrente');
const inbox=read('components/store/SiteInboxPanel.tsx');
check(inbox.includes('useDeferredValue(search)')&&inbox.includes('useDeferredValue(historySearch)'),'buscas da Caixa de Entrada são deferidas');
check(inbox.includes('projection.rows.filter')&&inbox.includes('searchSiteInboxRows('),'projeção canônica preservada');
check(inbox.includes('),[projection,filter,deferredSearch,focusedId])'),'busca deferida depende do termo estável');
check(inbox.includes('},[history,deferredHistorySearch,historyStatus])'),'histórico não filtra a cada tecla urgente');
check(inbox.includes('siteAllocationPreflight')&&inbox.includes('acknowledgeSiteOrders'),'alocação e recibo Site preservados');
check(!/\b(?:onSnapshot|getDocs)\s*\(/.test(inbox),'busca não acrescenta consulta Firebase');
const card=read('components/home/DeliveryCard.tsx');
check(card.includes("const feedbackId = `dfl-stop-lock-${delivery.id}`"),'fixação tem aviso independente do movimento');
check(card.includes('let saved = 0;')&&card.includes('groupedDeliveries.length > 1'),'parada multipedido mostra avanço');
check(card.includes('for (const item of groupedDeliveries) {')&&card.includes('await updateDelivery(item.id, {'),'sequência de escrita não vira lote parcial não tratado');
check(card.includes('toast.dismiss(feedbackId);')&&card.includes('Parada destravada.'),'feedback termina após confirmação');
check(card.includes('uma gravação anterior pode ter sido confirmada'),'falha parcial avisa conferência');
check(card.includes("if (dx < 0 && swipeCanCompleteOrUndo) void handleTriggerAction('complete')"),'gesto baixa/desfazer R229 preservado');
const pre=read('scripts/pre-apk.cjs');
for (const file of ['scripts/test-r231-global-closeout.cjs','scripts/test-r230-offline-recovery.cjs','scripts/test-r229-r3-swipe-undo.cjs','scripts/test-r228-r4-regression-compat.cjs'])
  check(pre.includes(`'${file}'`),'regressão preservada no PRE-APK: '+file);

// Fechamento transversal: proteger os pontos reportados antes da abertura.
const store = read('store/useAppStore.ts');
check(store.includes('changedRouteOrderDocuments(routeDeliveries, normalized, metadata)'), 'R229 não regrava todos os registros a cada seta');
check(store.includes('withRouteOrderWriteLock(routeId') && store.includes('queueDeliveryDocuments(queueEntityWrite,'), 'ordem mantém fila/lock transacional');
check(store.includes("beginOperationalWrite('route_order'") && store.includes("beginOperationalWrite('stock_integration'"), 'diário R230 continua observando rota e estoque');
check(store.includes('assertFreshRemoteImportIds('), 'importação com ID de plataforma permanece idempotente');
check(store.includes('runTransaction(db, async (transaction)'), 'estoque e operações críticas mantêm Firestore transacional');
check(store.includes('isCancelledSiteDelivery('), 'pedidos Site cancelados continuam protegidos');
const sparseOrder = read('lib/operation/route-sparse-order.ts');
check(sparseOrder.includes('changedRouteOrderDocuments') && !sparseOrder.includes('firebase/firestore'), 'diff de rota permanece helper puro');
const picker = read('components/stock-supplies/StockProductPicker.tsx');
check(picker.includes('window.visualViewport') && picker.includes('Resultados da busca'), 'modal de produto preserva suporte ao teclado Android');
const stockGuard = read('lib/stock-recommendation-guard.ts');
check(stockGuard.includes('configuredDeficit') && stockGuard.includes('observed>=21'), 'reposição não ignora mínimo/ideal configurados');
const siteInbox = read('components/store/SiteInboxPanel.tsx');
check(siteInbox.includes('siteAllocationPreflight') && siteInbox.includes('allocateSiteDelivery'), 'entrada do Site mantém alocação explícita de rota');
for (const regression of [
  'scripts/test-r228-operation-polish.cjs',
  'scripts/test-r228-r2-intelligent-routes.cjs',
  'scripts/test-r228-r3-parser-speed-status.cjs',
  'scripts/test-r227-operational-fastlane.cjs',
  'scripts/verify-v66-route-cancellation.cjs',
]) check(pre.includes(`'${regression}'`), 'regressão essencial preservada: ' + regression);

console.log(`R231 FECHAMENTO PREMIUM: ${passed} verificações aprovadas.`);
