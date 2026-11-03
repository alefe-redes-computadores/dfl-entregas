'use strict';
/** DFL ENTREGAS R242: read-only cross-repo consumer fixture and fail-closed live inbound proof. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let count=0;
const ok=(v,m)=>{assert.ok(v,'R242 '+m);count++};
const eq=(a,b,m)=>{assert.deepEqual(a,b,'R242 '+m);count++};
const no=(fn,re,m)=>{assert.throws(fn,re,'R242 '+m);count++};
const read=p=>fs.readFileSync(p,'utf8');
function loadTs(file,allowed={}){
 const src=read(file);
 const ast=ts.createSourceFile(file,src,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS parser '+file);
 const out=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 ok(!(out.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'TS transpile '+file);
 const mod={exports:{}};
 new Function('require','module','exports',out.outputText)(id=>{
   if(!Object.prototype.hasOwnProperty.call(allowed,id)) throw Error('R242 import proibido '+id);
   return allowed[id];
 },mod,mod.exports);
 return mod.exports;
}
const guard=loadTs('lib/integration/site-combo-unit-guard.ts');
const preview=loadTs('lib/integration/site-combo-unit-preview.ts');
eq(guard.SITE_COMBO_UNIT_PRODUCTION_SUPPORTED,false,'production still OFF');
eq(guard.SITE_LEGACY_ORDER_SCHEMA_MAX,2,'legacy order max v2');
eq(preview.SITE_COMBO_UNIT_PREVIEW_ENABLED,false,'preview feature OFF');
eq(preview.SITE_COMBO_UNIT_PREVIEW_CONTRACT,'dfl_site_combo_units_preview_v1','matches R241 producer');
eq(preview.SITE_COMBO_UNIT_PREVIEW_CAPABILITY,'dfl_site_combo_unit_lines_v1','capability name consistent');
const sourceFixture=read('scripts/fixtures/r241-site-combo-7-uai.json');
const fixture=JSON.parse(sourceFixture);
const deep=v=>JSON.parse(JSON.stringify(v));
const original=JSON.stringify(fixture);
const model=preview.inspectSiteComboUnitPreview(fixture);
eq(model.state,'preview_only','never real order');
eq(model.readable,true,'preview readable');
eq({persist:model.canPersist,print:model.canPrint,relay:model.canRelay,charge:model.canCharge},{persist:false,print:false,relay:false,charge:false},'all operations forbidden');
eq(model.productId,'combo-7-uai','product preserved');
eq(model.comboQuantity,2,'quantity preserved');
eq(model.units.length,14,'2 combos x 7 lanche units');
eq(new Set(model.units.map(x=>x.key)).size,14,'unique ids');
eq(model.units[0].key,'c1:1:1','first unit');
eq(model.units[13].key,'c2:1:7','last unit');
eq(model.units.filter(x=>x.comboNumber===2).length,7,'second combo independent');
eq(model.units.find(x=>x.key==='c1:1:3').addons.map(x=>x.id),['bacon'],'third Uai bacon');
eq(model.units.find(x=>x.key==='c1:1:4').addons.map(x=>x.id),['bacon','queijo'],'fourth Uai bacon and cheese');
eq(model.units.find(x=>x.key==='c2:1:4').addons.map(x=>x.priceCents),[375,225],'second combo addon prices in cents');
eq(model.units.find(x=>x.key==='c1:1:1').removals[0].label,'Cebola','first Uai no onion');
eq(model.units.find(x=>x.key==='c2:1:2').removals.map(x=>x.id),['cebola'],'second combo second Uai no onion');
eq(model.units.find(x=>x.key==='c1:1:5').addons,[],'fifth Uai unchanged');
eq(model.units.find(x=>x.key==='c1:1:7').note,'Molho separado','note retained');
eq(model.units.find(x=>x.key==='c2:1:7').note,'Molho separado','note repeated for second combo');
eq(model.basePerComboCents,6999,'combo base cents');
eq(model.extrasForOrderCents,1950,'all extras cents');
eq(model.totalPreviewCents,15948,'simulation total cents');
eq(model.units.reduce((s,u)=>s+u.extrasCents,0),1950,'line totals reconcile');
eq(model.kitchenPreviewLines.length,14,'one human line per unit');
ok(model.kitchenPreviewLines.every(l=>l.startsWith('SIMULAÇÃO')),'all lines marked simulation');
ok(model.kitchenPreviewLines.some(l=>l.includes('SEM Cebola')),'kitchen removal explicit');
ok(model.kitchenPreviewLines.some(l=>l.includes('+ Bacon')),'kitchen addon explicit');
ok(model.kitchenPreviewLines.some(l=>l.includes('OBS: Molho separado')),'kitchen note explicit');
eq(model.diagnosticId,'diagnostic-9a8f7e7d','exact R241 producer fixture checksum');
eq(JSON.stringify(fixture),original,'no input mutation');
eq(preview.inspectSiteComboUnitPreview(deep(fixture)),model,'roundtrip deterministic');
const mutate=(fn)=>{let x=deep(fixture);fn(x);return x};
for(const [name,alter,code] of [
 ['wrong contract',x=>x.contract='foo',/CONTRACT_INVALID/],
 ['future version',x=>x.version=2,/CONTRACT_INVALID/],
 ['pending rather than preview',x=>x.status='Pendente',/CONTRACT_INVALID/],
 ['send true',x=>x.sendAllowed=true,/NOT_OPERATIONAL/],
 ['real order id',x=>x.orderId='pedido',/NOT_OPERATIONAL/],
 ['real event id',x=>x.eventId='event',/NOT_OPERATIONAL/],
 ['payment permission',x=>x.authorization.payment=true,/AUTH_NOT_OFF/],
 ['printer permission',x=>x.authorization.print=true,/AUTH_NOT_OFF/],
 ['consumer claims ready',x=>x.consumer.supportsUnits=true,/CONSUMER_INVALID/],
 ['producer order schema changed',x=>x.producer.proposedUnitOrderSchema=4,/PRODUCER_INVALID/],
 ['invalid fingerprint',x=>x.source.blueprintFingerprint='stale',/SOURCE_INVALID/],
 ['invalid preview id',x=>x.source.previewId='fake',/SOURCE_INVALID/],
 ['fractional quantity',x=>x.source.quantity=1.5,/SOURCE_INVALID/],
 ['more than 30 combos',x=>x.source.quantity=31,/SOURCE_INVALID/],
 ['payable true',x=>x.accounting.payable=true,/ACCOUNTING_INVALID/],
 ['fractional total cents',x=>x.accounting.previewTotalCents+=0.1,/ACCOUNTING_INVALID/],
 ['extra unit price',x=>x.units[2].addons[0].priceCents=500,/UNIT_PRICE_INVALID/],
 ['duplicate key',x=>x.units[8].unitKey=x.units[0].unitKey,/UNIT_KEY_INVALID/],
 ['different combo number',x=>x.units[8].comboNumber=1,/UNIT_POSITION_INVALID/],
 ['wrong component key',x=>x.units[5].componentKey='2:6',/UNIT_POSITION_INVALID/],
 ['missing combo',x=>x.units=x.units.slice(0,7),/UNITS_INVALID|TOTAL_MISMATCH/],
 ['missing addon name',x=>x.units[2].addons[0].label='',/ADDON_INVALID/],
 ['control character note',x=>x.units[6].note='test\n',/UNIT_TEXT_INVALID/],
 ['addon duplicated',x=>x.units[2].addons.push(x.units[2].addons[0]),/ADDON_INVALID/],
 ['removal duplicated',x=>x.units[0].removals.push(x.units[0].removals[0]),/REMOVAL_INVALID/],
 ['unexpected hidden root',x=>x.customerSnapshot={name:'x'},/ROOT_FIELDS_INVALID/],
 ['unexpected unit field',x=>x.units[0].payable=true,/UNIT_FIELDS_INVALID/],
 ['changed counter',x=>x.safety.unitChoices=0,/COUNTERS_INVALID/],
 ['changed total',x=>x.accounting.previewTotalCents+=1,/TOTAL_MISMATCH/],
 ['bad checksum',x=>x.diagnosticId='diagnostic-deadbeef',/DIAGNOSTIC_INVALID/],
 ['reorder units',x=>x.units.reverse(),/UNIT_POSITION_INVALID/],
]) no(()=>preview.inspectSiteComboUnitPreview(mutate(alter)),code,name);
const legacy={orderSchemaVersion:2,itens:[{id:'combo-7-uai',quantity:1,unitPrice:69.99,
  selectedAddons:[{id:'bacon',name:'Bacon',price:3.75}],components:[{id:'uai',quantity:7}]}]};
eq(guard.legacySiteOrderCanPreserveContent(legacy),true,'existing v2 accepted');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,orderSchemaVersion:1}),true,'existing v1 accepted');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,orderSchemaVersion:3}),false,'unrecognized future orderSchemaVersion v3 blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,orderSchemaVersion:2.5}),false,'fractional schema blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,orderSchemaVersion:0}),false,'zero schema blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,comboUnitReceiverDraft:fixture}),false,'top-level combo draft blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,unitLines:fixture.units}),false,'top-level unitLines blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,itens:[{id:'x',unitSelections:[1]}]}),false,'nested choices blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,itens:[{id:'x',components:[{productId:'uai',comboUnitPlan:{}}]}]}),false,'component customization blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,itens:[{id:'x',unitPlan:null}]}),false,'null experimental field blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,itens:[{id:'x',perUnitChoices:{}}]}),false,'perUnit choices blocked');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,itens:[{id:'x',unit_price:22.5,unitPrice:22.5}]}),true,'legitimate unit price fields stay accepted');
eq(guard.legacySiteOrderCanPreserveContent({...legacy,contract:'dfl_site_combo_units_preview_v1'}),false,'preview contract never accepted in real order');
// Test the REAL v1 adapter by loading its TypeScript source with only the contract import stubbed.
const live=read('lib/integration/site-order.ts');
ok(live.includes("from './site-combo-unit-guard'"),'live receiver imports the guard');
ok(live.includes('legacySiteOrderCanPreserveContent(value)'),'live receiver calls guard before projecting');
const site=loadTs('lib/integration/site-order.ts',{
 './site-combo-unit-guard':guard,
 './contracts': {INTEGRATION_SCHEMA_VERSION:1,isIntegrationEventEnvelope:(x)=>!!x&&typeof x==='object'&&x.schema_version===1&&typeof x.event_type==='string'&&typeof x.entity_id==='string'},
});
const payload={orderId:'mock-r242',sourceSystem:'dfl_site',orderSchemaVersion:2,userId:'guest-r242',customerSnapshot:null,
 tipoEntrega:'pickup',deliverySnapshot:null,itens:legacy.itens,subtotal:69.99,taxaEntrega:0,desconto:0,cupom:null,
 rewardId:null,total:69.99,metodoPagamento:'pix',trocoPara:null,status:'Pendente',isAgendamento:false,statusUpdatedAt:null};
eq(site.isDflSiteOrderPayloadV1(payload),true,'live validator accepts current Site v2 order');
eq(site.isDflSiteOrderPayloadV1({...payload,orderSchemaVersion:3}),false,'live validator rejects not-yet-supported v3');
eq(site.isDflSiteOrderPayloadV1({...payload,itens:[{...legacy.itens[0],unitCustomization:fixture}]}),false,'live validator rejects experimental unit content');
const event={schema_version:1,event_type:'order.created',source_system:'dfl_site',entity_type:'order',entity_id:payload.orderId,payload};
site.assertDflSiteOrderCreatedEvent(event);count++;
no(()=>site.assertDflSiteOrderCreatedEvent({...event,payload:{...payload,orderSchemaVersion:3}}),/Payload DFL Site Order V1 inválido/,'created event v3 rejected before persistence');
site.assertDflSiteOrderUpdatedEvent({...event,event_type:'order.updated'});count++;
no(()=>site.assertDflSiteOrderUpdatedEvent({...event,event_type:'order.updated',payload:{...payload,comboUnitPlan:fixture}}),/Payload DFL Site Order V1 inválido/,'updated event with unit draft rejected');
eq(site.commercialSnapshotFromSite(payload).schema_version,1,'legacy commercial projection stays schema v1');
const inbox=read('lib/integration/server/siteOrderPersistence.ts');
ok(inbox.includes('assertDflSiteOrderCreatedEvent')&&inbox.includes('assertDflSiteOrderUpdatedEvent'),'persisted inbound calls shared validators');
ok(inbox.includes('siteOrderItemsFromPayload')&&inbox.includes('commercialSnapshotFromSite'),'legacy projection retained');
ok(!inbox.includes('site-combo-unit-preview'),'simulation not imported by Firestore persistence');
const api=read('app/api/integration/events/route.ts');
ok(api.includes('assertSignedIntegrationRequest') && api.includes('consumeDflSiteOrderCreatedPersisted'),'HMAC and idempotent persistence still in place');
const flow=read('.github/workflows/main.yml');
ok(flow.includes('node scripts/test-r242-site-combo-receiver.cjs'),'new test included before APK build');
const previous=read('scripts/pre-apk.cjs');
ok(previous.includes('scripts/test-r233-report-comms-polish.cjs'),'existing operational gates remain');
const draftSrc=read('lib/integration/site-combo-unit-preview.ts');
ok(!/\b(?:fetch|setDoc|addDoc|runTransaction|window|localStorage|postMessage|print)\s*\(/.test(draftSrc),'preview module performs no I/O');
console.log(`R242: ${count} verificações aprovadas; nenhum pedido, escrita Firestore, impressão ou relay.`);
