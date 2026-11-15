'use strict';
/** Hermetic R74 P2: never accesses Firebase, WhatsApp or network. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let checks=0;const check=(v,desc)=>{assert.ok(v,'R74 P2 '+desc);checks++};
const equal=(a,b,desc)=>{assert.equal(a,b,'R74 P2 '+desc);checks++};
const read=p=>fs.readFileSync(p,'utf8');
function pure(path){
 const source=read(path);
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 equal(ast.parseDiagnostics.length,0,`AST ${path}`);
 const compiled=ts.transpileModule(source,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const mod={exports:{}};
 new Function('require','module','exports',compiled.outputText)(id=>{throw Error('PURE_IMPORT_FORBIDDEN:'+id)},mod,mod.exports);
 return mod.exports;
}
const core=pure('lib/tracking/gate1/core.ts');
const policy=pure('lib/integration/manualMessagingPolicy.ts');
const now=Date.now(),time=n=>new Date(now+n).toISOString();
const raw={id:'dfl-12345678-1234-1234-1234-123456789abc',origin:'loja',source_system:'dfl_entregas',
  phone:'(34) 99999-9999',customer_name:'Cliente de teste',created_at:time(-5000),
  logistics_provider:'dfl',notify_whatsapp:true,manual_messaging_opt_in_v1:true,
  fulfillment_mode:'delivery',completed:false};
const commercial=(d)=>core.mayIssueNewTrackingGrant({...raw,...d});
const created=(d)=>policy.planManualMessage({delivery:{...raw,...d},reason:'created',now});
for(const origin of ['ifood','food99','keeta']){
 const yes={origin};
 check(core.r74MarketplaceConsent({...raw,...yes}),origin+' consented DFL courier');
 check(commercial(yes),origin+' tracking grant');
 check(created(yes).eligible,origin+' message');
 for(const no of [
   {notify_whatsapp:false},{manual_messaging_opt_in_v1:false},
   {fulfillment_mode:'external_delivery',logistics_provider:origin},
   {logistics_provider:origin},{source_system:'dfl_site'},
   {external_order_id:'site_123'},{developer_test:true},
   {exclude_from_reports:true},{owner_order_context:'owner_test'},
   {operational_dismissed_at:time(-2000)},
 ]){
   check(!commercial({...yes,...no}),origin+' tracking fail closed '+Object.keys(no)[0]);
   check(!created({...yes,...no}).eligible,origin+' message fail closed '+Object.keys(no)[0]);
 }
 check(!commercial({...yes,completed:true}),origin+' no terminal link');
 check(!commercial({...yes,site_order_status:'Cancelado'}),origin+' no cancelled link');
 check(!created({...yes,phone:''}).eligible,origin+' invalid contact');
 check(!created({...yes,created_at:time(-3600_000)}).eligible,origin+' no old event');
 check(!created({...yes,fulfillment_mode:'pickup'}).eligible,origin+' no platform pickup');
}
check(commercial({origin:'loja'}),'legacy shop link preserved');
check(created({origin:'loja'}).eligible,'legacy shop messaging preserved');
check(commercial({origin:'loja',source_system:'dfl_site'}),'Site tracking preserved');
check(!created({origin:'loja',source_system:'dfl_site'}).eligible,'Site not duplicated in manual messaging');
const form=read('app/entregas/nova/page.tsx');
const edit=read('app/entregas/editar/page.tsx');
const tracking=read('lib/tracking/manualTrackingAuto.ts');
const storage=read('lib/tracking/gate1/storage.ts');
const access=read('lib/tracking/gate1/http.ts');
const ready=read('lib/tracking/gate1/readiness.ts');
const panel=read('app/mais/acompanhamento/page.tsx');
for(const [src,msg] of [[form,'new form'],[edit,'edit form']]){
 check(src.includes('manual_messaging_opt_in_v1'),msg+' explicit consent persisted');
 check(src.includes('notify_whatsapp'),msg+' actual optin');
}
check(form.includes('drafts.length===1&&draft.notifyWhatsapp'),'iFood batch never inherits consent');
const persisted=/notify_whatsapp:([^,]+),manual_messaging_opt_in_v1:([^,]+),observation:/.exec(form);
check(Boolean(persisted),'R48 consent flags persist from each draft');
const allowed=new Function('drafts','draft','return Boolean('+persisted[1]+')');
const confirmed=new Function('drafts','draft','fulfillmentMode','return Boolean('+persisted[2]+')');
for(const n of [1,2,3,8]){
  const drafts=Array.from({length:n},(_,i)=>({id:'order-'+i,notifyWhatsapp:i===0}));
  equal(allowed(drafts,drafts[0]),n===1,'R48 batch opt-in isolated '+n);
  equal(confirmed(drafts,drafts[0],'delivery'),n===1,'R48 batch consent isolated '+n);
  equal(allowed(drafts,{notifyWhatsapp:false}),false,'R48 disabled recipient remains disabled '+n);
  equal(confirmed(drafts,drafts[0],'external_delivery'),false,'R48 partner courier never inherits consent '+n);
}
check(form.includes("(origin !== 'ifood' || extraIfoodOrders.length === 0)"),'R48 multi iFood cannot request WhatsApp');
check(form.includes('confirmedWhatsappRecipient === consentRecipientKey'),'R48 exact recipient proof retained');
check(form.includes("setConfirmedWhatsappRecipient(event.target.checked ? consentRecipientKey : '')"),'R48 consent requires explicit click');

check(form.includes('orderId.trim()') && form.includes('consentRecipientKey'),'new marketplace consent tied to order reference');
check(form.includes('Pedidos iFood em lote:'),'batch restriction visible');
check(edit.includes('r74ConsentConfirmed'),'edit does not infer consent from phone');
check(edit.includes('currentR74ConsentKey'),'edit binds consent to current recipient');
check(edit.includes('orderId.trim()') && edit.includes('deliveryId||'), 'edit consent tied to commercial and operational order identity');
check(tracking.includes("origin_capability_not_certified"),'per-origin certified capability');
check(tracking.includes("state:'reserved'") && tracking.includes('issued_pending_provider'),'single-use reservation protected');
check(!/console\.|localStorage|sessionStorage/.test(tracking),'no secret persistence or logging');
check(storage.includes("x === 'keeta'"),'Keeta capability explicitly supported');
check(storage.includes("if (d.origin === 'keeta') return 'keeta'"),'Keeta origin preserved in authorization');
check(access.includes("'ifood','food99','keeta'"),'owner issue allowlist includes Keeta');
check(access.includes('v.requested_ttl_minutes !== 90'),'marketplace owner link TTL pinned to 90 minutes');
check(ready.includes('r74MarketplaceConsent(d)'),'readiness requires proven consent');
check(panel.includes("['site','manual','ifood','food99','keeta'].includes"),'owner UI conditional links');
check(panel.includes('Emitir link privado (90 min)'),'90 minute manual access preserved');
check(read('scripts/pre-apk.cjs').includes('scripts/test-r74-p2-consented-origins.cjs'),'R74 test in PRE-APK');
// FIX2: execute real Keeta batch-audit behavior in the projected preflight.
const batch=pure('lib/tracking/gate3/batch-audit.ts');
const fixture={
  delivery:{origin:'keeta',state:'assigned',canonical_order_key:'entregas:fixture',public_label:'Pedido',fulfillment:'delivery'},
  readiness:{level:'ready_for_internal_review',last_confirmed_at:time(-5000),signals:[]},events:[],
};
const row=batch.auditRow('keeta-fixture',fixture);
equal(row.origin,'keeta','Keeta included in owner audit');
const summary=batch.summarizeAudit([row]);
equal(summary.by_origin.keeta,1,'Keeta counted exactly once');
equal(summary.by_origin.unknown,0,'Keeta not hidden as unknown');
check(batch.auditReportText(summary).includes('Keeta 1'),'Keeta reported without personal data');
check(!batch.auditReportText(summary).includes('keeta-fixture'),'audit text excludes private order identifier');
check(!batch.validAuditIds(['bad/id']),'audit ID validation unchanged');
console.log(`R74 P2: ${checks} contracts, consent/origins/privacy/idempotency/auditoria Keeta OK (no network/Firestore/WhatsApp).`);
