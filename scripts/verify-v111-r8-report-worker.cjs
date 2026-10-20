// V111 R8 — checkpoint diário pós-sucesso e retry controlado.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let total = 0;
function check(name, callback) { callback(); total++; console.log('✓', name); }
function loadTs(name) {
  const source = fs.readFileSync(name, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: name, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const errors = (result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${name}: erro de sintaxe`);
  const context = { exports: {}, require };
  vm.runInNewContext(result.outputText, context, { filename: name, timeout: 2000 });
  return context.exports;
}
const { shouldAttemptDailyReports, reportsCheckpointEligible, relayStageSucceeded } = loadTs('lib/integration/worker-health.ts');
const today = '2026-10-18';
const now = Date.parse('2026-10-18T13:00:00.000Z');
const cooldown = 30 * 60 * 1000;
const due = (hour, completed, attempt) => shouldAttemptDailyReports(hour, completed, today, attempt, now);
check('Antes das 4h não executa rotina diária', () => assert.equal(due(3, '', NaN), false));
check('Às 4h pode iniciar se ainda não concluiu', () => assert.equal(due(4, '', NaN), true));
check('Se worker perdeu janela 4h, recupera mais tarde', () => assert.equal(due(12, '', NaN), true));
check('Rotina concluída hoje não é executada outra vez', () => assert.equal(due(18, today, NaN), false));
check('Rotina de ontem não bloqueia a de hoje', () => assert.equal(due(5, '2026-10-17', NaN), true));
check('Nova tentativa imediata é bloqueada', () => assert.equal(due(5, '', now - 1), false));
check('Após 29 minutos ainda aguarda', () => assert.equal(due(5, '', now - cooldown + 60_000), false));
check('Após 30 minutos pode recuperar', () => assert.equal(due(5, '', now - cooldown), true));
check('Horário futuro não dispara repetição', () => assert.equal(due(5, '', now + 100_000), false));
const good = { ok: true, value: { ok: true } };
const incomplete = { ok: true, value: { ok: false } };
const failed = { ok: false, error: 'offline' };
check('Reconciliação boa permite gravar checkpoint', () => assert.equal(reportsCheckpointEligible(true, good), true));
check('Sem agendamento não grava checkpoint', () => assert.equal(reportsCheckpointEligible(false, good), false));
check('Falha de negócio não marca conclusão', () => assert.equal(reportsCheckpointEligible(true, incomplete), false));
check('Falha de exceção não marca conclusão', () => assert.equal(reportsCheckpointEligible(true, failed), false));
check('Ausência de reconciliação não marca conclusão', () => assert.equal(reportsCheckpointEligible(true, null), false));
check('Relay com falha continua falha', () => assert.equal(relayStageSucceeded({ok:true,value:{ok:false,failed:1}}), false));
const worker = fs.readFileSync('app/api/integration/worker/route.ts','utf8');
const claim = worker.slice(worker.indexOf('async function claimAutomaticWork'),worker.indexOf('async function run'));
check('Claim registra tentativa mas não falsifica conclusão', () => { assert.match(claim, /last_reports_attempt_at/); assert.doesNotMatch(claim, /last_reports_key: clock\.dateKey/); });
check('Checkpoint só após reconciliação', () => { assert.match(worker, /reportsCheckpointEligible\(Boolean\(mode === 'auto' && schedule\?\.reports\), reconciliation\)/); assert.match(worker, /last_reports_key: schedule!\.clock\.dateKey/); });
check('Resultado global exige sucesso de negócio na reconciliação', () => assert.match(worker, /reconciliation\.ok && reconciliation\.value\.ok === true/));
check('Falha no checkpoint contamina resultado global', () => assert.match(worker, /reportsCheckpointOk &&/));
check('Diagnóstico revela falha de relatório', () => assert.match(worker, /reportsNeedsReview/));
check('Nenhuma ação explícita sobre WhatsApp ou dead letters', () => { assert.doesNotMatch(worker, /\/message\/sendText|allowDeadLetter:\s*true/); });
check('Suite R8 integra PRE-APK', () => assert.match(fs.readFileSync('scripts/pre-apk.cjs','utf8'), /scripts\/verify-v111-r8-report-worker\.cjs/));
for (const name of ['lib/integration/worker-health.ts', 'app/api/integration/worker/route.ts']) {
  check('Sintaxe TypeScript '+name, () => {
    const result = ts.transpileModule(fs.readFileSync(name,'utf8'), {fileName:name,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
    assert.equal((result.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0);
  });
}
console.log(`V111 R8 — ${total} verificações aprovadas`);
