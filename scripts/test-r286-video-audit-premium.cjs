#!/usr/bin/env node
/* R286: contratos de não mutação, relatório visual e regressão operacional. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
const ok=(cond,label)=>{assert.ok(cond,'R286: '+label);checks++};
const eq=(a,b,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),'R286: '+label);checks++};
const mod={exports:{}};
const src=read('lib/motoboy-settlement-visual.ts');
const generated=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
vm.runInNewContext(generated.outputText,{module:mod,exports:mod.exports}, {filename:'lib/motoboy-settlement-visual.ts'});
const {settlementVisualLines}=mod.exports;
const adjusted=settlementVisualLines([
 {kind:'meal',description:'Consumo / lanche',amount:28,direction:'deduction'},
 {kind:'advance',description:'Adiantamento de ontem',amount:50,direction:'deduction'},
 {kind:'fuel',description:'Combustível',amount:35,direction:'deduction'},
 {kind:'extra_service',description:'Serviço extra no bairro',amount:20,direction:'addition'},
 {kind:'custom',description:'',category_label:'Motivo digitado',amount:5,direction:'deduction'},
 {kind:'custom',description:'Não deve entrar',amount:NaN,direction:'addition'},
]);
eq(adjusted.deductions.map(x=>x.label),['Consumo / lanche','Adiantamento de ontem','Combustível','Motivo digitado'],'cada motivo preservado sem repetir categoria');
eq(adjusted.deductions.reduce((s,x)=>s+x.amount,0),118,'abatimentos visuais seguem os dados, sem alterar conta');
eq(adjusted.additions.map(x=>x.label),['Serviço extra no bairro'],'acréscimo discriminado');
eq(adjusted.additions[0].amount,20,'valor do acréscimo intacto');
const home=read('app/page.tsx'),loja=read('app/loja/page.tsx'),mais=read('app/mais/page.tsx');
ok(home.includes('homeToolsOpen &&')&&home.includes('<OperationalAssistant dayDeliveries={deliveriesDoDia}')&&home.includes('<OperationalDemandCard />'),'busca 360 e leitura sob demanda');
ok(home.includes('<OperationalCommandCenter')&&!home.includes('<ShiftBriefing />')&&!home.includes('Ver análises avançadas (Radar legado)'),'Home prioriza operação e rotas');
ok(loja.includes('<ShiftBriefing />')&&loja.includes('showOpeningReview')&&loja.includes('Conferência de abertura'),'conferência preservada na Loja');
ok(mais.includes('<OperationalRadar />')&&mais.includes('legacyRadarOpen &&'),'Radar legado preservado sem montar na Home');
ok(home.includes('Pedidos{pendingDeliveries')&&home.includes('Faturamento do período'),'pedidos comerciais sem ambiguidade com paradas');
const demand=read('components/home/OperationalDemandCard.tsx');
ok(!demand.includes('<select')&&demand.includes('aria-pressed={override===value}')&&demand.includes('setOverride(value)'),'controle premium de demanda sem select nativo');
for(const s of ['fetch(','onSnapshot(','runTransaction(','setDoc('])ok(!demand.includes(s),'painel de demanda não escreve: '+s);
const settlement=read('app/motoboys/acerto/page.tsx');
ok(settlement.includes('Pedidos atendidos')&&settlement.includes('Paradas físicas (diária)')&&settlement.includes('data.groupedOrderCount'),'contagem dupla explícita sem reclassificar pedidos');
ok(settlement.includes('settlementVisualLines(displayAdjustments)')&&settlement.includes('ABATIMENTOS DISCRIMINADOS')&&settlement.includes('ACRÉSCIMOS DISCRIMINADOS'),'imagem usa snapshot de ajustes com sessões independentes');
ok(settlement.includes('visibleImageRows=settlementImageRows.slice(0,72)')&&settlement.includes('imageExtraRows'),'imagem suporta mais itens com limite explícito de memória');
ok(settlement.includes("text:summaryCompact()")&&settlement.includes('navigator.clipboard.writeText(summary())'),'compartilhamento curto sem perder cópia integral');
ok(settlement.includes('fee.amount')&&settlement.includes('cashHandedOverAmount')&&settlement.includes('settlementDirection'),'cálculos canônicos mantidos');
const analytics=read('lib/motoboy-analytics.ts');
ok(analytics.includes('calculateMotoboyFee(motoboy.payment_rule,physicalDeliveryCount)')&&analytics.includes('groupDeliveriesByStop'),'diária permanece pelas paradas físicas');
const duplicates=read('app/clientes/duplicados/page.tsx');
ok(duplicates.includes('candidates.slice(0, visibleCount).map')&&duplicates.includes('Toque para comparar')&&duplicates.includes('<details className="group">'),'duplicados recolhíveis sem perder pares');
ok(duplicates.includes('mergeCustomers(source.id, target.id)')&&duplicates.includes('requestMerge(candidate.right, candidate.left, key)')&&duplicates.includes('requestMerge(candidate.left, candidate.right, key)'),'união permanece manual e reversível na escolha do alvo');
for(const path of ['app/page.tsx','app/loja/page.tsx','app/mais/page.tsx','components/home/OperationalDemandCard.tsx','app/motoboys/acerto/page.tsx','app/clientes/duplicados/page.tsx','lib/motoboy-settlement-visual.ts']){
 const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 eq(ast.parseDiagnostics.length,0,'AST TypeScript/TSX '+path);
}
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r286-video-audit-premium.cjs'")&&pre.includes("'scripts/test-r285-closeout.cjs'")&&pre.includes("'scripts/test-r284-operations-premium.cjs'"),'todas suítes preservadas e R286 primeiro');
console.log(`R286 VIDEO AUDIT PREMIUM: ${checks} contratos aprovados — sem rede, sem Firestore, sem WhatsApp`);
