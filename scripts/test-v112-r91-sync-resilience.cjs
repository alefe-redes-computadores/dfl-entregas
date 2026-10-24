#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
let total = 0;
function ok(name, value){assert.ok(value, 'R91: '+name); total++;console.log('OK R91:',name)}
function read(name){return fs.readFileSync(name,'utf8')}
for(const name of ['lib/operation/foreground-sync-policy.ts','lib/sync-diagnostics.ts','components/layout/Header.tsx','components/SiteOrderNotificationWatcher.tsx','components/auth/AuthGuard.tsx']){
 const tree=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok('sintaxe '+name,tree.parseDiagnostics.length===0);
}
const src=ts.transpileModule(read('lib/operation/foreground-sync-policy.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const sandbox={exports:{},Date,Number,Math};vm.runInNewContext(src,sandbox,{filename:'foreground-sync-policy.ts'});
const {shouldRefreshOnForeground: should, PASSIVE_REFRESH_INTERVAL_MS: passive, RECOVERY_REFRESH_INTERVAL_MS: recovery}=sandbox.exports;
const clock=Date.parse('2026-10-24T01:00:00Z');
const base={nowMs:clock,lastAttemptMs:clock-11*60_000,online:true,visible:true,lastSuccessfulSyncMs:null};
ok('mais de 10 minutos em primeiro plano permite refresh',should(base));
ok('intervalo passivo maior do que o legado de 2 minutos',passive>=600_000 && passive>recovery);
ok('nao disparar na abertura/reentrada precoce',!should({...base,lastAttemptMs:clock-15_000}));
ok('menos de 10 minutos nao repete leituras',!should({...base,lastAttemptMs:clock-8*60_000}));
ok('sem conexao nunca inicia consultas',!should({...base,online:false}));
ok('com app em segundo plano nao consulta',!should({...base,visible:false}));
ok('ultimo sync recente evita duplicacao',!should({...base,lastSuccessfulSyncMs:new Date(clock-2*60_000).toISOString()}));
ok('sucesso antigo autoriza refresh',should({...base,lastSuccessfulSyncMs:new Date(clock-9*60_000).toISOString()}));
ok('reconexao apos erro tem janela de 2 minutos',should({...base,recovering:true,lastAttemptMs:clock-130_000}));
ok('reconexao repetida em 1 minuto e contida',!should({...base,recovering:true,lastAttemptMs:clock-60_000}));
ok('erro nao mascara sucesso recente',!should({...base,recovering:true,lastSuccessfulSyncMs:new Date(clock-30_000).toISOString()}));
ok('relogio retrocedido nao libera consulta',!should({...base,lastAttemptMs:clock+1000}));
ok('timestamp invalido nao libera consulta',!should({...base,nowMs:NaN}));
const header=read('components/layout/Header.tsx'),watch=read('components/SiteOrderNotificationWatcher.tsx'),auth=read('components/auth/AuthGuard.tsx'),diag=read('lib/sync-diagnostics.ts'),pre=read('scripts/pre-apk.cjs');
ok('reentrada PWA e nativa continua com cleanup',header.includes("window.addEventListener('dfl:app-foreground', refreshOnForeground)") && header.includes("window.removeEventListener('dfl:app-foreground', refreshOnForeground)"));
ok('cooldown legado de 120s segue assegurado',header.includes('120_000') && header.includes('shouldRefreshOnForeground('));
ok('sem polling no Header',!header.includes('setInterval('));
ok('reconexao conecta e desconecta os listeners',header.includes("window.addEventListener('online', onNetworkOnline)") && header.includes("window.removeEventListener('online', onNetworkOnline)"));
ok('estado de rede diferencia falha de sincronizacao',header.includes('Sem conexão · dados locais') && header.includes('Falha na atualização · Tentar novamente'));
ok('ultimo sucesso preservado em caso de falha',header.includes('latestSuccessfulSyncDiagnostic()?.finishedAt') && diag.includes("item.status === 'success'"));
ok('acao manual independente com guarda offline',header.includes('refreshNow(true)') && header.includes('!navigator.onLine') && header.includes('Buscar pedidos novos'));
ok('eventos multiplos nao provocam consultas simultaneas',header.includes('lastForegroundSyncRef.current = Date.now()') && header.includes('refreshInFlightRef.current'));
ok('notificacao site ignora mutacoes locais ainda nao confirmadas',watch.includes('change.doc.metadata?.hasPendingWrites'));
ok('listener site segue unico e filtro estreito', (watch.match(/onSnapshot\(/g)||[]).length===1 && watch.includes("where('updated_at', '>', mountedAt)"));
ok('badge so grava quando ha novidades',watch.includes('if (newUnreadIds.length) markUnreadSiteOrders(newUnreadIds)'));
ok('notificacao site continua por documento',watch.includes('void notifyNewSiteOrder(') && watch.includes('const id = delivery.id || change.doc.id'));
ok('nova conta nunca herda trava de inicializacao',auth.includes('initializedUidRef.current !== currentUser.uid') && auth.includes('hasInitializedRef.current = false'));
ok('nao modifica query firestore / mutacoes de dados',!header.includes('getDocs(')&&!watch.includes('updateDoc(')&&!watch.includes('setDoc('));
ok('R91 integrada ao gate global',pre.includes('scripts/test-v112-r91-sync-resilience.cjs'));
for(const f of ['scripts/test-v112-r85-message-policy.cjs','scripts/test-v112-r86-form-feedback.cjs','scripts/test-v112-r87-operational-cards.cjs','scripts/test-v112-r88-home-settlement.cjs','scripts/test-v112-r89-performance.cjs','scripts/test-v112-r90-home-card-performance.cjs']) ok('cirurgia anterior preservada '+f,fs.existsSync(f) && pre.includes(f));
console.log(`=== V112 R91: ${total} contratos aprovados ===`);
