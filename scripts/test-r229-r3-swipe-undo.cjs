#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
let count=0;
function ok(value,message){assert.ok(value,'R229-R3: '+message);console.log('R229-R3 OK:',message);count++}
const name='lib/operation/swipe-stop-eligibility.ts';
const source=read(name);
const syntax=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
ok(syntax.parseDiagnostics.length===0,'política de gesto TypeScript sem erro');
ok(!/firestore|fetch\(|await\s|runTransaction|setDoc/.test(source),'política do gesto não escreve no servidor');
const output=ts.transpileModule(source,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};
vm.runInNewContext(output,{module:mod,exports:mod.exports,Number},{filename:name,timeout:1500});
const can=mod.exports.canSwipeCompleteOrUndo;
ok(typeof can==='function','política exportada');
for(const [pending,done,expected,label] of [
 [1,0,true,'pendente permite baixa'],
 [2,0,true,'parada multipedido permite baixa'],
 [0,1,true,'concluído permite desfazer baixa'],
 [0,3,true,'parada agrupada concluída permite desfazer'],
 [1,1,true,'parada mista continua operável'],
 [0,0,false,'sem pedido não tenta baixa'],
 [-1,0,false,'contagem inválida bloqueada'],
 [0,Number.NaN,false,'NaN bloqueado'],
])ok(can(pending,done)===expected,label);
const card=read('components/home/DeliveryCard.tsx');
ok(card.includes("import { canSwipeCompleteOrUndo } from '@/lib/operation/swipe-stop-eligibility';"),'card usa a política testada');
ok(card.includes('canSwipeCompleteOrUndo(groupedPending, groupedDeliveries.filter(item => item.completed).length)'),'status real da parada determina elegibilidade');
ok(card.includes("if (dx < 0 && swipeCanCompleteOrUndo) void handleTriggerAction('complete');"),'arrasto à esquerda usa handler protegido da baixa/desfazer');
ok(card.includes("if (dx > 0) void handleTriggerAction('expand');"),'arrasto à direita continua expandindo');
ok(card.includes('Math.abs(dx) < 88 || Math.abs(dx) <= Math.abs(dy) * 1.5'),'gestos curtos e verticais não confirmam ação');
ok(card.includes("target.closest('button, a, input, textarea, select, [data-no-card-swipe=\"true\"]')"),'gesto não intercepta toque em botões ou campos');
ok(card.includes("stopCompleted ? 'Desfazer Baixa' : 'Dar Baixa'"),'legenda visual diferencia baixa de desfazer');
ok(card.includes('Reabra a rota antes de desfazer esta baixa.')&&card.includes('await updateDelivery(delivery.id, { completed: false })'),'rota fechada protegida e desfazer persiste no handler existente');
ok(card.includes('completionBusyRef.current'),'conclusão conserva bloqueio de concorrência');
for(const path of ['scripts/verify-v103-mobile-cards.cjs','scripts/verify-v111-r14-operation-premium.cjs','scripts/test-v112-r90-home-card-performance.cjs']) {
 const code=read(path);
 ok(!code.includes('wasComplete'),'regressão '+path+' não exige o antigo bloqueio de desfazer');
 ok(code.includes('swipeCanCompleteOrUndo')||code.includes('canSwipeCompleteOrUndo'),'regressão '+path+' verifica nova elegibilidade');
}
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r229-r3-swipe-undo.cjs'")&&pre.includes("'scripts/test-r229-operational-performance.cjs'"),'PRE-APK cobre R229 e novo gesto');
console.log(`R229-R3 GESTO DESFAZER: ${count} verificações aprovadas`);
