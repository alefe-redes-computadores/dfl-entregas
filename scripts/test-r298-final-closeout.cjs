#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const read = p => fs.readFileSync(p, 'utf8');
let n=0;
const ok=(x,message)=>{assert.ok(x,'R298: '+message);n++;};
const eq=(a,b,message)=>{assert.deepEqual(a,b,'R298: '+message);n++;};
const files = [
 'lib/operation/top-limited.ts',
 'lib/operation/assistant-search-premium.ts',
 'components/messaging/MessagingOrderPicker.tsx',
 'scripts/pre-apk.cjs',
];
for(const file of files.filter(x=>x.endsWith('.ts')||x.endsWith('.tsx'))){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 eq(ast.parseDiagnostics.length,0,`sintaxe ${file}`);
}
const src='lib/operation/top-limited.ts';
const mod=new Module(src,module);
mod.filename=process.cwd()+'/'+src;
mod._compile(ts.transpileModule(read(src),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,mod.filename);
const {topRanked}=mod.exports;
const rng=(seed)=>{let x=seed>>>0;return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};};
for(const seed of [1,2,3,17,87,2026]){
 const random=rng(seed);
 const data=Array.from({length:3000},(_,id)=>({id,priority:Math.floor(random()*9),clock:Math.floor(random()*25)}));
 const compare=(a,b)=>a.priority-b.priority||b.clock-a.clock;
 const before=JSON.stringify(data);
 for(const cap of [0,1,3,12,15,40,120,3000,4000]){
  eq(topRanked(data,cap,compare).map(v=>v.id),[...data].sort(compare).slice(0,cap).map(v=>v.id),`top-K parity seed=${seed} cap=${cap}`);
 }
 eq(JSON.stringify(data),before,`dados nao modificados seed=${seed}`);
}
const search=read('lib/operation/assistant-search-premium.ts');
ok(search.includes('new WeakMap<readonly Customer[], Map<string, string>>()')&&search.includes('customerNameIndex(snapshot.customers)'), 'cache de clientes por snapshot');
ok(search.includes('ORDER_CLOCK_FORMATTER')&&search.includes('displayClock'), 'R297 preservada');
const picker=read('components/messaging/MessagingOrderPicker.tsx');
ok(picker.includes('topRanked(deliveries, 120')&&picker.includes('15, compare)'), 'seletor limita ranqueamento');
ok(picker.includes('manual_messaging_opt_in_v1')&&picker.includes('maskedMessagePhone'), 'autorizacao e privacidade preservadas');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r298-final-closeout.cjs'")&&pre.includes("'scripts/test-r290-auditoria-fechamento.cjs'")&&pre.includes("'scripts/test-r245-search360-premium.cjs'"),'suites historicas preservadas');
for(const file of [src,'lib/operation/assistant-search-premium.ts','components/messaging/MessagingOrderPicker.tsx']){
 const code=read(file);
 for(const expression of ['fetch(', 'getDocs(', 'onSnapshot(', 'setDoc(', 'runTransaction('])ok(!code.includes(expression),`${file} nao faz I/O (${expression})`);
}
console.log(`R298 FECHAMENTO: ${n} garantias PASS; busca, selecao estavel, OFF e sem acesso remoto.`);
