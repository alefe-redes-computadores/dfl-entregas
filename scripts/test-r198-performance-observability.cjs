#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
let total = 0;
function ok(label, cond) { assert.ok(cond, 'R198: '+label);total++;console.log('OK R198:',label); }
function read(p) { return fs.readFileSync(p,'utf8'); }
function load(p) {
 const src=read(p);
 const js=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 ok('TS transpila '+p,!(js.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error));
 const mod={exports:{}};
 vm.runInNewContext(js.outputText,{module:mod,exports:mod.exports,WeakMap,Map,Set,Math,Number,Array,Object}, {filename:p});
 return mod.exports;
}
const cache=load('lib/operation/collection-lookup-index.ts');
const d1={id:'1',route_id:'r1'},d2={id:'2',route_id:'r2'},d3={id:'3',route_id:'r1'};
const snap=[d1,d2,d3];
ok('busca ID preserva identidade',cache.findByIdIndexed(snap,'2')===d2);
ok('ID ausente nao encontra cliente',cache.findByIdIndexed(snap,'missing')===undefined && cache.findByIdIndexed(snap,undefined)===undefined);
ok('busca rota retorna somente rota alvo',cache.deliveriesForRouteIndexed(snap,'r1').map(x=>x.id).join(',')==='1,3');
ok('rota sem entregas retorna array vazio',cache.deliveriesForRouteIndexed(snap,'none').length===0);
const first=cache.deliveriesForRouteIndexed(snap,'r1');first.reverse();first.push(d2);
ok('consumidor nao modifica indice em cache',cache.deliveriesForRouteIndexed(snap,'r1').map(x=>x.id).join(',')==='1,3');
const changed={...d1,id:'1',route_id:'r2'};const snap2=[changed,d2,d3];
ok('novo snapshot invalida cache de ID',cache.findByIdIndexed(snap2,'1')===changed);
ok('novo snapshot invalida cache de rota',cache.deliveriesForRouteIndexed(snap2,'r1').map(x=>x.id).join(',')==='3');
ok('primeiro ID duplicado preservado como Array.find',cache.findByIdIndexed([d1,changed],'1')===d1);
const rank=load('lib/operation/sync-volume-ranking.ts').rankSyncCollectionVolumes;
const rec=(id,status,collections)=>({id,status,collections});
const rows=Array.from(rank([rec('1','success',{deliveries:100,customers:2}),rec('2','error',{deliveries:500}),rec('3','success',{deliveries:50,customers:4})]));
ok('ignora falhas no ranking',rows[0].name==='deliveries'&&rows[0].average===75&&rows[0].samples===2);
ok('mais retorno aparece primeiro',rows[1].name==='customers'&&rows[1].average===3);
ok('retorno vazio em diagnosticos so com falhas',rank([rec('1','error',{deliveries:999})]).length===0);
ok('bloqueia nomes maliciosos',rank([rec('1','success',{'__proto__.x':10,'a-token':4,stock:3})]).map(x=>x.name).join(',')==='stock');
const store=read('store/useAppStore.ts');
ok('getCustomerById indexado',store.includes('getCustomerById: (customerId) => findByIdIndexed(get().customers, customerId)'));
ok('rotas reais indexadas, sintéticas preservadas',store.includes('return deliveriesForRouteIndexed(state.deliveries, routeId)')&&store.includes("routeId === 'rota-site-aguardando-confirmacao'"));
const diag=read('app/mais/diagnostico/page.tsx');
ok('ranking sem consulta extra',diag.includes('rankSyncCollectionVolumes(entries)')&&diag.includes('collectionHotspots.map('));
ok('diagnostico atualiza por evento e limpa listener',diag.includes('window.addEventListener(SYNC_DIAGNOSTIC_EVENT, onRecorded)')&&diag.includes('window.removeEventListener(SYNC_DIAGNOSTIC_EVENT, onRecorded)'));
ok('permissoes da tela de diagnostico nao foram removidas',diag.includes('if (!user || !isAdmin) return null;'));
for(const f of ['app/mais/diagnostico/page.tsx','store/useAppStore.ts']) {
 const tree=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok('AST valida '+f,tree.parseDiagnostics.length===0);
}
console.log('R198: '+total+' contratos aprovados.');
