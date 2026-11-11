'use strict';
/** R265 hermetic: owner-only handoff contract; zero network/Firebase/WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let tests=0;
const ok=(v,label)=>{assert.ok(v,label);tests++};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);tests++};
const load=name=>{
 const source=fs.readFileSync(name,'utf8');
 const js=ts.transpileModule(source,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',js)((id)=>{throw Error('Unexpected import: '+id)},mod,mod.exports);
 return mod.exports;
};
const core=load('lib/tracking/gate1/core.ts');
const base={id:'realOrderForUnitTest',source_system:'dfl_site',origin:'loja',site_order_status:'Em Produção',fulfillment_mode:'delivery',completed:false};
for(const [name,d,want] of [
 ['site active',base,true],['manual active',{...base,source_system:'dfl_entregas'},true],
 ['pickup',{...base,fulfillment_mode:'pickup'},true],
 ['already delivered',{...base,completed:true},false],
 ['cancelled status',{...base,site_order_status:'Cancelado'},false],
 ['dismissed',{...base,operational_dismissed_at:'2026-11-05T14:00:00.000Z'},false],
 ['ifood',{...base,origin:'ifood'},false],
 ['99food',{...base,origin:'food99'},false],
 ['counter',{...base,fulfillment_mode:'counter'},false],
 ['external',{...base,fulfillment_mode:'external_delivery'},false],
 ])eq(core.mayIssueNewTrackingGrant(d),want,name);
const at=new Date(Date.now()-60000).toISOString();
const pickupDelivery={...base,fulfillment_mode:'pickup',route_id:'route1',created_at:at};
const pickupRoute={id:'route1',started_at:at,motoboy_name:'Motorista Teste',status:'aberta'};
const projection=core.projectPublicTracking({delivery:pickupDelivery,route:pickupRoute,routeDeliveries:[pickupDelivery],ledgerEvents:[],confirmedAt:at,showCourier:true,showPosition:true});
eq(projection.order.fulfillment,'pickup','pickup is separate fulfillment');
eq(projection.status,'preparing','pickup cannot become courier dispatch from route linkage');
eq(projection.progress,null,'pickup does not reveal courier route progress');
eq(projection.courier,null,'pickup has no assigned courier');
const http=fs.readFileSync('lib/tracking/gate1/http.ts','utf8');
const store=fs.readFileSync('lib/tracking/gate1/storage.ts','utf8');
const admin=fs.readFileSync('app/mais/acompanhamento/page.tsx','utf8');
const siteURL='https://dafamilialanches.com.br';
ok(http.includes("const ctx = await ownerContext(req);"),'owner authentication remains enforced');
ok(http.includes('!canAccessCustomer(ctx.c)'),'fail closed flags and capabilities');
ok(http.includes('!mayIssueNewTrackingGrant(snap.data)'),'HTTP refuses terminal/external issuance');
ok(store.includes('!mayIssueNewTrackingGrant(snap.data)'),'storage refuses terminal/external issuance');
ok(http.includes('hasCommercialAcceptance(ctx.c.tenant,snap.data)'),'acceptance is mandatory');
ok(store.includes('if (old.status === \'active\') return { state: \'already_active\''),'existing active grant returns 409');
ok(store.includes('const tokenHash = hexSha256(plain)'),'hash token storage');
ok(store.includes('const result = await adminDb.runTransaction'),'grant issued transactionally');
ok(store.includes("exchange_policy: 'single_use_v1'"),'single-use exchange policy');
ok(store.includes("Object.prototype.hasOwnProperty.call(raw, 'consumed_at')"),'single-use consumed guard');
ok(admin.includes('CUSTOMER_TRACKING_ORIGIN = \''+siteURL+'\''),'fixed allowed site host');
ok(admin.includes("origin:currentInspection.delivery.origin"),'server-checked origin, not arbitrary input');
ok(admin.includes("requested_ttl_minutes:90"),'manual grant lifetime 90min');
ok(admin.includes('StaffConfirmDialog')&&admin.includes("setPendingAction('issue')")&&!admin.includes('window.confirm('),'explicit protected premium owner confirmation');
ok(admin.includes("crypto.randomUUID().replace(/-/g,'')"),'idempotency nonce present');
ok(admin.includes("navigator.clipboard.writeText(url)"),'explicit clipboard gesture');
ok(admin.includes("setIssuedLink(null)"),'ephemeral token erased after copy');
ok(admin.includes("document.addEventListener('visibilitychange',onHidden)"),'secret hidden on background');
ok(admin.includes("api('/revoke'"),'owner revoke control');
ok(admin.includes('!canIssueLink||working||Boolean(issuedLink)'),'issue disabled OFF');
ok(!admin.includes('localStorage.setItem')&&!admin.includes('sessionStorage.setItem'),'no client token persistence');
ok(!admin.includes('console.log(issuedLink)')&&!admin.includes('console.log(answer)'),'no token logging');
ok(!admin.includes('window.location.href = '),'no owner-side token navigation');
console.log(`R265 link handoff: ${tests} local hermetic checks PASS; no network, Firestore or messages`);
