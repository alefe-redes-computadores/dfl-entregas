'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const helper='lib/operation/ifood-self-confirm-route.ts',component='components/home/OperationalCommandCenter.tsx';
const source=fs.readFileSync(helper,'utf8');
const js=ts.transpileModule(source,{fileName:helper,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};vm.runInNewContext(js,{exports:mod.exports,module:mod,Set,Array,Object,String},{filename:helper});
const index=mod.exports.ifoodSelfConfirmRouteIds;
let checks=0;const ok=(v,name)=>{assert.ok(v,name);checks++};
const motoboys=[{id:'m1',ifood_confirmation_mode:'motoboy'},{id:'m2',ifood_confirmation_mode:'store'},{id:'m3'},{id:'m4',ifood_confirmation_mode:'motoboy'}];
const routes=[{id:'r1',motoboy_id:'m1'},{id:'r2',motoboy_id:'m2'},{id:'r3',motoboy_id:'m3'},{id:'r4',motoboy_id:'m4'},{id:'r5',motoboy_id:'deleted'}, {id:'r6'}];
const actual=index(routes,motoboys);ok(actual.size===2&&actual.has('r1')&&actual.has('r4'),'motoboys confirmam apenas suas rotas');
const old=(r,m)=>new Set(r.filter(route=>m.some(motoboy=>motoboy.id===route.motoboy_id&&motoboy.ifood_confirmation_mode==='motoboy')).map(route=>route.id));
for(let n=0;n<500;n++){
  const rs=Array.from({length:n%17},(_,i)=>({id:'r'+i,motoboy_id:'m'+((i+n)%9)}));
  const ms=Array.from({length:n%13},(_,i)=>({id:'m'+i,ifood_confirmation_mode:(i+n)%3===0?'motoboy':'store'}));
  const expected=old(rs,ms),observed=index(rs,ms);
  ok(expected.size===observed.size&&[...expected].every(x=>observed.has(x)),'equivalencia semantica '+n);
}
const ui=fs.readFileSync(component,'utf8');
for(const token of ["useMemo(() => ifoodSelfConfirmRouteIds(routes, motoboys), [routes, motoboys])",'!selfConfirmRouteIds.has(',"routeIfoodCodeProgress(deliveries.filter(item =>",'!selfConfirmRouteIds.has(item.route_id)','const routeCodes = useMemo(']) ok(ui.includes(token),'componente conserva '+token);
ok(!ui.includes('selfConfirmPendingRoutes'),'indice redundante removido');
ok(!ui.includes('motoboys.some(motoboy => motoboy.id === route.motoboy_id'),'scan repetido removido');
ok(!/(onSnapshot|addDoc|runTransaction|collection\()/.test(source),'helper sem banco remoto');
for(const path of [helper,component]){
 const src=fs.readFileSync(path,'utf8');const parsed=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,'TS parse '+path);
}
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');ok(pre.includes("'scripts/test-r126-e12-ifood-index.cjs'"),'suite no preapk');
console.log('R126 E12 INDICE IFOOD:',checks,'verificacoes aprovadas');
