const fs=require('node:fs');const assert=require('node:assert/strict');
const get=p=>fs.readFileSync(p,'utf8');
const files=['types/index.ts','lib/customer-contact-book.ts','lib/internal-owner-identity.ts','components/customers/CustomerForm.tsx','components/customers/CustomerDestinationSheet.tsx','lib/customer-analytics.ts','lib/operational-exclusions.ts','components/deliveries/CustomerAutocomplete.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','app/clientes/page.tsx','app/clientes/details/page.tsx','lib/reports/buildReportModel.ts','app/relatorios/page.tsx'];for(const f of files)assert(fs.existsSync(f),`R76: ausente ${f}`);
const t=get('types/index.ts'), book=get('lib/customer-contact-book.ts'), form=get('components/customers/CustomerForm.tsx'), identity=get('lib/internal-owner-identity.ts'),index=get('lib/customer-analytics.ts'),search=get('components/deliveries/CustomerAutocomplete.tsx'),newOrder=get('app/entregas/nova/page.tsx'),editOrder=get('app/entregas/editar/page.tsx'),report=get('lib/reports/buildReportModel.ts');
const ok=(v,msg)=>{assert(v,`R76: ${msg}`);console.log('✓',msg)};
ok(t.includes('phones?: CustomerPhone[]')&&t.includes('addresses?: CustomerAddress[]'),'customer 1:N preserva legado');
ok(book.includes('customerContactPayload')&&book.includes('phone:phonePrimary?.number')&&book.includes('address:addressPrimary?.address'),'principal espelha campos legados');
ok(book.includes('uniquePhones')&&book.includes('uniqueAddresses'),'contatos repetidos sao deduplicados');
ok(form.includes('Definir principal')&&form.includes('Tornar principal')&&form.includes('Excluir endereço'),'formulario possui controles reais');
ok(identity.includes('ownerNameAndPhone')&&identity.includes('OWNER_LEGACY_STREET')&&identity.includes('OWNER_LEGACY_NEIGHBORHOOD'),'legado requer tres evidencias');
ok(identity.includes('internal_owner_verified===true')&&!identity.includes("name === 'alefe' ||"),'flag explicita vence inferencia fraca');
ok(index.includes('candidateIds.length !== 1')&&index.includes('delivery.customer_id'),'fallback antigo so aceita identidade unica');
ok(search.includes('customerPhoneMatches')&&search.includes('customerAddresses(customer)'),'autocompletar busca telefones e destinos');
ok(newOrder.includes('CustomerDestinationSheet')&&editOrder.includes('CustomerDestinationSheet'),'nova e edicao oferecem escolha do endereco');
ok(report.includes('isInternalOperationalRoute(route, input.motoboys || [])')&&report.includes('normalizeOrigin'),'relatorio exclui rota interna por flag e mantem 99Food');
ok(report.includes('item.purchaser_id === ownerUid')&&get('app/estoque/compras/page.tsx').includes('purchaser_id: user?.uid'), 'ranking de compras exclui UID proprio sem apagar gastos');
ok(get('app/clientes/page.tsx').includes('Mostrar internos')&&get('app/clientes/details/page.tsx').includes('DEV · Interno'),'busca mostra selos e filtro DEV');
ok(get('scripts/pre-apk.cjs').includes('scripts/test-v112-r76-client-identity.cjs'),'testes R76 presentes no preapk');
console.log('V112 R76: verificacoes estruturais OK');
// Testes comportamentais, executando os helpers reais sem rede ou Firebase.
const ts=require('typescript'),vm=require('node:vm');
const load=(file,stubs={})=>{
  const code=ts.transpileModule(get(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{}, {filename:file})((dep)=>{
    if(!(dep in stubs))throw new Error(`R76 stub ausente: ${dep}`);return stubs[dep];
  },mod,mod.exports);
  return mod.exports;
};
const phone=load('lib/phone.ts');
const bookReal=load('lib/customer-contact-book.ts',{'@/lib/phone':phone});
const ownerReal=load('lib/internal-owner-identity.ts',{'@/lib/phone':phone});
const old={id:'c1',name:'Maria',phone:'34999998888',address:'Rua A, 10 - Centro',neighborhood:'Centro'};
ok(bookReal.customerPhones(old).length===1&&bookReal.customerAddresses(old).length===1,'legado fornece contatos virtuais sem write');
const grouped=bookReal.customerContactPayload([
  {id:'p1',number:'34999998888',primary:false},
  {id:'p2',number:'34988887777',primary:true},
  {id:'p3',number:'34999998888'},
],[
  {id:'a1',address:'Rua A, 10 - Centro',primary:false},
  {id:'a2',address:'Rua B, 20 - Centro',primary:true},
]);
ok(grouped.phone==='34988887777'&&grouped.address==='Rua B, 20 - Centro'&&grouped.phones.length===2,'principal atualizado e telefone duplicado bloqueado');
ok(bookReal.customerPhoneMatches({...old,phones:grouped.phones},'8888')&&bookReal.customerSearchBlob({...old,addresses:grouped.addresses}).includes('rua b'),'busca encontra segundo numero e segundo endereco');
ok(!ownerReal.verifiedInternalCustomer({id:'homonimo',name:'Álefe',phone:'34911112222',address:'Rua qualquer, 5'}),'homonimo nao e classificado como DEV');
ok(ownerReal.verifiedInternalCustomer({id:'marcado',name:'Cadastro Interno',internal_owner_verified:true}),'flag intencional de owner e reconhecida');
const customerLib=load('lib/customer-analytics.ts',{
  '@/lib/delivery-finance':{deliveryCustomerCharge:(item)=>Number(item.customer_charge??item.value??0)},
  '@/lib/operational-time':{deliveryDate:(item)=>item.created_at||item.createdAt||undefined},
  '@/lib/internal-owner-identity':ownerReal,
  '@/lib/customer-contact-book':bookReal,
});
const twins=[{...old,id:'maria1'},{...old,id:'maria2',phone:'34977776666'}];
const orders=[{id:'o1',customer_id:'maria1',value:20,completed:true},{id:'o2',customer_name:'Maria',value:30,completed:true},{id:'o3',customer_id:'maria2',value:40,completed:true}];
const byCustomer=customerLib.buildCustomerStatsIndex(twins,orders);
ok(byCustomer.get('maria1').orderCount===1&&byCustomer.get('maria2').orderCount===1,'homonimos nao herdam pedido sem customer_id');
console.log('✓ R76: comportamento real (contatos, legado, homonimos, DEV) aprovado');
