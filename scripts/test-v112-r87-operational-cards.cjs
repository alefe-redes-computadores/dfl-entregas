#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
let passed=0;const ok=(v,name)=>{assert.ok(v,'R87: '+name);passed++;console.log('OK R87:',name)};
const f='lib/operation/operational-card-issues.ts';
const compiled=ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
ok(!compiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'helper compila');
const m={exports:{}};new Function('module','exports','require',compiled.outputText)(m,m.exports,require);
const first=m.exports.firstActionableCardIssue;
const one=(id,more={})=>({id,route_id:'r1',address_string:'Rua A, 15, Centro',fulfillment_mode:'delivery',completed:false,...more});
ok(first([one('a')],'r1')===null,'pedido completo sem pendencias');
ok(first([one('a',{route_id:''})],'r1')?.kind==='route','rota ausente');
ok(first([one('a')],'rota-resgate-recuperada')?.kind==='route','rota de recuperacao');
ok(first([one('a')],'rota-aguardando-vinculo')?.kind==='route','rota aguardando vinculo');
ok(first([one('a',{route_id:'',address_string:''})],'r1')?.kind==='route','rota antes do endereco');
ok(first([one('a',{address_string:''})],'r1')?.kind==='address','endereco vazio');
ok(first([one('a',{address_string:'  '})],'r1')?.kind==='address','endereco em branco');
ok(first([one('a',{address_string:'',customer_id:'c1'})],'r1',()=> 'Rua do Cliente, 2')===null,'endereco herdado do cliente nao gera falso erro');
ok(first([one('a',{address_string:'',customer_id:'c1'})],'r1',()=> '')?.kind==='address','endereco ausente no pedido e cliente');
ok(first([one('a'),one('b',{address_string:''})],'r1')?.deliveryId==='b','pedido irmao na parada');
ok(first([one('a',{completed:true,route_id:''})],'r1')===null,'concluido preservado');
ok(first([one('a',{fulfillment_mode:'external_delivery',route_id:'',address_string:''})],'r1')===null,'99Food externo sem rota');
ok(first([one('a',{fulfillment_mode:'pickup',route_id:'',address_string:''})],'r1')===null,'retirada sem rota');
ok(first([one('a',{completed:true,route_id:''}),one('b',{route_id:''})],'r1')?.deliveryId==='b','acao pertence ao pedido aberto');
for(const file of ['components/home/DeliveryCard.tsx',f]){
 const s=fs.readFileSync(file,'utf8'); const parsed=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,'TS/TSX '+file);
}
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
const pre=fs.readFileSync('scripts/pre-apk.cjs','utf8');
ok(card.includes('firstActionableCardIssue(groupedDeliveries, route.id, (id) => getCustomerById(id)?.address)'),'toda a parada avaliada');
ok(card.includes('href={`/entregas/editar?id=${encodeURIComponent(cardIssue.deliveryId)}${operationalDateQuery}`}'),'corrige o pedido exato');
ok(card.includes('data-no-card-swipe="true"')&&card.includes('event.stopPropagation(); impact(ImpactStyle.Light);'),'link nao ativa swipe');
ok(card.includes('role="alert" aria-label="Pendência da parada"'),'alerta acessivel');
ok(card.includes('!delivery.completed && !cardIssue && addressQuality.needsReview'),'alerta de endereco nao duplica');
ok(card.includes('relative overflow-hidden rounded-[18px] transition-colors duration-150')&&card.includes('transition-[opacity,color,transform] duration-150'),'R86 cards preservada');
for(const test of ['scripts/test-v112-r85-message-policy.cjs','scripts/test-v112-r86-form-feedback.cjs','scripts/test-v112-r87-operational-cards.cjs'])ok(pre.includes(test),'preapk contem '+test);
ok(!/\b(getDoc|getDocs|onSnapshot|collection|query)\s*\(/.test(fs.readFileSync(f,'utf8')),'zero leituras remotas');
console.log('V112 R87: '+passed+' contratos aprovados');
