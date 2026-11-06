#!/usr/bin/env node
/** R287: regressões comportamentais do fluxo histórico e contratos dos 8 selects; sem rede. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const vm=require('node:vm');
let total=0;
const read=p=>fs.readFileSync(p,'utf8');
const ok=(v,message)=>{assert.ok(v,'R287: '+message);total++};
const eq=(a,b,message)=>{assert.equal(a,b,'R287: '+message);total++};
function syntax(path){const k=path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;const parsed=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,k);eq(parsed.parseDiagnostics.length,0,'AST '+path+' '+parsed.parseDiagnostics.map(d=>d.messageText).join('; '))}
const dateSource=read('lib/operation/dated-operation-navigation.ts');
const generated=ts.transpileModule(dateSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
const context={exports:{},module:{exports:{}},Date,URLSearchParams};context.exports=context.module.exports;
vm.runInNewContext(generated.outputText,context,{filename:'dated-operation-navigation.ts'});
const navigation=context.module.exports;
eq(navigation.datedOperationKey('2026-11-05','2026-11-06'),'2026-11-05','abre ontem diretamente, sem renderizar hoje');
eq(navigation.datedOperationKey('2026-11-06','2026-11-05'),'2026-11-06','hoje explícito prevalece');
eq(navigation.datedOperationKey(null,'2026-11-06'),'2026-11-06','sem URL usa contexto global');
eq(navigation.datedOperationKey('2026-02-30','2026-11-06'),'2026-11-06','data inexistente ignorada');
eq(navigation.datedOperationKey('2026-15-05','2026-11-06'),'2026-11-06','mês inválido ignorado');
eq(navigation.datedOperationKey('../../admin','2026-11-06'),'2026-11-06','valor externo não aceito');
eq(navigation.datedOperationHref('/entregas','status=concluidas&q=bacon&date=2026-11-06','2026-11-05'),'/entregas?status=concluidas&q=bacon&date=2026-11-05','troca de data preserva filtros');
eq(navigation.datedOperationHref('/rotas','filter=finalizadas','2026-11-05'),'/rotas?filter=finalizadas&date=2026-11-05','rotas no histórico com filtro preservado');
for(const [p,path] of [['app/entregas/page.tsx','/entregas'],['app/rotas/page.tsx','/rotas']]){
 const s=read(p);
 ok(s.includes('datedOperationKey(initialDate, dateKey(globalSelectedDate))'),'URL tem autoridade '+p);
 ok(s.includes(`datedOperationHref('${path}', searchParams.toString(), next)`),'troca de dia atualiza URL '+p);
 ok(s.includes('router.replace(')&&s.includes('scroll: false'),'navegação sem retorno para hoje '+p);
 ok(s.includes('setGlobalSelectedDate(operationalDateFromKey(next))'),'calendário global preservado '+p);
 ok(s.includes('datedOperationKey(initialDate, \'\') === initialDate'),'guard data inválida na sincronização '+p);
}
const home=read('app/page.tsx');
ok(home.includes('href={`/entregas?date=${encodeURIComponent(selectedDateKey)}`}'),'card de pedidos preserva dia selecionado');
ok(home.includes('href={`/rotas?date=${encodeURIComponent(selectedDateKey)}`}'),'card de rotas preserva dia selecionado');
const mais=read('app/mais/page.tsx');
ok(mais.includes('Gestão e integrações')&&mais.includes('Central de Mensageria 360°'),'Mais organizado com Mensageria 360');
ok(mais.includes("router.push('/mais/mensageria')")&&mais.includes('isDiagnosticsAdmin'),'mensageria continua admin-only');
ok(!mais.includes('Configurar na Minha Loja')&&mais.includes('Radar legado'),'atalho redundante removido sem excluir radar');
ok(mais.includes('/mais/notificacoes')&&mais.includes('/mais/diagnostico'),'ferramentas preservadas');
const picker=read('components/ui/PremiumChoicePicker.tsx');
for(const term of ['useId()', 'aria-haspopup="listbox"','role="option"','aria-selected={option.value === value}','max-h-56','onChange(option.value)','type="button"'])ok(picker.includes(term),'seletor premium '+term);
const uses={
 'components/home/DeliveryCard.tsx':2,
 'components/stock/StockPurchaseIntelligencePanel.tsx':1,
 'app/equipe/page.tsx':1,
 'app/despesas/page.tsx':1,
 'app/despesas/novo/page.tsx':1,
 'app/despesas/editar/page.tsx':1,
 'app/abastecimentos/page.tsx':1,
};
let count=0;
for(const [p,n] of Object.entries(uses)){
 const source=read(p);
 ok(!/<select\b/.test(source),'sem select nativo '+p);
 ok(source.includes('PremiumChoicePicker'),'componente controlado '+p);
 const occurrences=source.split('<PremiumChoicePicker').length-1;
 eq(occurrences,n,'número de seletores premium '+p);
 count+=n;
}
eq(count,8,'oito áreas substituídas');
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes('attemptTargetId')&&card.includes('pendingGroupedDeliveries.map(item => ({value:item.id')&&card.includes('setAttemptTargetId'),'pedido agrupado preserva ID individual');
ok(card.includes('DELIVERY_ATTEMPT_REASONS.map(item => ({value:item.value')&&card.includes('setAttemptReason(value as DeliveryAttemptReason)'),'motivo de tentativa preservado');
const st=read('components/stock/StockPurchaseIntelligencePanel.tsx');
ok(st.includes('id="r97-supplier"')&&st.includes('setSupplierKey(value)')&&st.includes('setShown(8)'),'fornecedor preserva filtro e reset da janela');
const testOld=read('scripts/test-v112-r81-interaction-attempt.cjs');
ok(testOld.includes('pendingGroupedDeliveries.map(item => ({value:item.id'),'R81 continua cobrindo seleção individual sem tag nativa');
for(const path of [...Object.keys(uses),'app/entregas/page.tsx','app/rotas/page.tsx','app/mais/page.tsx','lib/operation/dated-operation-navigation.ts','components/ui/PremiumChoicePicker.tsx'])syntax(path);
ok(read('scripts/pre-apk.cjs').includes("'scripts/test-r287-navigation-selectors.cjs'"),'R287 integra PRE-APK');
console.log(`R287 NAV + PREMIUM UI: ${total} checagens OK; nenhuma rede ou gravação externa`);
