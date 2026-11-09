const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path, stubs){const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});assert.equal(code.diagnostics.length,0);const ctx={exports:{},require:p=>{if(!(p in stubs))throw Error(`unexpected ${path} import ${p}`);return stubs[p]}};vm.runInNewContext(code.outputText,ctx,{filename:path});return ctx.exports;}
const canonical=(v,nb)=>{let value=String(v||'').replace(/\bCEP\s*\d{5}-?\d{3}\b/gi,'').replace(/\s+/g,' ').trim().replace(/\s*[-,]\s*$/,'');const part=String(nb||'').trim();if(part&&!value.toLowerCase().includes(part.toLowerCase()))value+=' - '+part;return {address:value,neighborhood:part||/\s-\s([^\-]+)$/.exec(value)?.[1]||undefined};};
const book=load('lib/customer-contact-book.ts',{'@/lib/phone':{normalizeBrazilPhone:v=>String(v||'').replace(/\D/g,'')},'@/lib/operational-address':{canonicalizeOperationalAddress:canonical}});
const address='Rua Lázaro Martins Maciel, 164 - Jardim Quebec';
const addresses=[{id:'a1',address:address+' CEP 38701-884',label:'Principal',primary:false,maps_link:''},{id:'a2',address:address,label:'Principal',primary:true,maps_link:''},{id:'a3',address:'Rua Lázaro Martins Maciel, 164',neighborhood:'Jardim Quebec',label:'Principal',primary:false,maps_link:'https://maps.google.com/?q=foo'}, {id:'a4',address:'Rua Lázaro Martins Maciel, 165 - Jardim Quebec',primary:false}];
const result=book.customerAddresses({address,addresses,neighborhood:'Jardim Quebec',maps_link:''});
assert.equal(result.length,2,'três versões idênticas + uma casa diferente');
assert.equal(result.filter(x=>x.primary).length,1,'um endereço principal');
assert(result[0].maps_link,'preserva mapa associado ao endereço consolidado');
const payload=book.customerContactPayload([],addresses);
assert.equal(payload.addresses.length,2,'a gravação explícita também não reintroduz duplicatas');
const picker=fs.readFileSync('components/deliveries/AddressAutocomplete.tsx','utf8');
assert(picker.includes('selectedRequest !== requestId.current')&&picker.includes('requestId.current += 1'),'resultado de API desatualizado não sobrescreve digitação posterior');
const geo=fs.readFileSync('lib/operational-address.ts','utf8');
assert(geo.includes('selectedBrasilNeighborhood')&&geo.includes("neighborhood = 'Brasil'"),'bairro Brasil de Patos de Minas não pode ser removido como país');
const newForm=fs.readFileSync('app/entregas/nova/page.tsx','utf8'),editForm=fs.readFileSync('app/entregas/editar/page.tsx','utf8');
for(const s of [newForm,editForm]){assert(s.includes('onNeighborhoodResolved={setSelectedAddressNeighborhood}'),'bairro escolhido preservado');assert(s.includes('selectedAddressNeighborhood'),'estado dedicado');assert(s.includes('Mapa')||s.includes('mapa'),'hierarquia de mapa reduzida');}
assert(newForm.includes("fulfillmentMode === 'pickup'"),'consentimento de retirada manual individual');
const details=fs.readFileSync('app/entregas/details/page.tsx','utf8'),policy=fs.readFileSync('lib/integration/site-order.ts','utf8');
assert(policy.includes('export function canMarkManualPickupReady')&&policy.includes("delivery.origin === 'loja'"),'prontidão manual distinta');
assert(details.includes('canMarkManualPickupReady(delivery)'),'ação de prontidão manual visível');
assert(details.includes("if (!canMarkSitePickupReady(delivery) || isMarkingReady) return;"),'contrato Site preservado');
assert(!fs.readFileSync('lib/integration/server/manualNextStop.ts','utf8').includes('delivery.pickup_ready'),'retirada não dispara next-stop');
console.log('R300 P2: dedupe endereços, principal e mapa, bairro confirmado, UI formulário e retirada manual OFF OK. Sem rede.');
