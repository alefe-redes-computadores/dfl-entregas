const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const read = name => fs.readFileSync(name,'utf8');
let checks = 0;
function test(label, fn) { fn(); checks++; console.log(`✓ ${label}`); }
function loadPureTs(path, overrides = {}) {
  const js = ts.transpileModule(read(path), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  assert.equal((js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `Syntax ${path}`);
  const context = { exports: {}, require, ...overrides };
  vm.runInNewContext(js.outputText, context, { filename: path, timeout: 2000 });
  return context.exports;
}
const { relayStageSucceeded, recoveryCheckpointEligible } = loadPureTs('lib/integration/worker-health.ts');
const relay = (value, failed = 0) => ({ ok: true, value: { ok: value, failed } });
const failure = {ok: false, error: 'offline'};
const recovery = (count, ids = []) => ({ ok: true, value: {
  ok: true, statusRecoveryReplayEnabled: true, statusRecoveryReplayRead: count, statusRecoveryReplayEventIds: ids,
}});
test('Worker vazio não indica falha', () => assert.equal(relayStageSucceeded(null), true));
test('Worker com lote integralmente enviado', () => assert.equal(relayStageSucceeded(relay(true,0)), true));
test('Worker sem exceção mas lote com erro deve falhar', () => assert.equal(relayStageSucceeded(relay(false,1)), false));
test('Worker ok:true com failed > 0 deve falhar', () => assert.equal(relayStageSucceeded(relay(true,1)), false));
test('Worker exception deve falhar', () => assert.equal(relayStageSucceeded(failure), false));
test('Replay sem eventos pode concluir sem relay', () => assert.equal(recoveryCheckpointEligible(recovery(0), null, 40), true));
test('Replay com eventos só conclui após relay ok', () => assert.equal(recoveryCheckpointEligible(recovery(2,['x']), relay(true),40), true));
test('Replay com falha preserva checkpoint aberto', () => assert.equal(recoveryCheckpointEligible(recovery(2,['x']), relay(false,1),40), false));
test('Replay exception preserva checkpoint aberto', () => assert.equal(recoveryCheckpointEligible(recovery(2,['x']), failure,40), false));
test('Replay ainda não enviado não conclui', () => assert.equal(recoveryCheckpointEligible(recovery(2,['x']), null,40), false));
test('Página cheia (40) não deve ser declarada concluída', () => assert.equal(recoveryCheckpointEligible(recovery(40), relay(true),40), false));
test('Amostra 39 pode concluir se houve aceite', () => assert.equal(recoveryCheckpointEligible(recovery(39,['x']), relay(true),40), true));
test('Falha de reconciliação não conclui', () => assert.equal(recoveryCheckpointEligible(failure,relay(true),40), false));
test('Replay desabilitado não conclui', () => assert.equal(recoveryCheckpointEligible({ok:true,value:{...recovery(0).value,statusRecoveryReplayEnabled:false}},null,40),false));
const worker = read('app/api/integration/worker/route.ts');
test('Worker propaga falha interna da fila ao resultado global', () => assert.match(worker, /relayStageSucceeded\(relay\)/));
test('Worker não conclui replay antes do relay', () => assert.match(worker, /recoveryCheckpointEligible\(reconciliation, statusRecoveryRelay, 40\)/));
test('Worker limita tentativas de replay e leituras históricas', () => { assert.match(worker, /lastRecoveryAttempt/);assert.match(worker,/15 \* 60 \* 1000/); });
test('Worker não reenvia dead_letter manualmente', () => assert.doesNotMatch(worker,/allowDeadLetter:\s*true/));
const route = read('components/RouteOperations.tsx');
test('Fechamento histórico usa índice por rota', () => assert.match(route,/deliveriesByRoute = new Map/));
test('Fechamento histórico mantém confirmação Firestore', () => assert.match(route,/void closeRoute\(route.id/));
test('Fechamento histórico evita repetição em falha', () => assert.match(route,/failedAutoCloseAt\.current\.set\(route.id/));
test('Fechamento histórico respeita configuração do operador', () => assert.match(route,/settings\.autoCloseCompletedRoutes === false/));
const auto = read('hooks/useStoreAutomation.ts');
test('Automação evita corrida entre foco e timer', () => {assert.match(auto,/disposed \|\| checking/);assert.match(auto,/checking = false;/);assert.match(auto,/finally \{\s*checking = false;/)});
const inbox = loadPureTs('lib/site-order-inbox.ts', {
  window: {events:[],dispatchEvent(e){this.events.push(e);}},
  localStorage: (() => { const data = new Map();return {getItem: k => data.get(k)||null,setItem:(k,v)=>data.set(k,v)};})(),
  CustomEvent: class {constructor(name, init){this.type=name;this.detail=init.detail}},
});
test('Inbox vazia não dispara evento desnecessário', () => {inbox.markUnreadSiteOrders([]);assert.equal(inbox.readUnreadSiteOrderIds().length,0)});
test('Novo pedido aparece uma vez', () => { inbox.markUnreadSiteOrders(['a']);assert.deepEqual(Array.from(inbox.readUnreadSiteOrderIds()),['a']) });
test('Inbox deduplica ID já presente', () => {inbox.markUnreadSiteOrders(['a']);assert.deepEqual(Array.from(inbox.readUnreadSiteOrderIds()),['a']);});
test('Inbox mantém ordem e reconhece novo ID', () => {inbox.markUnreadSiteOrders(['b','a']);assert.deepEqual(Array.from(inbox.readUnreadSiteOrderIds()),['b','a']);});
const kick = read('lib/integration/client/routeKick.ts');
test('Fast lane reconhece processamento concorrente como repetível', () => assert.match(kick,/relay\?\.inFlight/));
test('Fast lane exige JSON ok:true, não só HTTP 200', () => assert.match(kick,/response\.ok && result\.ok === true/));
for(const file of [
  'app/api/integration/worker/route.ts', 'lib/integration/worker-health.ts',
  'lib/integration/client/routeKick.ts', 'hooks/useStoreAutomation.ts',
  'components/RouteOperations.tsx', 'lib/site-order-inbox.ts',
]) {
  test(`TypeScript syntax ${file}`, () => {
    const result = ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020}});
    const errors = (result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.equal(errors.length,0, `${file}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join(';')}`);
  });
}
console.log(`V111 R7 — ${checks} verificações aprovadas`);
