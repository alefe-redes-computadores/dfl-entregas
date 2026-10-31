'use strict';
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const ts = require('typescript');
const read = path => fs.readFileSync(path, 'utf8');
const ok = (value, message) => { assert(value, message); console.log('OK: '+message); };
const delivery = read('app/entregas/nova/page.tsx');
const store = read('store/useAppStore.ts');
const latency = read('lib/operation/action-latency.ts');
const helper = read('lib/operation/delivery-create-fastlane.ts');
const pre = read('scripts/pre-apk.cjs');
function moduleFromTs(code, file) {
  const transpiled = ts.transpileModule(code,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
  ok(!transpiled.diagnostics.some(d => d.category===ts.DiagnosticCategory.Error),file+' sintaxe');
  const module={exports:{}};
  vm.runInNewContext(transpiled.outputText,{module,exports:module.exports,encodeURIComponent,String,RegExp}, {filename:file});
  return module.exports;
}
const fastlane=moduleFromTs(helper,'delivery-create-fastlane.ts');
const cases=[
  {address:'Rua Major Gote, 10',link:'',expect:'Rua%20Major%20Gote'},
  {address:'Avenida Brasil 77, Patos de Minas',link:'',expect:'Patos%20de%20Minas'},
];
for(const c of cases) {
  const value=fastlane.deliverySearchMapLink(c.address,c.link);
  ok(value.startsWith('https://www.google.com/maps/search/?api=1&query=')&&value.includes(c.expect),'mapa pesquisável sem rede');
}
ok(fastlane.deliverySearchMapLink('Rua 1','https://maps.google.com/?q=1,2')==='https://maps.google.com/?q=1,2','link revisado prevalece');
ok(fastlane.deliverySearchMapLink('', '')==='', 'endereço vazio não cria link enganoso');
ok(!delivery.includes("import { geocodeAddress } from '@/lib/store-geocoding';")&&!delivery.includes('await geocodeAddress(cleanStreet)'), 'cadastro não espera Geoapify/Google');
ok(delivery.includes('deliverySearchMapLink(cleanStreet, mapsLink)'),'endereço tem link de navegação local');
ok(delivery.includes('firstRequiredDeliveryIssue')&&delivery.includes('firstMultiOrderIssue')&&delivery.includes('submitFlight.current'), 'validações e bloqueio de duplo toque intactos');
ok(store.includes('if (!Object.keys(updatedFields).length) return customer.id;'), 'cliente inalterado não sofre gravação de rede');
ok(store.includes('assertTemporaryCustomerBinding')&&store.includes('customerIdentityEvidence')&&store.includes('findExistingCustomer'), 'identidade e evidência conservadoras');
ok(store.includes("recordActionLatency('customer_upsert'")&&store.includes("recordActionLatency('delivery_write'")&&store.includes("recordActionLatency('purchase_update'"),'cliente, entrega e compra medidos');
ok(store.includes("recordActionLatency('route_create'")&&store.includes("recordActionLatency('stock_integrate'")&&store.includes("recordActionLatency('route_auto_order'"),'rota, organização e integração medidos');
ok(store.includes('await autoOrganizeLoadedRouteAfterInsert')&&store.includes('await queueDeliveryDocuments')&&store.includes('runTransaction(db, async (transaction)'), 'autoridade, serialização e reorganização preservadas');
ok(store.includes("await trackStockSupplyWrite(id, operation)")&&store.includes('await waitForStockSupplyWrite(id)'),'integridade de compras preservada');
for(const category of ['delivery_form','delivery_write','customer_upsert','route_create','route_auto_order','purchase_update','stock_integrate']){
  ok(latency.includes(category+": '")&&latency.includes("'"+category+"'"),'diagnóstico registra '+category);
}
ok(pre.includes('scripts/test-r227-operational-fastlane.cjs'),'nova regressão no pré-APK');
for(const p of ['app/entregas/nova/page.tsx','store/useAppStore.ts','lib/operation/action-latency.ts']){
  const result=ts.transpileModule(read(p),{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
  ok(!result.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error),'parser TS/JSX '+p);
}
console.log('R227: FLUXOS OPERACIONAIS + REGRESSÃO ESTRUTURAL OK');
