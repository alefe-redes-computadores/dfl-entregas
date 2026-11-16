#!/usr/bin/env node
'use strict';
/** Hermetic R75 P2: no Firebase, network, WhatsApp or patient/customer data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;const ok=(value,label)=>{assert.ok(value,'R75 P2 '+label);checks++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,'R75 P2 '+label);checks++;};
const policyPath='lib/integration/r75RecoveryPolicy.ts';
const cardPath='components/messaging/R75RecoveryAssistCard.tsx';
const pagePath='app/mais/mensageria/page.tsx';
for(const file of [policyPath,cardPath,pagePath,'scripts/pre-apk.cjs']){
  const code=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  ok(ast.parseDiagnostics.length===0,'AST '+file);
}
const src=fs.readFileSync(policyPath,'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',js)(()=>({}),mod,mod.exports);
const p=mod.exports;
const id='dfl-12345678-1234-1234-1234-123456789abc', now=Date.parse('2026-11-15T23:00:00.000Z');
const base={id,origin:'loja',source_system:'manual',external_order_id:null,fulfillment_mode:'pickup',notify_whatsapp:true,manual_messaging_opt_in_v1:true,phone:'34999112233',completed:false};
const rec=(eventType='order.ready',state='dead_letter',fingerprint='a'.repeat(16))=>({eventType,state,fingerprint,createdAt:new Date(now-60_000).toISOString(),sentAt:null,providerAccepted:false,failureCode:'R33_PROVIDER_OR_STATE_UNCERTAIN_REVIEW'});
const audit={status:'ok',checkedAt:new Date(now-60_000).toISOString(),records:[rec()],sampleLimited:false,customerDeliveryVerified:false};
const review=(a=audit,d=base,selected=id,audited=id,clock=now)=>p.r75RecoveryReview(a,d,selected,audited,clock);
eq(review().reason,'ready','one dead letter reviewed');eq(review().cases.length,1,'one candidate');
ok(review().cases[0].text.includes('confirmação')===false,'no misleading delivery confirmation');
for(const sensitive of ['34999112233','dfl-12345678','http','https','token','pronto para retirar','a caminho'])ok(!review().cases[0].text.toLowerCase().includes(sensitive.toLowerCase()),'neutral copied message excludes '+sensitive);
for(const [label,record,reason] of [
 ['different selected',null,'other_order'],
]){void label;void record;void reason;}
eq(review(audit,base,'dfl-other').reason,'other_order','order binding');
eq(review(audit,base,id,'dfl-other').reason,'other_order','audit binding');
eq(review({...audit,status:'unavailable'}).reason,'audit_unavailable','unavailable blocks');
eq(review({...audit,checkedAt:new Date(now-181_000).toISOString()}).reason,'audit_stale','stale blocks');
eq(review({...audit,checkedAt:new Date(now+31_000).toISOString()}).reason,'audit_stale','future audit blocks');
eq(review({...audit,sampleLimited:true}).reason,'audit_limited','partial history blocks');
eq(review(audit,{...base,origin:'ifood'}).reason,'not_manual','marketplace blocked');
eq(review(audit,{...base,source_system:'dfl_site'}).reason,'not_manual','site blocked');
eq(review(audit,{...base,external_order_id:'abc'}).reason,'not_manual','external order blocked');
eq(review(audit,{...base,notify_whatsapp:false}).reason,'no_consent','notification preference blocked');
eq(review(audit,{...base,manual_messaging_opt_in_v1:false}).reason,'no_consent','opt-in blocked');
eq(review(audit,{...base,phone:''}).reason,'no_contact','missing contact blocked');
eq(review(audit,{...base,completed:true}).reason,'not_active','completed blocked');
eq(review(audit,{...base,operational_dismissed_at:'2026-11-15T00:00:00Z'}).reason,'not_active','dismissed blocked');
eq(review({...audit,records:[rec('order.created','sent')]}).reason,'no_reviewable_events','sent blocks');
eq(review({...audit,records:[rec('order.created','pending')]}).reason,'no_reviewable_events','pending blocks');
eq(review({...audit,records:[rec('order.created','processing')]}).reason,'no_reviewable_events','processing blocks');
eq(review({...audit,records:[rec('order.created','suppressed')]}).reason,'no_reviewable_events','suppressed blocks');
eq(review({...audit,records:[rec('order.ready','dead_letter'),rec('order.ready','sent','b'.repeat(16))]}).reason,'no_reviewable_events','sent counterpart blocks');
eq(review({...audit,records:[rec('order.ready','dead_letter'),rec('order.ready','dead_letter','b'.repeat(16))]}).reason,'no_reviewable_events','ambiguous duplicate blocks');
eq(review({...audit,records:[{...rec(),providerAccepted:true}]}).reason,'no_reviewable_events','provider accepted blocks');
eq(review({...audit,records:[rec('order.ready','dead_letter')]},{...base,fulfillment_mode:'delivery'}).reason,'no_reviewable_events','pickup ready not delivery');
eq(review({...audit,records:[rec('delivery.started','failed')]},{...base,fulfillment_mode:'pickup'}).reason,'no_reviewable_events','route not pickup');
eq(review({...audit,records:[rec('order.created','failed')]},{...base,fulfillment_mode:'delivery'}).reason,'ready','failed allows manual assistance only');
const card=fs.readFileSync(cardPath,'utf8'),page=fs.readFileSync(pagePath,'utf8');
for(const item of ['customerChecked','uncertaintyAcknowledged','navigator.clipboard.writeText','r75RecoveryReview','r75RecoveryReason','review.allowed','auditedDeliveryId'])ok(card.includes(item),'card guard '+item);
for(const bad of ['sendWhatsApp','kickManualPickup','kickManualCreated','issueGrant','sendTracking','window.open','fetch(','wa.me','onSubmit='])ok(!card.includes(bad),'card no dispatch '+bad);
for(const item of ['R75RecoveryAssistCard','auditedDeliveryId','<MessagingOrderPicker deliveries={deliveries} selectedId={deliveryId} onSelect={setDeliveryId}','<R75ProviderAuditCard'])ok(page.includes(item),'legacy and binding '+item);
ok(fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r75-p2-recovery.cjs'"),'PRE-APK registered');
console.log(`R75 P2 RECUPERACAO ASSISTIDA: ${checks} contratos hermeticos OK; nenhuma rede, reenvio ou token novo.`);
