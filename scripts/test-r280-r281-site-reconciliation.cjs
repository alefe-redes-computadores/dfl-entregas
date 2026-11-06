'use strict';
/* R280/R281: regresão hermética (sem Firestore, pedidos reais, WhatsApp ou rede). */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let passed=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);passed++};
const ok=(condition,label)=>{assert.ok(condition,label);passed++};
function load(path,stubs={}){
  const source=fs.readFileSync(path,'utf8');
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  eq(ast.parseDiagnostics.length,0,`Sintaxe de ${path}`);
  const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  eq((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,`Transpilação de ${path}`);
  const module={exports:{}};
  new Function('require','module','exports',result.outputText)(name=>{
    if(!Object.prototype.hasOwnProperty.call(stubs,name))throw Error('Import runtime inesperado: '+name);
    return stubs[name];
  },module,module.exports);
  return module.exports;
}
const review=load('lib/operation/site-manual-review-r280.ts');
const history=load('lib/operation/site-order-history-r161.ts',{
  '@/lib/integration/site-order':{isCancelledSiteDelivery:()=>false},
  '@/lib/delivery-attempts':{deliveryAttemptLabel:()=> 'Tentativa'},
});
const now=Date.parse('2026-11-05T22:00:00.000Z');
const base={id:'site-order-v1__site_abc0123',source_system:'dfl_site',origin:'loja',external_order_id:'site_0123456789ABCD',created_at:'2026-11-05T20:00:00.000Z',customer_name:'José da Silva',phone:'+55 (34) 99999-1111',customer_charge:58.9,value:58.9};
const manual={id:'delivery-manual-0001',origin:'loja',source_system:undefined,created_at:'2026-11-05T20:12:00.000Z',customer_name:'Jose da Silva',phone:'34999991111',customer_charge:58.9,value:58.9,route_id:'rota-1'};
eq(review.manualMatchLevel(base,manual,now),'forte','telefone e valor + data sinalizam conferência forte');
eq(review.manualMatchLevel(base,{...manual,phone:''},now),'revisar','nome e valor + data sinalizam revisão');
eq(review.manualMatchLevel(base,{...manual,value:60,customer_charge:60},now),'nenhuma','valor diferente nunca sugere duplicidade');
eq(review.manualMatchLevel(base,{...manual,created_at:'2026-10-01T00:00:00Z'},now),'nenhuma','pedido fora da janela não sugerido');
eq(review.manualMatchLevel(base,{...manual,source_system:'dfl_site'},now),'nenhuma','pedido do Site nunca tratado como lançamento manual');
eq(review.manualMatchLevel(base,{...manual,origin:'food99'},now),'nenhuma','99Food não é pedido manual da loja');
const candidates=review.siteManualReviewCandidates(base,[{...manual,phone:''},manual,{...manual,id:'diferente',value:30,customer_charge:30}],now);
eq(candidates.length,2,'candidatos sem falsa inclusão');
eq(candidates[0].level,'forte','prioridade para correspondência mais específica');
const before=JSON.stringify(base);
review.siteManualReviewCandidates(base,[manual],now);
eq(JSON.stringify(base),before,'sugestão não altera pedido');
eq(review.siteManualArchiveReason('delivery-manual-0001').includes('ref-manual=delivery-manual-0001;'),true,'motivo contém referência auditável');
assert.throws(()=>review.siteManualArchiveReason('foo/bar'),/inválido/);passed++;
eq(history.siteHistoryCompactId(base),'6789ABCD','ID curto somente na camada visual');
ok(history.siteHistoryTime({...base,completed_at:'2026-11-05T20:30:00.000Z',completed:true}).includes('05/11/2026'),'data/hora legível');
const panel=fs.readFileSync('components/store/SiteInboxPanel.tsx','utf8');
const store=fs.readFileSync('store/useAppStore.ts','utf8');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
const guard=fs.readFileSync('lib/integration/site-combo-unit-guard.ts','utf8');
ok(panel.includes('siteManualReviewCandidates')&&panel.includes('manualReferenceConfirmed'),'conciliação explícita no componente');
ok(panel.includes('disabled={requiresManualReview}')&&panel.includes('Conferi: é outro pedido'),'possível correspondência impede seleção acidental da rota');
ok(panel.includes('archiveSiteDelivery(archiveId,reason)')&&store.includes("source_system !== 'dfl_site'"),'preserva ação transacional e autoridade Site');
ok(panel.includes('siteHistoryCompactId(item)')&&panel.includes('siteHistoryTime(item)')&&panel.includes('Ver detalhes do pedido')&&panel.includes('Mostrar ID completo')&&panel.includes('{item.external_order_id||item.order_id||item.id}')&&panel.includes('{delivery.external_order_id||delivery.order_id||delivery.id}'),'histórico compacto e IDs integrais disponíveis sob demanda');
ok(panel.indexOf('R281: histórico')>panel.indexOf('className="flex items-center gap-3 rounded-[20px]'),'histórico após a caixa ativa');
ok(pre.includes('scripts/test-r280-r281-site-reconciliation.cjs'),'regressão permanente no PRE-APK');
const legacy=fs.readFileSync('scripts/verify-v111-r68-premium-ux.cjs','utf8');
ok(legacy.includes('Pedido individual identificado: código curto e ID integral acessível')&&legacy.includes("site.includes('Mostrar ID completo')"),'R68 atualizado para aceitar apresentação compacta sem ignorar ID integral');
ok(guard.includes('SITE_LEGACY_ORDER_SCHEMA_MAX = 3')&&guard.includes('SITE_COMBO_UNIT_PRODUCTION_SUPPORTED = false'),'Site V3 somente flat e customizações avançadas bloqueadas');
console.log(`R280-R281: ${passed} regressões herméticas PASS; sem criar pedido, rota, pagamento, rede ou WhatsApp.`);
