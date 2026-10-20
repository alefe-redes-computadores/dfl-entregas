// V111 R5: fechamento histórico e manual compartilham transação; cancelados não viram pendências.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (path) => fs.readFileSync(path, 'utf8');
const helper = read('lib/route-closure-eligibility.ts');
const ops = read('components/RouteOperations.tsx');
const store = read('store/useAppStore.ts');
const route = read('components/home/RouteAccordion.tsx');
const card = read('components/home/DeliveryCard.tsx');
const close = store.slice(store.indexOf('      closeRoute: async'), store.indexOf('      reopenRoute: async'));
const check = (ok, label) => { assert.ok(ok, label); console.log('OK:', label); };
check(helper.includes('active.length > 0 && active.every((delivery) => delivery.completed === true)'), 'somente concluídos ativos permitem autoencerramento');
check(helper.includes('!isCancelledSiteDelivery(delivery)'), 'cancelamentos não viram pendências');
check(ops.includes('void closeRoute(route.id, {') && !ops.includes('void updateRoute(route.id, {'), 'rotas históricas passam pelo fechamento transacional');
check(ops.includes('effectiveEndTime: route.end_time || end.toISOString()'), 'horário do dia histórico preservado');
check(store.includes('canAutoCloseRoute(') && (store.match(/canAutoCloseRoute\(/g)||[]).length >= 3, 'mudança de rota, conclusão e exclusão usam mesma elegibilidade');
check((store.match(/currentState.storeSettings.autoCloseCompletedRoutes !== false/g)||[]).length === 3, 'opção de desligar fechamento automático vale para todos os gatilhos');
check(close.includes('remoteRouteDeliveries = await getDocs') && close.includes('await runTransaction('), 'autoridade remota e transação mantidas');
check(close.includes('remote.completed !== true'), 'entrega remota ativa deve estar concluída');
check(close.includes('isCancelledSiteDelivery(remote) !==') && close.includes('isCancelledSiteDelivery(local)'), 'mudança remota de cancelamento bloqueia baixa indevida');
check(close.includes('auto_closed_at: options.autoClosedAt') && close.includes('end_time: closedAt'), 'carimbo automático e duração histórica preservados');
check(close.includes('analytics_sync_requested_at: now'), 'projeção analytics agenda processamento na hora real');
check(close.includes('addIfoodPendingConfirmations(confirmationItems)'), 'fila pós-rota iFood preservada');
check(route.includes('getDeliveriesByRoute(route.id).filter((delivery) => !isCancelledSiteDelivery(delivery))'), 'card operacional não conta cancelados');
check(card.includes('!isCancelledSiteDelivery(item) && !completedIds.has(item.id)'), 'aviso de última entrega ignora cancelados');
check(read('scripts/pre-apk.cjs').includes('scripts/verify-v111-r5-route-closure.cjs'), 'suíte incluída no PRE-APK');
console.log('V111 R5: 15 contratos de fechamento aprovados.');

// Teste executável da decisão de fechamento (sem Firestore, rede ou navegador).
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const originalResolve = Module._resolveFilename;
const root = process.cwd();
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) return originalResolve.call(this, path.join(root, request.slice(2)) + '.ts', parent, isMain, options);
  return originalResolve.call(this, request, parent, isMain, options);
};
Module._extensions['.ts'] = function(mod, filename) {
  const transpiled = ts.transpileModule(read(filename), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal((transpiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, filename);
  mod._compile(transpiled.outputText, filename);
};
const { canAutoCloseRoute, activeRouteDeliveries } = require('../lib/route-closure-eligibility.ts');
const active = {id:'a', route_id:'r', source_system:'dfl_entregas', completed:true};
const pending = {...active, id:'b', completed:false};
const cancelled = {id:'c', route_id:'r', source_system:'dfl_site', site_order_status:'cancelado', completed:false};
const routeOpen = {id:'r', status:'aberta', started_at:'2026-10-18T18:00:00-03:00'};
assert.equal(canAutoCloseRoute(routeOpen, [active]), true, 'uma entrega concluída permite encerrar');
assert.equal(canAutoCloseRoute(routeOpen, [active, cancelled]), true, 'cancelado não bloqueia fechamento');
assert.equal(canAutoCloseRoute(routeOpen, [cancelled]), false, 'somente cancelados não encerram automaticamente');
assert.equal(canAutoCloseRoute(routeOpen, [active, pending]), false, 'pendência ativa impede fechamento');
assert.equal(canAutoCloseRoute({...routeOpen, status:'fechada'}, [active]), false, 'rota fechada não tenta encerrar de novo');
assert.equal(canAutoCloseRoute({...routeOpen, started_at:undefined}, [active]), false, 'rota não iniciada não encerra');
assert.deepEqual(activeRouteDeliveries([active,cancelled,pending]).map(item => item.id), ['a','b']);
console.log('V111 R5: 7 cenários funcionais de fechamento aprovados.');
