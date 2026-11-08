#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const crypto=require('node:crypto');
let checks=0;
function ok(condition,why){assert.ok(condition,'R299 P6: '+why);checks++;}
function eq(actual,expected,why){assert.equal(actual,expected,'R299 P6: '+why);checks++;}
const read=p=>fs.readFileSync(p,'utf8');
const parse=p=>{const s=read(p);const ast=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'AST '+p);return s;};
const targets=['lib/integration/site-guest-identity.ts','lib/operation/site-review-hints.ts','lib/integration/server/siteOrderPersistence.ts','app/loja/page.tsx','store/useAppStore.ts','components/store/SiteInboxPanel.tsx'];
const sources=Object.fromEntries(targets.map(p=>[p,parse(p)]));
function load(p,dependencies={}){
 const src=read(p);const transpiled=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 ok(!transpiled.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'transpile '+p);
 const m={exports:{}};
 new Function('require','module','exports',transpiled.outputText)((id)=>{if(Object.hasOwn(dependencies,id))return dependencies[id];throw Error('dependência não permitida no teste: '+id)},m,m.exports);
 return m.exports;
}
const identity=load('lib/integration/site-guest-identity.ts');
const review=load('lib/operation/site-review-hints.ts',{'@/lib/integration/site-guest-identity':identity});
const good={name:'Maria da Silva',phone:'(34) 99123-4567',street:'Rua Dezesseis',number:'125',district:'Jardim Quebec',complement:'Casa 2'};
const key=identity.siteGuestIdentityEvidence(good);
ok(typeof key==='string'&&key.includes('v2'),'identidade formada com evidência forte');
eq(identity.siteGuestIdentityEvidence({...good,name:'MARIA DA SILVA',phone:'+55 34 99123-4567'}),key,'normaliza nome e E.164');
eq(identity.siteGuestIdentityEvidence({...good,street:'R. Dezesseis'}),key,'normaliza Rua e R.');
for(const [mutated,label] of [
 [{...good,name:'Maria de Souza'},'famílias com nome distinto'],
 [{...good,phone:'(34) 98888-8888'},'telefones diferentes'],
 [{...good,number:'126'},'número vizinho'],
 [{...good,complement:'Casa 3'},'complemento diferente'],
 [{...good,district:'Jardim Alvorada'},'bairro diferente']
])ok(identity.siteGuestIdentityEvidence(mutated)!==key,'não mescla '+label);
for(const [mutated,label] of [
 [{...good,name:'Maria'},'nome incompleto'],
 [{...good,phone:'0'},'telefone inválido'],
 [{...good,number:'0'},'número zero'],
 [{...good,number:''},'número ausente'],
 [{...good,street:''},'rua ausente'],
 [{...good,district:''},'bairro ausente'],
 [{...good,name:'Cliente do Site'},'nome genérico']
])eq(identity.siteGuestIdentityEvidence(mutated),null,'não inventa identidade com '+label);
const inputCustomer={name:'Maria da Silva',phone:'(34) 99123-4567',address:'Rua Dezesseis, 125 - Jardim Quebec - Casa 2'};
ok(identity.siteCustomerExistingEvidenceMatch(inputCustomer,{...inputCustomer,phone:'+55 34 99123-4567'}),'vínculo existente completo');
ok(!identity.siteCustomerExistingEvidenceMatch(inputCustomer,{...inputCustomer,name:'Ana da Silva'}),'telefone comum não mescla homônimos familiares');
ok(!identity.siteCustomerExistingEvidenceMatch(inputCustomer,{...inputCustomer,address:'Rua Dezesseis, 125 - Jardim Quebec - Casa 3'}),'complemento diferente não mescla');
ok(!identity.siteCustomerExistingEvidenceMatch(inputCustomer,{...inputCustomer,address:''}),'endereço ausente não mescla');
const hash=crypto.createHash('sha256').update(key).digest('hex');
eq(hash.length,64,'documento derivado de SHA256 inteiro');ok(!hash.includes('maria')&&!hash.includes('99123'),'ID não revela nome ou telefone');
const server=sources['lib/integration/server/siteOrderPersistence.ts'];
for(const piece of ["import 'server-only'", "createHash('sha256').update(siteEvidence).digest('hex')", "siteCustomerExistingEvidenceMatch(byPhone", "siteCustomerExistingEvidenceMatch(customer", "const deterministicCustomerSnap", "tx.create(customerRef", "tx.create(deliveryRef", "siteGuestCustomerId(event.payload.orderId)"]){ok(server.includes(piece),'guarda de transação '+piece)}
ok(server.indexOf('const deterministicCustomerSnap')<server.indexOf('tx.create(customerRef'),'transação faz todas leituras antes de escritas');
ok(!server.includes('site-combo-v3-dispatch-simulation'),'receptor real não depende do laboratório');
const normal={phone:'+55 (34) 99123-4567',address_string:'Rua A, 123',customer_charge:42,value:42,payment_method:'pix',created_at:'2026-11-07T19:00:00-03:00'};
eq(review.siteReviewHints(normal).length,0,'cadastro válido sem alerta artificial');
ok(review.siteReviewHints({...normal,phone:'123'}).some(x=>x.key==='phone'),'telefone inválido pede conferência');
ok(review.siteReviewHints({...normal,address_string:'Rua A, 0'}).some(x=>x.key==='address'),'número zero pede conferência');
ok(review.siteReviewHints({...normal,phone:'',address_string:'Rua A, 0',payment_method:'dinheiro',customer_charge:600,created_at:'2026-11-07T23:30:00-03:00'}).some(x=>x.key==='late-cash'),'caso alto/noite/cadastro incompleto: revisar, nunca condenar');
ok(!review.siteReviewHints({...normal,payment_method:'dinheiro',customer_charge:600,created_at:'2026-11-07T23:30:00-03:00'}).some(x=>x.key==='late-cash'),'valor alto sozinho não é problema');
const target='2026-11-08T20:00:00-03:00',now=Date.parse('2026-11-08T19:25:00-03:00');
eq(review.sitePreparationReminder({scheduled_for:target,completed:false},now,15),null,'janela de 15 minutos ainda não avisa');
eq(review.sitePreparationReminder({scheduled_for:target,completed:false},now,30),null,'janela 30 minutos respeitada');
ok(review.sitePreparationReminder({scheduled_for:target,completed:false},now,60)?.label.includes('35 min'),'janela de 60 minutos avisa');
eq(review.sitePreparationReminder({scheduled_for:target,completed:true},now,60),null,'concluídos não avisam');
eq(review.sitePreparationReminder({scheduled_for:'invalido',completed:false},now,60),null,'data inválida não inventa horário');
const panel=sources['components/store/SiteInboxPanel.tsx'],loja=sources['app/loja/page.tsx'],store=sources['store/useAppStore.ts'],pre=read('scripts/pre-apk.cjs');
for(const p of ['siteReviewHints(delivery)','sitePreparationReminder(delivery,clock,sitePreparationLeadMinutes)','Outras ações · conciliar ou arquivar','Mostrar ID completo','site_order_timeline','Conferir dados','allocate(delivery.id','archiveSiteDelivery(archiveId,reason)'])ok(panel.includes(p),'Caixa preserva '+p);
ok(panel.indexOf('Outras ações · conciliar ou arquivar')<panel.lastIndexOf("onClick={()=>requestArchive(delivery,'manual')}") ,'ações secundárias dentro de menu');
ok(loja.includes('Agendados · lembrar preparação')&&loja.includes('saveQuickPreference({sitePreparationLeadMinutes:minutes})'),'Loja persiste 15/30/60');
ok(store.includes('sitePreparationLeadMinutes?: 15 | 30 | 60;'),'preferência tipada');
ok(!/\b(?:getDocs|onSnapshot|collection|runTransaction|updateDoc)\s*\(/.test(sources['lib/operation/site-review-hints.ts']+sources['lib/integration/site-guest-identity.ts']),'helpers puros');
ok(pre.includes("'scripts/test-r299-integridade-site-p6.cjs'"),'P6 obrigatória no PRE-APK');
for(const file of ['test-r299-core-p1.cjs','test-r299-clientes-p2.cjs','test-r299-parser-p3.cjs','test-r299-relatorios-p4.cjs','test-r299-fechamento-p5.cjs'])ok(pre.includes(file),'P1–P5 preservadas: '+file);
console.log(`R299 P6: ${checks} verificações herméticas / estáticas aprovadas. Sem Firestore, WhatsApp ou rede real.`);
