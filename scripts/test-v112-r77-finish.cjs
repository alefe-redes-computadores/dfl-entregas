#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let count=0;
const ok=(v,label)=>{assert.ok(v,'R77: '+label);console.log('✓ '+label);count++};
const paths=['lib/customer-contact-book.ts','components/home/OperationalCommandCenter.tsx','app/loja/page.tsx','components/deliveries/CustomerAutocomplete.tsx','components/customers/CustomerDestinationSheet.tsx','app/clientes/details/page.tsx','app/clientes/page.tsx','app/relatorios/page.tsx','components/customers/CustomerForm.tsx'];
for(const file of paths){const sf=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(sf.parseDiagnostics.length===0,'sintaxe '+file);}
const home=read('components/home/OperationalCommandCenter.tsx');
ok(home.includes('deliveryHint(noAddress[0])') && home.includes('deliveryActionHref(noAddress[0])'),'alerta aponta o pedido concreto');
ok(home.includes('deliveryHint(addressOnly[0])') && home.includes('!extractLatLngFromMapsUrl(delivery.maps_link)'), 'aviso de localizacao conserva verificacao geografica');
ok(home.includes('! /\\b\\d{1,5}\\b/'.trim().replace('! ', '!')) || home.includes('!/\\b\\d{1,5}\\b/'), 'localizacao incompleta nao confunde endereco numerado');
const loja=read('app/loja/page.tsx');ok(loja.includes('dfl:loja:gestao')&&loja.includes('sessionStorage.setItem')&&loja.includes('aria-expanded={showManagement}'),'Loja lembra estado de gestao e expõe acessibilidade');
const search=read('components/deliveries/CustomerAutocomplete.tsx');ok(search.includes('useDeferredValue')&&search.includes('deferredQuery === value')&&search.includes('customerPhoneMatches(customer, deferredQuery)'),'busca não bloqueia digitacao nem apresenta resultado defasado');
ok(search.includes('item.number.replace(/\\D/g')&&search.includes('item.address).includes(normalizeCustomerAddress(value))'),'sugestoes mostram contato ou destino encontrado');
const sheet=read('components/customers/CustomerDestinationSheet.tsx');ok(sheet.includes('aria-pressed={phoneId===item.id}')&&sheet.includes('aria-pressed={addressId===item.id}')&&sheet.includes('[customer.id]'),'seletores de destino reiniciam e comunicam estado');
const details=read('app/clientes/details/page.tsx');ok(details.includes('routesById.get(delivery.route_id)')&&details.includes('stats.deliveries.slice(0,historyLimit)')&&details.includes('setHistoryLimit(value=>value+24)'),'historico progressivo e rotas indexadas');
const report=read('app/relatorios/page.tsx');ok(report.includes('99Food entregue pela plataforma entra nas vendas')&&report.includes('Responsável pela entrega'),'relatorios distinguem venda de rota DFL');
const form=read('components/customers/CustomerForm.tsx');ok(form.includes('customerContactPayload')&&form.includes('sm:grid-cols-2')&&form.includes('internal_owner_verified:isInternal'),'formulario responsivo sem destruir modelo de cliente');
// Behavioural regression of the actual pure contact model, not a static pass.
function load(path, deps={}){const mod={exports:{}};const src=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(`(function(require,module,exports){${src}\n})`,{}, {filename:path})(name=>{if(!(name in deps))throw new Error('Import ausente '+name);return deps[name]},mod,mod.exports);return mod.exports;}
const phone=load('lib/phone.ts');const book=load('lib/customer-contact-book.ts',{'@/lib/phone':phone});
const sameStreetDifferentBairros=book.customerContactPayload([],[
{id:'a',address:'Rua das Flores, 22',neighborhood:'Centro',primary:true},
{id:'b',address:'Rua das Flores, 22',neighborhood:'Novo Horizonte',primary:false}
]);
ok(sameStreetDifferentBairros.addresses.length===2&&sameStreetDifferentBairros.address==='Rua das Flores, 22','ruas iguais em bairros diferentes nao se fundem');
const duplicate=book.customerContactPayload([],[{id:'a',address:'Rua Alfa, 11',neighborhood:'Centro',primary:true},{id:'b',address:'RUA ALFA 11',neighborhood:'CENTRO'}]);
ok(duplicate.addresses.length===1,'destino repetido no mesmo bairro e deduplicado');
const existing={name:'Maria',phone:'34999998888',phones:[{id:'a',number:'34999998888',primary:true},{id:'b',number:'34988887777'}],address:'Rua A, 12'};
ok(book.customerPhoneMatches(existing,'(34) 98888-7777') && book.customerPhones(existing).length===2,'telefone secundario aceita busca formatada');
console.log(`R77: ${count} contratos estruturais e casos comportamentais aprovados`);
