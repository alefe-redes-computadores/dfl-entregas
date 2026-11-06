/* R283 — Gate hermético Keeta, sem Firestore, rede, WhatsApp ou pedido real. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=(path)=>fs.readFileSync(path,'utf8');
const load=(file,stubs={})=>{
  const output=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  const localRequire=(name)=>{
    if(Object.hasOwn(stubs,name))return stubs[name];
    throw new Error('R283 teste não autoriza require de '+name);
  };
  new Function('require','module','exports',output)(localRequire,module,module.exports);
  return module.exports;
};
let count=0;
const ok=(condition,message)=>{assert.ok(condition,message);count++};
const equal=(actual,expected,message)=>{assert.equal(actual,expected,message);count++};
const p=load('lib/keeta-order.ts');
const raw='Keeta\nPedido: #K-12345\nCliente: Maria Silva\nTotal do pedido: R$ 42,50\nBebidas: 2x Kuat 2L\nPagamento: Pix\nPago no app\nObservação: sem gelo';
const item=p.parseKeetaOrdersText(raw)[0];
for(const [name,value] of Object.entries({orderId:'K-12345',customerName:'Maria Silva',customerCharge:'42,50',value:'42,50',paymentMethod:'pix',isPaid:true,ifoodId:'',confirmationCode:'',routeNumber:'',motoboyHint:''}))equal(item[name],value,`Keeta ${name}`);
equal(item.drinks[0],'2x Kuat 2L','bebida íntegra');
equal(item.observations[0],'sem gelo','observação preservada');
const noGuess=p.parseKeetaOrdersText('Keeta\nCliente: Ana\nTotal do pedido: R$ 65,00')[0];
equal(noGuess.orderId,'','não adivinha nº comercial');
equal(noGuess.ifoodId,'','não inventa ID iFood');
equal(noGuess.isPaid,false,'não assume pagamento sem prova');
const noMoney=p.parseKeetaOrdersText('Pedido: Q7788\nCliente: Bia\nCoca-Cola 2L')[0];
equal(noMoney.customerCharge,'','não inventa preço a partir de bebida');
equal(noMoney.drinks[0],'Coca-Cola 2L','bebida sem rótulo explícito');
equal(p.parseKeetaOrdersText('Keeta\nPedido: ABC123\nPedido: DEF456\nCliente: Joana').length,0,'não descarta silenciosamente segundo pedido');
ok(p.isKeetaText('Keeta\nPedido 123456'),'marca explícita Keeta');
ok(!p.isKeetaText('Pedido 123456'),'número isolado não indica Keeta');
ok(p.isKeetaCommercialId('K-12345'),'formato ID não assume seis dígitos');
ok(!p.isKeetaCommercialId(''),'sem ID bloqueia gravação');
ok(!p.isKeetaCommercialId('123/456'),'sem barras em ID comercial');

const inbox=load('lib/delivery-inbox.ts',{'@/lib/ifood-parser-quality':{assessIfoodParseQuality:()=>({issues:[]})}});
ok(!read('lib/delivery-inbox.ts').includes("from '@/lib/keeta-order'"),'Caixa independente de import Keeta em contratos legados offline');
equal(inbox.inferInboxSource(raw,item),'keeta','inferência explícita Keeta');
equal(inbox.inferInboxSource('Pedido 123456',noGuess),'texto','texto não vira Keeta por palpite');
const draft=inbox.createInboxDraft(item,raw,'2026-11-06',[],0,'keeta');
equal(draft.source,'keeta','forçar origem auditável');
equal(draft.status,'ready','Keeta completa entra pronta para revisão do usuário');
const incomplete=inbox.createInboxDraft(noGuess,'Keeta\nCliente: Ana','2026-11-06',[],1,'keeta');
equal(incomplete.status,'review','sem ID exige revisão');
ok(incomplete.missingFields.some(x=>x.includes('Keeta')),'indica o campo que falta');
const withoutAmount=inbox.createInboxDraft(noMoney,'Keeta\nPedido: Q7788','2026-11-06',[],2,'keeta');
ok(withoutAmount.missingFields.some(x=>x.includes('valor Keeta')),'valor ausente não vira zero silencioso');
const existing={id:'already-keeta',origin:'keeta',order_id:'K-12345',created_at:new Date().toISOString()};
ok(Boolean(inbox.findInboxDuplicate(item,[existing],'keeta')),'reimportação Keeta mesmo dia bloqueada');
equal(inbox.findInboxDuplicate(item,[{...existing,origin:'food99'}],'keeta'),null,'número igual em 99Food não colide');
const duplicates=inbox.dedupeInboxImport([draft,{...draft,id:'another'}],[]);
equal(duplicates.unique.length,1,'mesmo número Keeta no mesmo lote gera um rascunho');

const identity=load('lib/operation/delivery-import-identity.ts');
const stamp='2026-11-06T13:00:00.000Z';
const kId=identity.deliveryImportDocumentId({origin:'keeta',order_id:'K-12345',created_at:stamp});
ok(kId?.startsWith('dfl-import-v1-keeta-order-'),'ID Firestore com namespace Keeta');
equal(identity.deliveryImportDocumentId({origin:'keeta',order_id:'K-12345',created_at:stamp}),kId,'idempotência determinística');
ok(identity.deliveryImportDocumentId({origin:'food99',order_id:'123456',created_at:stamp})!==kId,'Keeta ≠ 99Food');
equal(identity.deliveryImportDocumentId({origin:'keeta',order_id:'',created_at:stamp}),null,'sem nº Keeta sem canonicalId');
equal(identity.deliveryImportDocumentId({origin:'keeta',order_id:'K-12345'}),null,'sem data não cria canonicalId');

const sources={
  'types/index.ts':['\'keeta\'','LogisticsProvider'],
  'store/useAppStore.ts':['leftKeeta','rightKeeta',"delivery.origin === 'keeta'",'deliveryImportDocumentId'],
  'lib/delivery-inbox.ts':["source === 'keeta'",'selectedSource?: DeliveryInboxSource'],
  'app/loja/caixa-de-entrada/page.tsx':['parseKeetaOrdersText','setImportSource','sourceMeta[draft.source]'],
  'app/entregas/nova/page.tsx':["setOrigin('keeta')", "setFulfillmentMode('external_delivery')", "origin==='keeta'", "logistics_provider:fulfillmentMode==='delivery'?'dfl':origin==='keeta'?'keeta'",'isKeetaCommercialId(orderId)'],
  'app/entregas/editar/page.tsx':["origin === 'keeta'", "origin === 'keeta' ? 'keeta'"],
  'lib/delivery-presentation.ts':["delivery.origin === 'keeta'", "'Pedido Keeta'"],
  'components/home/DeliveryCard.tsx':['keeta: { label: \'KEETA\''],
  'app/entregas/page.tsx':["'keeta' | 'loja'", "value === 'keeta'"],
  'app/entregas/details/page.tsx':["channel === 'keeta'"],
  'lib/reports/buildReportModel.ts':["raw === 'keeta'", "logistics_provider === 'keeta'"],
  'components/reports/Charts/OriginChart.tsx':["keeta: { name:'Keeta'"],
  'scripts/pre-apk.cjs':['scripts/test-r283-keeta.cjs','scripts/test-r282-premium-center.cjs'],
};
for(const [file,markers] of Object.entries(sources)){
  const source=read(file);
  for(const marker of markers)ok(source.includes(marker),`${file}: ${marker}`);
}
// Parser TypeScript/TSX de todos os arquivos alterados, sem depender da rede.
for(const file of Object.keys(sources).filter(file=>/\.tsx?$/.test(file)).concat('lib/keeta-order.ts')){
  const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
  const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
  ok(!parsed.parseDiagnostics.length,`Sintaxe ${file}: ${parsed.parseDiagnostics[0]?.messageText||''}`);
}
console.log(`R283 KEETA: ${count} contratos herméticos PASS (sem rede/Firestore/WhatsApp)`);
