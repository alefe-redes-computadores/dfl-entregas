#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let assertions = 0;
function check(name, fn) { fn(); assertions++; console.log('OK R18:', name); }
function load(file, mocks = {}) {
  const input = fs.readFileSync(file, 'utf8');
  const transpiled = ts.transpileModule(input, { fileName: file, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  check(`transpilação ${file}`, () => assert.equal((transpiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0));
  const mod = new Module(path.resolve(file), module);
  mod.filename = path.resolve(file);
  mod.paths = module.paths;
  const fallback = mod.require.bind(mod);
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : fallback(id);
  mod._compile(transpiled.outputText, mod.filename);
  return mod.exports;
}
(async () => {
  const outcome = load('lib/integration/drain-outcome.ts');
  const assess = (reconcile, relay) => outcome.reverseDrainOutcome(reconcile, relay);
  check('Reconciliação e relay bons são sucesso', () => assert.deepEqual(assess({ ok: true }, { ok: true, failed: 0 }), { ok: true, httpStatus: 200 }));
  check('Falha de reconciliação não vira sucesso', () => assert.deepEqual(assess({ ok: false }, { ok: true, failed: 0 }), { ok: false, httpStatus: 207 }));
  check('Falha de relay sem failed contabilizado não vira sucesso', () => assert.equal(assess({ ok: true }, { ok: false, failed: 0 }).ok, false));
  check('Relay com falhas contabilizadas não vira sucesso', () => assert.equal(assess({ ok: true }, { ok: true, failed: 2 }).ok, false));
  check('Relay com unsettled não vira sucesso', () => assert.equal(assess({ ok: true }, { ok: true, unsettled: 1 }).ok, false));
  check('Etapa pulada intencionalmente é neutra', () => assert.equal(assess(null, { ok: true }).ok, true));
  check('Valor não finito não mascara falha', () => assert.equal(assess({ ok: true }, { ok: true, failed: Infinity }).ok, false));
  const api = fs.readFileSync('app/api/integration/outbox/drain/route.ts', 'utf8');
  check('API usa decisão canônica após as duas etapas', () => assert.match(api, /reverseDrainOutcome\(reconciliation, relay\)/));
  check('API preserva modos independentes de trabalho', () => { assert.match(api, /body\.reconcile !== false/); assert.match(api, /body\.drain !== false/); });
  check('API rejeita JSON nulo e tipos inválidos', () => { assert.match(api, /!parsed \|\| typeof parsed !== 'object'/); assert.match(api, /typeof input\.drain !== 'boolean'/); });
  check('API não anuncia sucesso sem executar etapas', () => assert.match(api, /Nenhuma etapa solicitada/));
  const deliverable = { event_id: 'evt-r18-test', kind: 'delivery.completed' };
  const sent = [], failed = [];
  let mockResponse = () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  const reverse = load('lib/integration/server/reverseRelay.ts', {
    'server-only': {},
    './reverseConfig': { assertReverseRelayConfigured: () => ({ batchSize: 5, lockMs: 10000, timeoutMs: 1000, targetUrl: 'https://example.invalid/events', signingSecret: 'test' }) },
    './reverseOutboxRepository': {
      claimReverseOutboxBatch: async () => [{ event: deliverable, refId: 'ref-1', attempts: 1 }],
      claimReverseOutboxByEventId: async () => ({ kind: 'not_claimed', state: { status: 'sent', attempts: 1 } }),
      markReverseOutboxFailed: async (input) => { failed.push(input); },
      markReverseOutboxSent: async (ref) => { sent.push(ref); },
    },
  });
  const oldFetch = global.fetch;
  global.fetch = async () => mockResponse();
  async function testRelay(label, response, success) {
    mockResponse = () => response;
    const beforeSent = sent.length, beforeFail = failed.length;
    const result = await reverse.drainReverseIntegrationOutbox();
    check(label, () => {
      assert.equal(result.ok, success);
      assert.equal(result.sent, success ? 1 : 0);
      assert.equal(result.failed, success ? 0 : 1);
      assert.equal(sent.length - beforeSent, success ? 1 : 0);
      assert.equal(failed.length - beforeFail, success ? 0 : 1);
    });
  }
  try {
    await testRelay('Site HTTP 200 JSON ok:true é confirmado', new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }), true);
    await testRelay('Site HTTP 200 JSON ok:false NÃO é confirmado', new Response('{"ok":false,"error":"falhou"}', { status: 200, headers: { 'content-type': 'application/json' } }), false);
    await testRelay('Site HTTP 200 success:false NÃO é confirmado', new Response('{"success":false}', { status: 200, headers: { 'content-type': 'application/json' } }), false);
    await testRelay('Site HTTP 200 com erro explícito NÃO é confirmado', new Response('{"error":"offline"}', { status: 200, headers: { 'content-type': 'application/json' } }), false);
    await testRelay('Site HTTP 200 HTML NÃO é confirmado', new Response('<!DOCTYPE html><html><body>404</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }), false);
    await testRelay('Site HTTP 200 JSON malformado NÃO é confirmado', new Response('{bad', { status: 200, headers: { 'content-type': 'application/json' } }), false);
    await testRelay('Site HTTP 500 NÃO é confirmado', new Response('error', { status: 500 }), false);
    await testRelay('Site HTTP 204 vazio permanece aceito (legado)', new Response(null, { status: 204 }), true);
  } finally { global.fetch = oldFetch; }
  const relaySource = fs.readFileSync('lib/integration/server/reverseRelay.ts', 'utf8');
  check('Relay não habilita dead_letter sem autorização', () => assert.doesNotMatch(relaySource, /allowDeadLetter:\s*true/));
  const pre = fs.readFileSync('scripts/pre-apk.cjs', 'utf8');
  check('Contrato R18 está no PRE-APK', () => assert.match(pre, /verify-v111-r18-integration-closeout\.cjs/));
  for (const file of ['lib/integration/drain-outcome.ts','lib/integration/server/reverseRelay.ts','app/api/integration/outbox/drain/route.ts']) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true);
    check(`árvore TypeScript válida ${file}`, () => assert.equal(ast.parseDiagnostics.length, 0));
  }
  console.log(`V111 R18: ${assertions} verificações aprovadas.`);
})().catch(error => { console.error('V111 R18 FALHOU:', error); process.exit(1); });
