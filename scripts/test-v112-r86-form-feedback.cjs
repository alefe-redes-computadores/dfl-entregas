#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const Module=require('node:module');
const read=p=>fs.readFileSync(p,'utf8');
let count=0;
const ok=(yes,name)=>{assert(yes,`R86: ${name}`);count++;console.log('OK R86:',name)};
const helper=read('lib/operation/delivery-form-feedback.ts');
const mod={exports:{}};
const compiled=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
new Function('module','exports','require',compiled)(mod,mod.exports,require);
const {firstRequiredDeliveryIssue:first,focusDeliveryIssue:focus}=mod.exports;
const base={fulfillmentMode:'delivery',routeId:'r1',address:'Rua A, 20 - Centro',value:'30,00'};
ok(first({...base,routeId:'',address:'',value:''}).field==='route','rota tem prioridade sobre rua e valor');
ok(first({...base,routeId:'',address:'Rua A, 20',value:'35,00'}).message==='Selecione a rota responsável pela entrega.','não acusa endereço quando falta apenas rota');
ok(first({...base,address:'',value:''}).field==='address','endereço é o próximo erro real');
ok(first({...base,value:''}).field==='value','valor é o próximo erro real');
ok(first({...base,fulfillmentMode:'external_delivery',routeId:'',address:'',value:'25,00'})===null,'99Food / terceiros não exige rota DFL');
ok(first({...base,fulfillmentMode:'pickup',routeId:'',address:'',value:''}).field==='value','retirada exige somente valor');
ok(first({...base})===null,'cadastro completo não é bloqueado');
ok(typeof focus==='function','foco reutilizável instalado');
for(const path of ['app/entregas/nova/page.tsx','app/entregas/editar/page.tsx','components/home/DeliveryCard.tsx','components/home/RouteAccordion.tsx']){
  const s=read(path);
  const ast=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(ast.parseDiagnostics.length===0,`JSX/TSX válido: ${path}`);
}
for(const path of ['app/entregas/nova/page.tsx','app/entregas/editar/page.tsx']){
 const s=read(path);
 ok(s.includes('firstRequiredDeliveryIssue({')&&s.includes('showFormIssue(requiredIssue.field, requiredIssue.message)'),`erro por campo em ${path}`);
 ok(s.includes('id="dfl-delivery-route"')&&s.includes('aria-invalid={formIssue?.field === \'route\'}'),`rota ancorada e acessível ${path}`);
 ok(s.includes('id="dfl-delivery-address"')&&s.includes('id="dfl-delivery-value"'),`destino/valor com foco real ${path}`);
 ok(s.includes('bg-red-500/[.105]')&&s.includes('role="alert"'),`alerta vermelho contextual ${path}`);
 ok(s.includes('Capacitor.isNativePlatform()')&&s.includes('ImpactStyle.Light'),`haptico leve sem regressão ${path}`);
 ok(!s.includes('Preencha os campos obrigatórios (Rota, Valor e Rua)'),`texto genérico removido ${path}`);
}
const card=read('components/home/DeliveryCard.tsx'),route=read('components/home/RouteAccordion.tsx');
ok(card.includes('relative overflow-hidden rounded-[18px] transition-colors duration-150'),'card entrega não anima layout');
ok(card.includes('transition-[opacity,color,transform] duration-150'),'swipe leve preservado');
ok(route.includes('overflow-hidden rounded-[20px] border transition-colors duration-150 relative'),'card rota não anima layout');
const feedback=read('lib/operational-toast.ts');
ok(feedback.includes('NotificationType.Error')&&feedback.includes('Capacitor.isNativePlatform()'),'notificação de erro só nativo, sem vibração duplicada');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes('scripts/test-v112-r86-form-feedback.cjs'),'R86 está no pré-APK');
ok(pre.includes('scripts/test-v112-r85-message-policy.cjs'),'R85 preservada');
console.log(`V112 R86 ERROS & CARDS: ${count} verificações aprovadas`);
