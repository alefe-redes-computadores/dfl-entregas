#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const normalizeName = (value) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
const source = fs.readFileSync('lib/motoboy-overview.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
const moduleValue = {exports:{}};
vm.runInNewContext(compiled.outputText, {module: moduleValue,exports: moduleValue.exports,require(name){
  assert.equal(name, '@/lib/motoboy-analytics');
  return {normalizeName};
}});
const build = moduleValue.exports.buildMotoboyOverview;
let checks = 0;
const check = (condition, explanation) => {assert.ok(condition, explanation);checks++};
const belongs = (route,motoboy) => route.motoboy_id ? route.motoboy_id===motoboy.id : normalizeName(route.motoboy_name)===normalizeName(motoboy.name);
const old = (motoboys,routes,deliveries) => motoboys.map(motoboy => {
  const linkedRoutes=routes.filter(route=>belongs(route,motoboy));
  const ids=new Set(linkedRoutes.map(route=>route.id));
  const linked=deliveries.filter(item=>ids.has(item.route_id));
  return {motoboy,routeCount:linkedRoutes.length,deliveryCount:linked.length,completed:linked.filter(item=>item.completed).length};
});
function compare(motoboys,routes,deliveries,caseName){
  const got=build(motoboys,routes,deliveries);const expected=old(motoboys,routes,deliveries);
  check(got.length===expected.length,caseName+': length');
  for(let index=0;index<expected.length;index++){
    const a=got[index],b=expected[index];
    check(a.motoboy===b.motoboy,caseName+': same motoboy reference '+index);
    for(const field of ['routeCount','deliveryCount','completed']) check(a[field]===b[field],caseName+': '+field+' row '+index+' got '+a[field]+' expected '+b[field]);
  }
}
compare([],[],[],'empty');
compare([{id:'a',name:'José',active:true},{id:'b',name:'Jose',active:false},{id:'a',name:'Ana',active:true}],
  [{id:'r1',motoboy_id:'a',motoboy_name:'Jose'},{id:'r2',motoboy_name:'José'},{id:'r2',motoboy_name:'Jose'},{id:'r3',motoboy_id:'b',motoboy_name:'Ana'},{id:'r4',motoboy_id:'absent',motoboy_name:'Jose'}],
  [{route_id:'r1',completed:true},{route_id:'r1',completed:false},{route_id:'r2',completed:true},{route_id:'r3',completed:true},{route_id:'r4',completed:true}], 'duplicate names/routes/ids');
let seed=0x123addef;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const pick=(items)=>items[Math.floor(rnd()*items.length)];
const names=['João','Joao','Álvaro','Alvaro','Carlos','carlos','MARIA','Maria','', 'José'];
for(let round=0;round<140;round++){
  const motoboys=Array.from({length:1+Math.floor(rnd()*16)},(_,i)=>({id:round%3===0?String(i%5):'m'+i,name:pick(names),active:rnd()<.5}));
  const routes=Array.from({length:Math.floor(rnd()*170)},(_,i)=>({id:rnd()<.08?'shared':'r'+i,motoboy_id:rnd()<.7?undefined:(rnd()<.3?'unknown':pick(motoboys).id),motoboy_name:pick(names)}));
  const deliveries=Array.from({length:Math.floor(rnd()*340)},()=>({route_id:rnd()<.1?'unassigned':routes.length?pick(routes).id:'none',completed:rnd()<.6}));
  compare(motoboys,routes,deliveries,'seed '+round);
}
const many=Array.from({length:80},(_,i)=>({id:'m'+i,name:'Entregador '+i,active:true}));
const manyRoutes=Array.from({length:9000},(_,i)=>({id:'r'+i,motoboy_id:'m'+(i%80),motoboy_name:'name '+i}));
const manyDeliveries=Array.from({length:24000},(_,i)=>({route_id:'r'+(i%9000),completed:i%4===0}));
compare(many,manyRoutes,manyDeliveries,'large 9k routes/24k deliveries');
console.log(`R51 MOTOB O(N) EQUIVALENCE: ${checks} checks OK`);
