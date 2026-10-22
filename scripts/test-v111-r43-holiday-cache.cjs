#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('lib/store/holidayCache.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
let requests=0,mode='ok',clock=1000000,checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++};
class Clock extends Date {static now(){return clock}}
const scope={exports:{},module:{exports:{}},Date:Clock,Number,Error,Array,Promise,AbortController,setTimeout,clearTimeout,fetch:async(url)=>{
 requests++;
 if(mode==='error')throw new Error('network down');
 if(mode==='bad')return{ok:false,status:500};
 return {ok:true,json:async()=>[{date:'2026-12-25',name:'Natal'},{date:'broken'},{invalid:true}]};
}};
scope.exports=scope.module.exports;vm.runInNewContext(code,scope);
const load=scope.module.exports.loadHolidayCalendar;
(async()=>{
 const results=await Promise.all([load(2026),load(2026),load(2026)]);check(requests===1,'Requisicoes em voo compartilhadas');check(results.every(items=>items.length===1),'Itens invalidos removidos');
 await load(2026);check(requests===1,'Cache evita nova consulta');
 clock+=6*60*60*1000+1000;await load(2026);check(requests===2,'TTL expira');
 mode='bad';let denied=false;try{await load(2027)}catch{denied=true}check(denied,'HTTP 500 bloqueado');
 mode='ok';await load(2027);check(requests===4,'Falha nao envenena cache');
 mode='error';denied=false;try{await load(2028)}catch{denied=true}check(denied,'Rede indisponivel');
 mode='ok';await load(2028);check(requests===6,'Retry apos falha');
 denied=false;try{await load(1800)}catch{denied=true}check(denied,'Ano invalido negado');
 console.log('R43 HOLIDAY CACHE:',checks,'behavioral checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
