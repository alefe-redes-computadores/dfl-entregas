#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const loadTs=(file,aliases={})=>{
 const source=fs.readFileSync(file,'utf8');
 const result=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const m=new Module(file,module);m.filename=__filename;m.paths=module.paths;
 const original=m.require.bind(m);m.require=name=>aliases[name]||original(name);
 m._compile(result.outputText,__filename);return m.exports;
};
const codeHelper=loadTs('lib/operation/ifoodOrderCode.ts');
const confirmation=loadTs('lib/ifood-confirmations.ts',{'@/lib/operation/ifoodOrderCode':codeHelper});
const make=(c,id='12345678')=>({origin:'ifood',ifood_id:id,confirmation_code:c});
let checks=0;
for(let n=0;n<900;n++){
 const historic=String(n%10000).padStart(4,'0');
 const info=confirmation.getIfoodConfirmationInfo(make(''),{last_confirmation_code:historic});
 assert.equal(info.state,'missing_code');
 assert.equal(info.ready,false);
 assert.equal(info.code,'');
 assert.equal(info.codeSource,'none');
 checks+=4;
}
for(let n=0;n<1500;n++){
 const code=String(n%10000).padStart(4,'0');
 const info=confirmation.getIfoodConfirmationInfo(make(code),{last_confirmation_code:'9999'});
 assert.equal(info.state,'ready');assert.equal(info.code,code);assert.equal(info.codeSource,'delivery');checks+=3;
}
for(const invalid of ['','0','123','12345','1 2 3 4 5','12345678', 'AAAA','12A']){
 const result=confirmation.getIfoodConfirmationInfo(make(invalid),{last_confirmation_code:'4321'});
 assert.equal(result.ready,false,`invalid ${invalid}`);checks++;
}
for(const valid of ['1234','12 34','12-34','12.34']) {
 const result=confirmation.getIfoodConfirmationInfo(make(valid));
 assert.equal(result.code,'1234');assert.equal(result.ready,true);checks+=2;
}
assert.equal(confirmation.getIfoodConfirmationInfo(make('1234','')).state,'missing_id');checks++;
// Verifica que o HTML da ficha não recorre ao cache do cliente para qualquer pedido.
const details=fs.readFileSync('app/entregas/details/page.tsx','utf8');
const departure=fs.readFileSync('components/routes/RouteDepartureChecklist.tsx','utf8');
const accordion=fs.readFileSync('components/home/RouteAccordion.tsx','utf8');
for (const source of [details,departure,accordion]){
 assert(source.includes('orderConfirmationCode(delivery.confirmation_code)'));checks++;
}
console.log(`R57 CODE PROVENANCE: ${checks} behavior assertions, no customer fallback`);
