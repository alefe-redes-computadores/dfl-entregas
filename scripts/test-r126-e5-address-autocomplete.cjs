#!/usr/bin/env node
'use strict';
const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const path='lib/address-autocomplete.ts';
const input=fs.readFileSync(path,'utf8');
const tree=ts.createSourceFile(path,input,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(tree.parseDiagnostics.length,0,'TS parse');
const js=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let pending=[];
const context={exports:{},AbortController,URLSearchParams,Date,Number,String,Array,Map,Set,Error,console,process:{env:{NEXT_PUBLIC_GEOAPIFY_API_KEY:'FAKE_TEST_ONLY'}},fetch:(url,options)=>new Promise((resolve,reject)=>{
  const job={url:String(url),options,resolve,reject};pending.push(job);
  if(options.signal.aborted)reject(Object.assign(new Error('aborted'),{name:'AbortError'}));
  options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
})};
const mod={exports:{}};context.module=mod;context.exports=mod.exports;context.require=id=>{
 if(id==='@/lib/maps')return {normalizeAddressText:v=>v.trim()};
 if(id==='@/lib/operational-address')return {canonicalizeOperationalAddress:v=>({address:v})};
 throw Error('unexpected import '+id)
};
vm.runInNewContext(js,context,{filename:path});
const {fetchAddressSuggestions:find,cancelAddressAutocompleteSession:cancel}=mod.exports;
const feature=(city,lat=-18.58,lon=-46.52)=>({type:'Feature',properties:{formatted:'Rua Teste',street:'Rua Teste',country_code:'br',city,lat,lon}});
const response=features=>({ok:true,status:200,json:async()=>({features})});
(async()=>{
  assert.deepEqual(Array.from(await find('ab')),[],'short query');
  assert.equal(pending.length,0,'no network for short query');
  const first=find('rua aaa');assert.equal(pending.length,1);
  const second=find('rua bbb');assert.equal(pending.length,2);
  pending[1].resolve(response([feature('Patos de Minas'),feature('Uberlândia'),feature('Patos de Minas',-17,-46)]));
  const good=await second;assert.equal(good.length,1,'city and bounding rectangle');
  assert.deepEqual(Array.from(await first),[],'superseded request discarded');
  const cached=await find('rua bbb');assert.equal(cached.length,1);assert.equal(pending.length,2,'cache hit');
  const third=find('rua ccc');assert.equal(pending.length,3);cancel();
  assert.deepEqual(Array.from(await third),[],'explicit cancellation');
  const fourth=find('rua ddd');pending[3].resolve(response([feature('Patos de Minas')]));assert.equal((await fourth).length,1);
  console.log('R126 E5: 8 behavioural assertions OK');
})().catch(e=>{console.error(e);process.exitCode=1});
