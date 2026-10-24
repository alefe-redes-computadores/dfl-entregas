#!/usr/bin/env node
'use strict';
// R84 - tests comportamentais reais do motor de identidade, SEM acesso ao Firestore.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const read = p => fs.readFileSync(p, 'utf8');
let tests = 0;
const ok = (condition, name) => { assert.ok(condition, `R84: ${name}`); ++tests; console.log('OK:',name); };
const paths = [
 'lib/customer-identity.ts', 'lib/ifood-order-parser.ts', 'store/useAppStore.ts',
 'components/deliveries/CustomerAutocomplete.tsx', 'app/entregas/nova/page.tsx',
 'app/entregas/editar/page.tsx', 'scripts/pre-apk.cjs',
 'scripts/verify-v85-final-integrity.cjs'
];
for(const file of paths) {
 const ast = ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length === 0, 'sintaxe '+file);
}
function load(path, deps={}) {
 const code = ts.transpileModule(read(path),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 const context={ module:mod,exports:mod.exports,console,Date,Number,Math,Intl,Set,Map,String,Boolean };
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,context,{filename:path})(key=>{
   if(!(key in deps)) throw Error(`Dependencia inesperada ${key} em ${path}`);
   return deps[key];
 },mod,mod.exports);
 return mod.exports;
}
const book = {
 customerAddresses:c=>Array.isArray(c.addresses)&&c.addresses.length ? c.addresses : c.address?[{address:c.address}]:[],
 customerPhones:c=>Array.isArray(c.phones)&&c.phones.length?c.phones:c.phone?[{number:c.phone}]:[]
};
const identity = load('lib/customer-identity.ts',{'@/lib/customer-contact-book':book});
const saved = {id:'maria1',name:'Maria Souza',address:'Rua das Flores, 120 - Centro',phone:'34988887777'};
const address = 'Rua das Flores, 120 - Centro';
ok(identity.sameCustomerIdentityAddress(address,'R. das Flores, 120 - Centro'),'abreviacao R. e Rua sao equivalentes');
ok(identity.sameCustomerIdentityAddress('Rua Flor de Lis, 20 - Centro','Rua Flor de Lis Nº 20 - Centro'),'numero escrito e abreviado');
ok(!identity.sameCustomerIdentityAddress(address,'Rua das Flores, 121 - Centro'),'numero diferente nunca coincide');
ok(!identity.sameCustomerIdentityAddress(address,'Rua das Flores, 120 - Alto da Serra'),'bairro diferente nunca coincide');
ok(!identity.sameCustomerIdentityAddress(address,'Rua das Flores, 120 - Centro, Casa 2'),'complemento diferente nunca coincide');
ok(!identity.sameCustomerIdentityAddress(address,'Rua Flor, 120 - Centro'),'nome de rua parcial nunca coincide');
ok(!identity.sameCustomerIdentityAddress(address,'Centro'),'bairro isolado nao prova endereco');
ok(!identity.sameCustomerIdentityAddress('Rua das Flores','Rua das Flores'),'sem numero nao prova endereco');
ok(identity.customerIdentityEvidence(saved,'Maria Souza',{address}).reusable,'nome completo e endereco completo reutilizam cadastro');
ok(identity.customerIdentityEvidence(saved,'Maria Souza',{address:'R. das Flores, 120 - Centro'}).reusable,'abreviacao da rua permite reutilizacao segura');
ok(!identity.customerIdentityEvidence(saved,'Maria',{address}).reusable,'primeiro nome nao reutiliza');
ok(!identity.customerIdentityEvidence(saved,'Maria S.',{address}).reusable,'sobrenome parcial nao reutiliza');
ok(!identity.customerIdentityEvidence(saved,'Maria Souza',{address:'Rua Outro Lugar, 120 - Centro',phone:saved.phone}).reusable,'telefone igual nao ganha de rua diferente');
ok(!identity.customerIdentityEvidence(saved,'Maria Souza',{phone:saved.phone}).reusable,'telefone sozinho nao reutiliza');
ok(!identity.customerIdentityEvidence(saved,'Maria Souza',{address:'Rua das Flores, 120 - Outro Bairro'}).reusable,'bairro divergente bloqueia');
ok(!identity.customerIdentityEvidence(saved,'Maria Souza',{address:'Rua das Flores, 120 - Centro',phone:'34911112222'}).reusable,'telefone confirmado conflitante bloqueia');
const multiple={...saved,id:'maria-2',address:'Rua B, 100 - Centro',addresses:[{id:'a',address:'Rua B, 100 - Centro'}, {id:'b',address}]};
ok(identity.customerIdentityEvidence(multiple,'Maria Souza',{address}).reusable,'endereco secundario completo e legitimo');
ok(identity.findExistingCustomer([saved],'Maria Souza',{address})?.id==='maria1','retorna cadastro unico exato');
ok(identity.findExistingCustomer([saved],'Maria Souza',{address:'Rua das Flores, 120 - Alto da Serra'})===undefined,'nao reusa homonimo em outro bairro');
ok(identity.findExistingCustomer([saved,multiple],'Maria Souza',{address})===undefined,'empate de identidades completas exige intervencao');
const parser=load('lib/ifood-order-parser.ts',{'@/lib/operational-address':{canonicalizeOperationalAddress:(input)=>({address:String(input||''),observations:[]})}});
const parsed=parser.parseIfoodOrderText('1234 12345678\nAna Maria\nRua das Palmeiras, 30 - Centro\nR$ 27,90', {knownCustomerNames:['Ana','Ana Marina','Ana Maria Santos']});
ok(parsed.customerName==='Ana Maria','parser nao troca nome literal pelo cadastro parcial');
const parsed2=parser.parseIfoodOrderText('1234 12345678\nCliente: Joao\nRua da Paz, 21 - Centro',{knownCustomerNames:['João Silva']});
ok(parsed2.customerName==='Joao','parser preserva nome explicitamente informado');
const store=read('store/useAppStore.ts');
ok(store.includes('const flightKey = normalizedAddress')&&!store.includes('? `phone:${normalizedPhone}`'),'fila nao usa telefone isolado');
ok(store.includes('customerCreationFlights.get(flightKey)')&&store.includes('customerCreationFlights.delete(flightKey)'),'serializacao e liberacao da fila preservadas');
ok(store.includes('customerIdentityEvidence(')&&store.includes('findExistingCustomer('),'store revalida identidade antes da escrita');
const auto=read('components/deliveries/CustomerAutocomplete.tsx');
ok(auto.includes('const candidates = strictMatch')&&auto.includes('sameCustomerIdentityAddress(entry.address, addressContext)'),'lista iFood usa somente candidatos com endereco completo');
ok(auto.includes('useDeferredValue(value)')&&auto.includes('.slice(0, 6)'),'autocomplete continua leve e progressivo');
for(const page of ['app/entregas/nova/page.tsx','app/entregas/editar/page.tsx']){
 const source=read(page);
 ok(source.includes('strictMatch={origin === \'ifood\'}')&&source.includes('addressContext='),'UI iFood exige endereco informado '+page);
 ok(source.includes('toast.warning(\'Cliente diferente do pedido iFood')&&source.includes('sameCustomerIdentityAddress('),'seleção invalida bloqueada '+page);
}
const newPage=read('app/entregas/nova/page.tsx');
ok(newPage.includes('preferredCustomerId:index===0?selectedCustomerId||undefined:undefined'),'multiplos pedidos nao herdam cadastro do primeiro');
ok(newPage.includes('sameCustomerAddress(')&&newPage.includes('stop_group_id'),'parada fisica continua agrupando sem unir pessoas');
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-v112-r84-customer-identity.cjs'"),'novo contrato esta no pre-apk');
for(const p of ['lib/customer-identity.ts','lib/ifood-order-parser.ts','components/deliveries/CustomerAutocomplete.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx']) {
  ok(!/\b(?:getDocs|onSnapshot|runTransaction)\s*\(/.test(read(p)),'nenhuma leitura nova do Firestore em '+p);
}
console.log(`\nV112 R84: ${tests} contratos estruturais e cenarios executaveis aprovados`);
