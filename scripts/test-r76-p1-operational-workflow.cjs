#!/usr/bin/env node
/** R76 P1: determinístico, sem rede, Firebase, WhatsApp nem alteração de dados. */
'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict'), vm=require('node:vm'), ts=require('typescript');
let checks=0; const ok=(value,label)=>{assert.ok(value,'R76 P1 '+label);checks++};
const read=path=>fs.readFileSync(path,'utf8');
const targets=[
 'types/index.ts','lib/customer-contact-book.ts','components/customers/CustomerDestinationSheet.tsx',
 'app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','app/entregas/details/page.tsx',
 'app/confirmar/page.tsx','app/confirmacoes/page.tsx','app/motoboys/page.tsx','app/motoboys/details/page.tsx',
 'lib/tracking/gate1/storage.ts','lib/tracking/gate1/core.ts'
];
for(const p of targets){ const src=read(p); const kind=p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
 ok(ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true,kind).parseDiagnostics.length===0,'sintaxe '+p);
}
const source=read('lib/customer-contact-book.ts');
const compiled=ts.transpileModule(source,{fileName:'customer-contact-book.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={}; const mod={exports:exp};
vm.runInNewContext(compiled,{module:mod,exports:exp,require:name=>name==='@/lib/phone'?{normalizeBrazilPhone:v=>String(v||'').replace(/\D/g,'')}: (()=>{throw Error('import nao previsto '+name)})()}, {timeout:2500});
const {customerAddresses,customerContactPayload}=mod.exports;
const two=customerAddresses({address:'',neighborhood:'',maps_link:'',addresses:[
 {id:'duplicado',address:'Rua Um, 10 - Bairro A',primary:true,label:'Principal'},
 {id:'duplicado',address:'Rua Dois, 20 - Bairro B',primary:false,label:'Principal'},
]});
ok(two.length===2,'enderecos fisicos nao eliminados');
ok(two[0].id!==two[1].id,'IDs visuais diferentes mesmo quando legados repetidos');
ok(two.filter(x=>x.primary).length===1,'apenas um primario');
ok(two[1].address.includes('Rua Dois'),'segunda rua continua elegivel');
const persisted=customerContactPayload([],two);
ok(persisted.addresses.length===2,'destinos continuam distintos ao salvar explicitamente');
ok(persisted.addresses.filter(x=>x.primary).length===1,'primary unico ao persistir');
const sheet=read('components/customers/CustomerDestinationSheet.tsx');
ok(sheet.includes('aria-pressed={addressId===item.id}') && sheet.includes('setAddressId(item.id)'),'usuario escolhe endereco');
ok(sheet.includes("item.label?.trim().toLowerCase() === 'principal' ? 'Outro endereço'"),'segunda opcao sem rotulo Principal falso');
const nova=read('app/entregas/nova/page.tsx'),edit=read('app/entregas/editar/page.tsx');
for(const [name,form] of [['nova',nova],['editar',edit]]){
 ok(form.includes("aria-pressed={fulfillmentMode==='pickup'}") && form.includes('Parceira entrega') && form.includes('DFL entrega'),'retirada marketplace disponivel '+name);
 ok(form.includes('grid-cols-3 gap-2'),'3 opcoes marketplace '+name);
 ok(form.includes("fulfillmentMode === 'delivery'") || form.includes("fulfillmentMode==='delivery'"),'somente entrega pede rota '+name);
}
ok(nova.includes("fulfillmentMode==='pickup'?{logistics_provider:'customer' as const}:{}"),'pickup novo usuario retira');
ok(nova.includes("const customerAddress=fulfillmentMode==='pickup'?'':fulfillmentMode==='delivery'?cleanStreet:streetAddress.trim();"),'nova retirada nao grava rua antiga e mantem entrega parceira');
ok(edit.includes("const customerAddress = fulfillmentMode === 'pickup' ? '' : fulfillmentMode === 'delivery' ? canonicalizeOperationalAddress(cleanStreet,selectedAddressNeighborhood).address : streetAddress.trim();"),'editar retirada nao grava rua antiga e mantem entrega parceira');
ok(edit.includes("maps_link: fulfillmentMode === 'pickup' ? '' : (mapsLink.trim() || resolvedMapsLink)"),'editar sem localizacao fantasma na retirada');
const confirm=read('app/confirmar/page.tsx'),queue=read('app/confirmacoes/page.tsx'),detail=read('app/entregas/details/page.tsx');
ok(confirm.includes("searchParams.get('deliveryId')")&&confirm.includes('completeLinkedIfoodDelivery(deliveryId)'),'pedido operacional vinculado ao portal');
ok(confirm.includes('completeLinkedIfoodDelivery(currentPending.delivery_id)'),'pendencia vinculada a baixa');
ok(confirm.includes("await updateDelivery(id,{completed:true});"),'baixa pelo mesmo store transacional');
ok(confirm.includes("if (current.completed) return;"),'conclusao idempotente');
ok(confirm.includes('key={`${pendingId || deliveryId || \'portal\'}-${orderId}-${code}`}'),'portal remonta no proximo da sequencia');
ok(queue.includes('deliveryId=${encodeURIComponent(delivery.id)}'),'fila operacional transfere identidade');
ok(detail.includes('deliveryId=${encodeURIComponent(delivery.id)}'),'detalhes transfere identidade');
ok(queue.includes("await updateDelivery(delivery.id,{completed:true});"),'fila de confirmacao baixa entrega vinculada');
const storage=read('lib/tracking/gate1/storage.ts'),core=read('lib/tracking/gate1/core.ts'),types=read('types/index.ts');
for(const field of ['preparation_started_at','preparation_ready_at']){
 ok(types.includes(field)&&storage.includes(field)&&detail.includes(field),'evidencia do preparo '+field);
}
ok(storage.includes("localEvent('preparing',prep") && storage.includes("localEvent('ready',ready"),'etapas de preparo somente por timestamp');
ok(core.includes("if (readyAt) return 'ready'") && core.includes("if (iso(d.preparation_started_at)) return 'preparing'"),'status confirmado projetado');
ok(detail.includes("markKitchenStage('preparing')")&&detail.includes("markKitchenStage('ready')"),'acoes de cozinha visiveis');
ok(detail.includes('marketplacePickup')&&detail.includes('canMarkManualPickupReady(delivery) || marketplacePickup'),'pickup marketplace nao trava pronto');
ok(detail.includes('A plataforma continua responsável por seus próprios avisos'),'nao dispara WhatsApp marketplace sem contrato');
ok(read('app/motoboys/page.tsx').includes('<Bike size={19} />')&&read('app/motoboys/details/page.tsx').includes('<Bike size={23} />'),'icone Bike padronizado');
ok(!confirm.includes('new Function('),'sem executar dados externos');
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r76-p1-operational-workflow.cjs'"),'PRE-APK insere contrato R76');
console.log(`R76 P1 CONTRATOS OK | ${checks} garantias; sem rede/Firestore/WhatsApp`);
