#!/usr/bin/env node
'use strict';
/** R75 P1: policy behavior and static no-dispatch contracts. No real HTTP or messages. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let n=0;const ok=(p,label)=>{assert.ok(p,'R75 ENT '+label);n++};
const paths=['lib/integration/messagingAuditPolicyR75.ts','lib/integration/server/r75MessagingAudit.ts','components/messaging/R75ProviderAuditCard.tsx','app/api/integration/messaging-diagnostics/route.ts','app/mais/mensageria/page.tsx'];
for(const p of paths){const code=fs.readFileSync(p,'utf8');ok(ts.createSourceFile(p,code,ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS).parseDiagnostics.length===0,'AST '+p)}
const path=paths[0];const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);const p=mod.exports;
const deliveryId='dfl-12345678-1234-1234-1234-123456789abc';
const iso='2026-11-15T23:01:00.000Z';
const row={eventType:'order.created',state:'dead_letter',fingerprint:'d'.repeat(16),createdAt:iso,sentAt:null,providerAccepted:false,failureCode:'R33_PROVIDER_OR_STATE_UNCERTAIN_REVIEW'};
const sample={contract:'dfl.messaging.audit.v1',version:1,ok:true,source:'manual',orderId:`entregas:${deliveryId}`,eventType:'all',checkedAt:iso,records:[row],sampleLimited:false,customerDeliveryVerified:false};
ok(p.r75ValidAuditEnvelope(sample,deliveryId),'valid sanitized record');
for(const x of [{...sample,customer_phone:'5534999999999'},{...sample,records:[{...row,providerMessageId:'secret'}]},{...sample,records:[{...row,fingerprint:'raw-id'}]},{...sample,source:'site'},{...sample,customerDeliveryVerified:true},{...sample,orderId:'entregas:dfl-other'}, {...sample,records:Array.from({length:25},()=>row)}])ok(!p.r75ValidAuditEnvelope(x,deliveryId),'unsafe or mismatched response rejected');
const labels=[['sent',false],['pending',false],['processing',false],['dead_letter',true],['failed',true],['unknown',true]];
for(const [state,review] of labels)ok(p.r75AuditDisposition({...row,state}).requiresReview===review,'state '+state+' review policy');
ok(p.r75AuditDisposition(row).note.includes('Sem reenvio automático'),'dead letter no auto replay');
const bridge=fs.readFileSync(paths[1],'utf8'),api=fs.readFileSync(paths[3],'utf8'),page=fs.readFileSync(paths[4],'utf8'),card=fs.readFileSync(paths[2],'utf8');
for(const marker of ["allowHosts", "createHmac('sha256'", "r75ValidAuditEnvelope(parsed, deliveryId)", "AbortSignal.timeout(8000)","redirect: 'error'"])ok(bridge.includes(marker),'HMAC bridge '+marker);
for(const marker of ['isSuperadminUid(decoded.uid)','readManualProviderAudit(rawId)','providerAudit,','adminDb.collection(\'deliveries\')'])ok(api.includes(marker),'API owner '+marker);
ok(api.indexOf('isSuperadminUid(decoded.uid)')<api.indexOf('readManualProviderAudit(rawId)'),'Firebase owner check precedes upstream');
ok(api.indexOf("if (deliverySnap.exists)")<api.indexOf('readManualProviderAudit(rawId)'),'delivery existence before audit');
for(const marker of ['<R75ProviderAuditCard','setData(null)','Fila WhatsApp'])ok((marker==='Fila WhatsApp'?card:page).includes(marker),'UI '+marker);
for(const file of [bridge,api,card]){const withoutHmac=file.replace(/createHmac\('sha256', secret\)\.update\([^;]+;/g,'');ok(!/\.update\(|\.set\(|\.delete\(|\.insert\(|\.upsert\(|sendWhatsApp\(|issueGrant\(/.test(withoutHmac),'no DB/messaging writes');}
ok(!/onClick=|onSubmit=|useEffect|fetch\(/.test(card),'display card read-only');
ok(fs.readFileSync('scripts/pre-apk.cjs','utf8').includes("'scripts/test-r75-p1-messaging-audit.cjs'"),'PRE-APK registered');
console.log(`R75 ENT P1: ${n} verificações herméticas; estados, privacidade e zero reenvios OK`);
