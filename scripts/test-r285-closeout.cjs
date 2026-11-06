#!/usr/bin/env node
/** R285: auditoria local hermetica. Nao escreve Firebase, WhatsApp, rota ou pedido. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
const read=(f)=>fs.readFileSync(f,'utf8');
let checked=0;
function ok(condition,name){assert.ok(condition,`R285: ${name}`);checked++; console.log('OK:',name)}
function eq(actual,expected,name){assert.equal(actual,expected,`R285: ${name}`);checked++; console.log('OK:',name)}
function syntax(path){const p=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(p.parseDiagnostics.length===0,`sintaxe ${path}`)}
function loadPure(path){const module={exports:{}};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:module.exports,module},{filename:path,timeout:2500});return module.exports;}
const modes=loadPure('lib/operation/marketplace-modes.ts');
for(const [origin,expected] of [['ifood','delivery'],['food99','external_delivery'],['keeta','external_delivery']]){
  eq(modes.defaultMarketplaceFulfillment(undefined,origin),expected,`fallback comercial ${origin}`);
  eq(modes.defaultMarketplaceFulfillment({[origin]:'platform'},origin),'external_delivery',`plataforma ${origin}`);
  eq(modes.defaultMarketplaceFulfillment({[origin]:'dfl'},origin),'delivery',`rota DFL ${origin}`);
  eq(modes.marketplaceLogisticsProvider(origin,'external_delivery'),origin,`logistica externa ${origin}`);
  eq(modes.marketplaceLogisticsProvider(origin,'delivery'),'dfl',`logistica DFL ${origin}`);
}
const oldPrefs={ifood:'platform',food99:'dfl',keeta:'platform'};
const changed=modes.mergeMarketplacePreference(oldPrefs,'keeta','dfl');
eq(changed.ifood,'platform','mudar Keeta preserva iFood');eq(changed.food99,'dfl','mudar Keeta preserva 99Food');
const create=read('app/entregas/nova/page.tsx');
ok(create.includes("() => defaultMarketplaceFulfillment(marketplaceModes, 'ifood')"),'iFood nasce com padrao salvo, sem toque no seletor');
ok(create.includes('if (!hasHydrated || initialMarketplaceModeHydrated.current) return;'),'hydration aplica modo uma vez');
ok(create.includes('inboxDraftId || sameStopDeliveryId || marketplaceModeTouched.current || origin !== \'ifood\''),'rascunho, mesma parada e escolha manual nao sao sobrescritos');
ok(create.includes("if (preferredMode === 'external_delivery') setRouteId('');"),'entrada externa remove rota anterior');
ok(create.includes("marketplaceModeTouched.current=true;setFulfillmentMode('delivery')")&&create.includes("marketplaceModeTouched.current=true;setFulfillmentMode('external_delivery')"),'dois botoes manuais protegidos');
ok(create.includes("marketplaceModeTouched.current = true; setOrigin('ifood')")&&create.includes("marketplaceModeTouched.current = true; setOrigin('food99')")&&create.includes("marketplaceModeTouched.current = true; setOrigin('keeta')")&&create.includes("marketplaceModeTouched.current = true; setOrigin('loja')"),'quatro origens explicitas protegidas');
ok(create.includes("defaultMarketplaceFulfillment(marketplaceModes, draftOrigin)"),'Caixa usa modo por origem');
ok(create.includes("setFulfillmentMode(sameStopSource.fulfillment_mode || 'delivery')"),'mesma parada preserva modalidade historica');
ok(create.includes("firstRequiredDeliveryIssue({ fulfillmentMode, routeId")&&create.includes("if(fulfillmentMode==='delivery'&&!openRoutes.some"),'entrega propria exige rota aberta e endereco');
ok(create.includes("origin==='keeta'&&!keetaPaymentReviewed"),'Keeta exige revisao de pagamento');
ok(create.includes("logistics_provider:fulfillmentMode==='delivery'?'dfl':origin==='keeta'?'keeta':origin==='food99'?'food99':'customer'"),'persiste logistica por modalidade');
const edit=read('app/entregas/editar/page.tsx');
ok(edit.includes('setFulfillmentMode(getFulfillmentMode(delivery))'),'editar preserva modalidade do pedido existente');
ok(edit.includes('currentDelivery?.completed && operationalAssignmentChanged'),'concluido nao muda origem, rota ou responsavel');
ok(edit.includes("setOrigin('keeta')")&&edit.includes("setOrigin('food99')"),'edicao abrange plataformas sem controles orfaos');
ok(edit.includes("logistics_provider: fulfillmentMode === 'delivery' ? 'dfl'"),'edicao usa modalidade para responsavel');
const report=read('lib/reports/buildReportModel.ts');
ok(report.includes("if (raw === 'keeta') return 'Keeta'")&&report.includes('totalDeliveries: dflLogisticsCurrent.length'),'Keeta comercial sem inflar motoboys');
const reports=read('app/relatorios/page.tsx');
ok(reports.includes('<OriginChart data=')&&reports.includes('Responsável pela entrega')&&reports.includes('channelColors'),'graficos por origem e responsavel');
const bars=read('components/reports/ReportChartCard.tsx');
for(const color of ['#ef4444','#facc15','#8b5cf6','#10b981'])ok(bars.includes(color),`cor comercial ${color}`);
const conf=read('app/confirmacoes/page.tsx');
ok(conf.includes('r282-external-confirmations')&&conf.includes('r282-operational-confirmations'),'portal externo e operacao separados');
const inbox=read('app/loja/caixa-de-entrada/page.tsx');
ok(inbox.includes("importSource==='keeta'")&&inbox.includes('setChannel'),'Caixa Keeta e Site preservados');
const future=read('components/store/FutureRoutePlanPanel.tsx');
ok(!future.includes('<select')&&future.includes('aria-pressed={choices[delivery.id]===r.id}'),'selecao de rota futura sem select nativo');
for(const path of ['app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','app/confirmacoes/page.tsx','app/loja/caixa-de-entrada/page.tsx']){
  syntax(path);
  ok(!/<select\b/.test(read(path)),`sem select nativo na central/formulario ${path}`);
}
syntax('lib/operation/marketplace-modes.ts');syntax('lib/reports/buildReportModel.ts');syntax('app/relatorios/page.tsx');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r285-closeout.cjs'")&&pre.includes("'scripts/test-r284-operations-premium.cjs'")&&pre.includes("'scripts/test-r283-keeta.cjs'"),'R285 nao desativa gates historicos');
ok(!create.includes('onSnapshot(')&&!report.includes('onSnapshot('),'sem novas assinaturas de rede na cirugia');
console.log(`R285_AUDITORIA_LOCAL_APROVADA: ${checked} verificacoes hermeticas. Nenhuma gravacao real.`);
