const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const raw = fs.readFileSync('lib/operation/temporary-customer-identity.ts','utf8');
const js = ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',js)(mod,mod.exports);
const validate = mod.exports.assertTemporaryCustomerBinding;
const valid={origin:'loja',selectedId:'cli-1',preferredId:'cli-1',persistedId:'cli-1',namesMatch:true,currentPhone:'34999999999',allowedPhones:['34999999999']};
assert.doesNotThrow(()=>validate(valid));
for(const change of [
 {origin:'ifood'}, {origin:'food99'}, {selectedId:'cli-2'}, {preferredId:'cli-2'},
 {persistedId:undefined}, {namesMatch:false}, {currentPhone:'34988888888'},
]) assert.throws(()=>validate({...valid,...change}));
assert.doesNotThrow(()=>validate({...valid,currentPhone:'',allowedPhones:[]}));
console.log('OK: 9 cenários de vínculo temporário, sem fallback para criação de cliente');
const store=fs.readFileSync('store/useAppStore.ts','utf8');
const nova=fs.readFileSync('app/entregas/nova/page.tsx','utf8');
const edit=fs.readFileSync('app/entregas/editar/page.tsx','utf8');
const sheet=fs.readFileSync('components/customers/CustomerDestinationSheet.tsx','utf8');
assert.match(store,/if \(details\?\.temporaryCustomerId\)/);
assert.match(store,/return chosen!\.id/);
assert.match(nova,/temporaryCustomerId:index===0/);
assert.match(edit,/temporaryCustomerId: temporaryCustomerId \|\| undefined/);
assert.match(sheet,/Usar só nesta entrega/);
assert.match(sheet,/onUseTemporary\?\.\(/);
assert.match(nova,/setActiveMapsLink\(''\)/);
assert.match(edit,/setMapsLink\(''\)/);
console.log('OK: operação mantém vínculo, não herda Maps, cobre nova/edição');
