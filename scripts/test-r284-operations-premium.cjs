#!/usr/bin/env node
/** R284: cenários puros de modalidade + integridade visual/financeira. Sem rede/Firestore/WhatsApp. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const vm=require('node:vm');
const read=f=>fs.readFileSync(f,'utf8');
let count=0;
function ok(v,label){assert.ok(v,`R284: ${label}`);count++;}
function eq(a,b,label){assert.equal(a,b,`R284: ${label}`);count++;}
function checkSyntax(file){
  const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  eq(ast.parseDiagnostics.length,0,'AST '+file+': '+ast.parseDiagnostics.map(d=>d.messageText).join(' / '));
}
const pure='lib/operation/marketplace-modes.ts';
checkSyntax(pure);
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(read(pure),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports}, {filename:pure});
const rules=mod.exports;
const modes={ifood:'dfl',food99:'platform',keeta:'platform'};
for(const [origin,want] of [['ifood','delivery'],['food99','external_delivery'],['keeta','external_delivery'],['loja','delivery']]) eq(rules.defaultMarketplaceFulfillment(undefined,origin),want,`fallback ${origin}`);
for(const origin of ['ifood','food99','keeta']) {
  eq(rules.defaultMarketplaceFulfillment({...modes,[origin]:'dfl'},origin),'delivery',`${origin} rota DFL`);
  eq(rules.defaultMarketplaceFulfillment({...modes,[origin]:'platform'},origin),'external_delivery',`${origin} parceira`);
  eq(rules.marketplaceLogisticsProvider(origin,'delivery'),'dfl',`${origin} responsável DFL`);
  eq(rules.marketplaceLogisticsProvider(origin,'external_delivery'),origin,`${origin} responsável externo`);
}
eq(rules.marketplaceLogisticsProvider('loja','pickup'),'customer','retirada pelo cliente');
eq(rules.marketplaceLogisticsProvider('loja','counter'),'customer','balcão sem motoboy');
eq(rules.marketplaceLogisticsProvider('loja','delivery'),'dfl','loja entrega própria');
const updated=rules.mergeMarketplacePreference({ifood:'platform',food99:'dfl',keeta:'platform'},'keeta','dfl');
eq(updated.ifood,'platform','mudança Keeta não altera iFood');
eq(updated.food99,'dfl','mudança Keeta não altera 99Food');
eq(updated.keeta,'dfl','Keeta pode ser própria');
const updatedBack=rules.mergeMarketplacePreference(updated,'ifood','dfl');
eq(updatedBack.keeta,'dfl','mudança iFood não altera Keeta');
eq(updatedBack.food99,'dfl','mudança iFood não altera 99Food');
eq(rules.configuredMarketplaceMode(undefined,'loja'),null,'Loja não vira marketplace');

const state=read('store/useAppStore.ts');
ok(state.includes('marketplaceDeliveryModes?:')&&state.includes("keeta?: 'dfl' | 'platform'"),'configurações opcionais em documento existente');
const loja=read('app/loja/page.tsx');
ok(loja.includes("(['ifood','food99','keeta'] as const)")&&loja.includes('mergeMarketplacePreference'),'três padrões persistentes sem perda');
ok(loja.includes('Origem, alertas e automação')&&loja.includes('Entrega por plataforma'),'hierarquia da Loja preservada');
ok(loja.includes('min-h-12')&&loja.includes('aria-pressed={mode===next}'),'controles premium com tamanho tátil');
const create=read('app/entregas/nova/page.tsx');
ok(create.includes("defaultMarketplaceFulfillment(marketplaceModes, draftOrigin)") && create.includes("defaultMarketplaceFulfillment(marketplaceModes,'keeta')"),'rascunho e Keeta respeitam preferência');
ok(create.includes("marketplaceModes?.food99 === 'dfl'")||create.includes("marketplaceModes?.food99 !== 'dfl'"),'padrão R69 99Food preservado');
ok(create.includes("marketplaceModes?.ifood === 'platform'"),'padrão iFood preservado');
ok(create.includes("setFulfillmentMode('external_delivery')")&&create.includes("setFulfillmentMode('delivery')"),'alternância manual por pedido');
ok(!create.includes("origin==='keeta'&&fulfillmentMode!=='external_delivery'"),'Keeta não fica presa à parceira');
ok(create.includes("logistics_provider:fulfillmentMode==='delivery'?'dfl':origin==='keeta'?'keeta':origin==='food99'?'food99':'customer'"),'persistência por modalidade para todos os canais');
ok(!create.includes("origin==='food99'?'food99':origin==='ifood'"),'sem comparação impossível com iFood no ramo externo de cadastro');
ok(create.includes('if(fulfillmentMode===\'delivery\'&&!openRoutes.some')&&create.includes('firstRequiredDeliveryIssue'),'rota própria valida antes da escrita');
ok(create.includes('keetaPaymentReviewed'),'pagamento Keeta exige revisão explícita');
ok(create.includes('manual_messaging_opt_in_v1: notifyWhatsapp && origin === \'loja\' && fulfillmentMode === \'delivery\''),'mensageria não dispara por plataforma');
const edit=read('app/entregas/editar/page.tsx');
ok(edit.includes('setFulfillmentMode(getFulfillmentMode(delivery))'),'edição abre com modo histórico');
ok(edit.includes('operationalAssignmentChanged')&&edit.includes('origin !== (currentDelivery.origin'), 'pedido concluído não troca a origem');
ok(edit.includes("setOrigin('keeta')")&&edit.includes("setOrigin('food99')"),'seletor acessível de quatro canais na edição');
ok(edit.includes("defaultMarketplaceFulfillment(marketplaceModes,'keeta')"),'trocar origem aplica novo padrão sem mudar o histórico');
ok(!edit.includes("Confira o número Keeta e mantenha entrega pela plataforma."),'editor permite Keeta própria');
ok(edit.includes("fulfillmentMode === 'delivery' ? 'dfl'")&&edit.includes("origin === 'keeta' ? 'keeta'"),'edição resolve responsável pela modalidade');
ok(!edit.includes("setOrigin('food99');setFulfillmentMode('external_delivery');setRouteId('');setIfoodId('');setConfirmationCode('');"),'botão órfão no cancelado foi eliminado');
const report=read('lib/reports/buildReportModel.ts');
ok(report.includes("if (raw === 'keeta') return 'Keeta'")&&report.includes("normalizeLogisticsProvider"),'Keeta preservada na venda e na logística');
ok(report.includes('totalDeliveries: dflLogisticsCurrent.length'),'produtividade DFL não infla com parceiras');
const reports=read('app/relatorios/page.tsx');
ok(reports.includes('channelColors')&&reports.includes('OriginChart data=')&&reports.includes('Responsável pela entrega'),'gráficos comerciais e logísticos distintos');
const chart=read('components/reports/ReportChartCard.tsx');
for(const hue of ['#ef4444','#facc15','#8b5cf6','#10b981']) ok(chart.includes(hue),'barra de origem cor '+hue);
ok(chart.includes('<Cell key={bucket.key}')&&chart.includes('channelColors &&'),'cores se aplicam só à origem');
const origin=read('components/reports/Charts/OriginChart.tsx');
ok(origin.includes('Ticket médio')&&origin.includes('style.text')&&origin.includes('leadingPercent'),'origem colorida, percentuais e ticket');
const conf=read('app/confirmacoes/page.tsx');
ok(conf.includes('aria-label="Estado das confirmações"')&&conf.includes('r282-external-confirmations')&&conf.includes('r282-operational-confirmations'),'central organizada preserva os dois núcleos');
const future=read('components/store/FutureRoutePlanPanel.tsx');
ok(future.includes('aria-label="Escolher rota futura"')&&future.includes('aria-pressed={choices[delivery.id]===r.id}')&&!/<select\b/.test(future),'seleção de rota futura premium e explícita');
const inbox=read('app/loja/caixa-de-entrada/page.tsx');
ok(inbox.includes("importSource==='keeta'")&&inbox.includes('setChannel'),'Caixa apresenta ajuda contextual');
for(const path of ['app/confirmacoes/page.tsx','app/loja/caixa-de-entrada/page.tsx','app/loja/page.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx']) {
 ok(!/<select\b/i.test(read(path)),'sem select nativo '+path);
}
for(const file of ['app/loja/page.tsx','app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','app/confirmacoes/page.tsx','app/loja/caixa-de-entrada/page.tsx','app/relatorios/page.tsx','components/reports/ReportChartCard.tsx','components/reports/Charts/OriginChart.tsx','lib/reports/buildReportModel.ts','store/useAppStore.ts','components/store/FutureRoutePlanPanel.tsx']) checkSyntax(file);
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes('scripts/test-r284-operations-premium.cjs')&&pre.includes('scripts/test-r283-keeta.cjs')&&pre.includes('scripts/test-r282-premium-center.cjs'),'PRE-APK incremental; suites antigas preservadas');
console.log(`R284 OPERAÇÃO PREMIUM: ${count} garantias e cenários PASS — sem rede/Firestore/WhatsApp`);
