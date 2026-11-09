#!/usr/bin/env node
'use strict';
/** R303: hermético. Não acessa rede, Firestore real nem WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ts=require('typescript');
let checks=0;
const ok=(v,message)=>{assert.ok(v,'R303: '+message);checks++;};
const eq=(a,b,message)=>{assert.equal(a,b,'R303: '+message);checks++;};
const read=p=>fs.readFileSync(p,'utf8');
const targets=['lib/integration/manualPickupPolicy.ts','lib/integration/server/manualPickup.ts',
'app/api/integration/manual-pickup/route.ts','lib/integration/client/manualMessagingKick.ts',
'lib/operation/detail-action-state.ts','app/entregas/details/page.tsx','app/entregas/nova/page.tsx'];
for(const p of targets){const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 eq(ast.parseDiagnostics.length,0,`AST ${p}: ${ast.parseDiagnostics[0]?.messageText||''}`);}
function load(p,stubs={},ctx={}){
 const compiled=ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exported={};vm.runInNewContext(compiled,{exports:exported,require:k=>{
 if(Object.hasOwn(stubs,k))return stubs[k];throw Error('require não autorizado '+k)},
 process:{env},console,Date,Number,String,Math,Set,Map,RegExp,URL,AbortController,setTimeout,clearTimeout,...ctx},{filename:p,timeout:3000});
 return exported;
}
const now=Date.now(),iso=n=>new Date(n).toISOString();
const a='5534999999999',b='5534988888888',c='5534977777777';
const common={DFL_MANUAL_PICKUP_ENABLED:'true',DFL_MANUAL_PICKUP_KILL_SWITCH:'false',
 DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',
 DFL_MANUAL_MESSAGING_ACTIVATED_AT:iso(now-90000),
 DFL_SITE_INTEGRATION_URL:'https://dafamilialanches.com.br',DFL_INTEGRATION_SIGNING_SECRET:'R303_TEST_SECRET'};
const env={...common,DFL_MANUAL_PICKUP_SCOPE:'canary',DFL_MANUAL_MESSAGING_SCOPE:'canary',DFL_MESSAGING_PILOT_PHONE_E164:a};
const policy=load('lib/integration/manualPickupPolicy.ts',{'./manualMessagingPolicy':{normalizeManualMessagePhone:value=>{
 const n=String(value||'').replace(/\D/g,'');return /^55[1-9]\d{9,10}$/.test(n)?n:/^[1-9]\d{9,10}$/.test(n)?'55'+n:null;
}}});
const decision=(e,number)=>policy.manualPickupRecipientAccess(e,number);
function allow(e,phone,msg){eq(decision(e,phone).allowed,true,msg)}
function deny(e,phone,expected,msg){const d=decision(e,phone);eq(d.allowed,false,msg);eq(d.reason,expected,msg+' reason')}
allow(env,a,'canary pilot');
deny(env,b,'not_pilot_phone','canary rejects other');
deny({...env,DFL_MANUAL_MESSAGING_SCOPE:'consented_customers'},a,'canary_legacy_scope_mismatch','canary keeps old scope');
const restricted={...env,DFL_MANUAL_PICKUP_SCOPE:'authorized_clients',DFL_MANUAL_MESSAGING_SCOPE:'consented_customers',
 DFL_MANUAL_PICKUP_APPROVED_PHONES_E164:a+','+b,DFL_MESSAGING_PILOT_PHONE_E164:c};
allow(restricted,a,'R38 authorized a works with legacy consented scope');
allow(restricted,b,'R38 authorized b without pilot');
deny(restricted,c,'not_authorized_phone','outsider blocked');
for(const list of ['',a+','+a,'123,'+a,Array.from({length:13},(_,i)=>'55349'+String(10000000+i)).join(',')]){
 deny({...restricted,DFL_MANUAL_PICKUP_APPROVED_PHONES_E164:list},a,'approved_list_invalid','strict list');
}
const general={...restricted,DFL_MANUAL_PICKUP_SCOPE:'consented_customers',DFL_MANUAL_PICKUP_APPROVED_PHONES_E164:undefined};
deny(general,c,'rollout_not_approved','general independent OFF');
allow({...general,DFL_MANUAL_PICKUP_ROLLOUT_APPROVED:'true'},c,'approved general');
for(const [name,value,reason] of [['DFL_MANUAL_PICKUP_ENABLED','false','pickup_disabled'],
 ['DFL_MANUAL_PICKUP_KILL_SWITCH','true','pickup_kill_switch'],
 ['DFL_MANUAL_MESSAGING_ENABLED','false','manual_messaging_disabled'],
 ['DFL_MANUAL_MESSAGING_KILL_SWITCH','true','manual_messaging_kill_switch']]){
 deny({...restricted,[name]:value},a,reason,'independent switch '+name);
}
deny({...restricted,DFL_MANUAL_PICKUP_SCOPE:'all'},a,'pickup_scope_invalid','reject wildcard scope');
const base={id:'dfl-12345678-1234-1234-1234-123456789abc',origin:'loja',fulfillment_mode:'pickup',
 phone:'34999999999',customer_name:'Cliente Consentido',notify_whatsapp:true,manual_messaging_opt_in_v1:true,
 created_at:iso(now-1000),customer_charge:31};
const plan=(x={},reason='created')=>policy.planManualPickup({delivery:{...base,...x},reason,now});
for(const [field,value] of [['notify_whatsapp',false],['manual_messaging_opt_in_v1',false],['developer_test',true],
 ['exclude_from_reports',true],['owner_order_context','owner_test'],['source_system','dfl_site'],['origin','keeta']]){
 ok(!plan({[field]:value}).eligible,'denies '+field);
}
const readyAt=iso(now-250);eq(plan({pickup_ready_at:readyAt},'ready').eventType,'order.ready','ready not completion');
ok(!plan({pickup_ready_at:readyAt},'created').eligible,'created cannot arrive after ready');
const action=load('lib/operation/detail-action-state.ts');
const stateArgs={pickup:true,ready:false,canMarkReady:true,completed:false,cancelled:false,logistics:false,
 routeAvailable:false,routeStarted:false,routeClosed:false};
const state=d=>action.detailActionState({...stateArgs,...d});
eq(state({}),'pickup_prepare','pickup only prepare');
eq(state({ready:true}),'pickup_confirm','pickup ready only confirm');
eq(state({completed:true,ready:true}),'completed','pickup completed displays final');
eq(state({canMarkReady:false}),'pickup_wait','site pending authority');
eq(state({cancelled:true}),'cancelled','cancelled always protected');
eq(state({pickup:false,logistics:true}),'route_blocked','route required');
eq(state({pickup:false,logistics:true,routeAvailable:true}),'route_blocked','route must start');
eq(state({pickup:false,logistics:true,routeAvailable:true,routeStarted:true}),'delivery_complete','started route can complete');
eq(state({pickup:false,logistics:true,routeAvailable:true,routeStarted:true,routeClosed:true}),'route_blocked','closed route cannot complete');
eq(state({pickup:false,logistics:false}),'service_complete','partner/counter continues');
const details=read('app/entregas/details/page.tsx');
ok(details.includes("actionState === 'pickup_prepare'")&&details.includes('Marcar pronto para retirada'),'pickup prepare CTA');
ok(details.includes("actionState === 'pickup_confirm'")&&details.includes('Confirmar retirada pelo cliente'),'pickup confirm CTA');
ok(details.includes("actionState === 'completed'")&&details.includes('Desfazer baixa · ação secundária'),'completion and secondary reverse');
ok(details.includes('readyLock.current')&&details.includes('completionLock.current'),'double tap refs');
ok(details.includes('aria-busy={isMarkingReady}')&&details.includes('aria-busy={isCompleting}'),'accessible progress');
ok(details.indexOf('await updateDelivery(delivery.id, { pickup_ready_at:') < details.indexOf("void kickManualPickup(delivery.id, 'ready')"),'ready write before manual notice');
ok(details.includes("if (!canMarkSitePickupReady(delivery) || isMarkingReady) return;")&&details.includes('sitePickup'), 'Site ready authority unchanged');
ok(details.includes("if (mode === 'pickup' && !delivery.pickup_ready_at)"),'completion requires readiness');
ok(details.includes("if (logistics) {")&&details.includes("if (!routeStartedAt(route))"),'route still guarded');
ok(details.includes('setIsIfoodModalOpen(true)')&&details.includes('executeCompletion(inputCode)'),'iFood code preserved');
ok(details.includes("router.replace('/');")&&details.includes('paymentConfirmed'),'existing completion and finance preserved');
const serverSource=read('lib/integration/server/manualPickup.ts');
ok(!serverSource.includes('plan.phone !== process.env.DFL_MESSAGING_PILOT_PHONE_E164'),'old global pilot restriction removed');
ok(serverSource.includes("DFL_MANUAL_PICKUP_SCOPE === 'canary'")&&serverSource.includes('manualPickupRecipientAccess(process.env,plan.phone)'),'R301 + R38 wired');
ok(serverSource.includes(".collection('manual_pickup_events_v2').doc(")&&serverSource.includes('await ledgerRef.create('),'durable reservation');
ok(serverSource.includes('createHmac')&&serverSource.includes('network_unknown'),'HMAC + unknown state');
const clientSource=read('lib/integration/client/manualMessagingKick.ts');
ok(clientSource.includes("reason:'response_uncertain'")&&clientSource.includes('manualPickupResultDescription'),'no retry on timeout; explicit uncertainty');
const legacy=read('lib/integration/server/manualMessaging.ts'),nextStop=read('lib/integration/server/manualNextStop.ts');
ok(legacy.length>1000&&nextStop.length>1000,'legacy and next stop still present');
const pre=read('scripts/pre-apk.cjs');ok(pre.includes("'scripts/test-r303-site-r38-premium.cjs'"),'new contracts in pre-apk');
console.log(`R303 PREMIUM: ${checks} verificações locais de escopos, consentimento, segurança, UI e regressões aprovadas. ZERO rede.`);
