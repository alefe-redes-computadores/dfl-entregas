'use strict';
/* Testes herméticos de elegibilidade, contrato e separação de autoridades. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const files=['lib/integration/r76KitchenPolicy.ts','lib/integration/server/r76KitchenMessaging.ts','lib/integration/client/r76KitchenKick.ts','app/api/integration/kitchen-stage/route.ts','app/entregas/details/page.tsx','lib/tracking/gate1/storage.ts'];
let count=0;const ok=(v,label)=>{assert.ok(v,`R76 P2 ${label}`);count++};
for(const file of files){const content=fs.readFileSync(file,'utf8');const tsx=file.endsWith('.tsx');const ast=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,tsx?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'AST '+file);}
function load(path){const src=fs.readFileSync(path,'utf8');const js=ts.transpileModule(src,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',js)((id)=>id==='./manualMessagingPolicy'?{normalizeManualMessagePhone:v=>{
    const d=String(v||'').replace(/\D/g,'');return /^55[1-9]\d{9,10}$/.test(d)?d:null;
  }}:(()=>{throw Error('unexpected require '+id)})(),mod,mod.exports);return mod.exports;}
const {r76KitchenPlan:plan,r76KitchenAudienceAllowed:audience}=load(files[0]);const now=Date.now(),created=new Date(now-120_000).toISOString(),started=new Date(now-60_000).toISOString(),ready=new Date(now-30_000).toISOString();
const base={id:'dfl-12345678-1234-1234-1234-123456789abc',origin:'loja',source_system:'dfl_entregas',logistics_provider:'dfl',
  fulfillment_mode:'delivery',notify_whatsapp:true,manual_messaging_opt_in_v1:true,customer_name:'Teste',phone:'5534999999999',
  created_at:created,preparation_started_at:started,preparation_ready_at:ready};
const beforeReady={...base,preparation_ready_at:undefined};
const pilotEnv={DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999',DFL_R76_KITCHEN_AUDIENCE_MODE:'pilot',DFL_R76_KITCHEN_GENERAL_APPROVED:'false'};
ok(audience(pilotEnv,'5534999999999'),'pilot allowed');
ok(!audience(pilotEnv,'5534988888888'),'other phone denied');
ok(!audience({},'5534999999999'),'missing pilot denied');
ok(!audience({...pilotEnv,DFL_R76_KITCHEN_AUDIENCE_MODE:'general'},'5534988888888'),'general still gated');
ok(audience({...pilotEnv,DFL_R76_KITCHEN_AUDIENCE_MODE:'general',DFL_R76_KITCHEN_GENERAL_APPROVED:'true'},'5534988888888'),'general approved explicitly');
ok(plan(beforeReady,'preparing',now).eligible,'manual preparing');ok(plan(base,'ready',now).eligible,'manual ready');
for(const origin of ['ifood','food99','keeta'])ok(plan({...beforeReady,origin},'preparing',now).eligible,'marketplace DFL '+origin);
for(const change of [{source_system:'dfl_site'},{source_system:'alien'},{external_order_id:'abc'},{notify_whatsapp:false},
  {manual_messaging_opt_in_v1:false},{completed:true},{developer_test:true},{exclude_from_reports:true},{owner_order_context:'owner_test'},
  {fulfillment_mode:'pickup'},{fulfillment_mode:'external_delivery'},{logistics_provider:'ifood'},{origin:'invalid'},
  {phone:'123'},{preparation_started_at:null},{preparation_ready_at:null}])ok(!plan({...beforeReady,...change},change.preparation_ready_at===null?'ready':'preparing',now).eligible,'invalid '+JSON.stringify(change));
ok(!plan({...base,preparation_ready_at:new Date(now-100_000).toISOString()},'ready',now).eligible,'ready before preparing');
ok(!plan({...beforeReady,preparation_started_at:new Date(now-8*60_000).toISOString()},'preparing',now).eligible,'stale stage');
ok(!plan({...beforeReady,preparation_started_at:new Date(now+60_000).toISOString()},'preparing',now).eligible,'future stage');
ok(!plan(base,'ready',now,{status:'fechada'}).eligible,'closed route');
ok(!plan(base,'ready',now,{started_at:ready}).eligible,'dispatched route');
const server=fs.readFileSync(files[1],'utf8'),api=fs.readFileSync(files[3],'utf8'),view=fs.readFileSync(files[4],'utf8'),tracking=fs.readFileSync(files[5],'utf8');
for(const t of ['ledger.create(','r76KitchenPlan(','confirmedDelivery(','createHmac(','x-dfl-signature','DFL_R76_KITCHEN_WORKER_CERTIFIED','DFL_R76_KITCHEN_ACTIVATED_AT','review_required'])ok(server.includes(t),'server safety '+t);
for(const t of ['verifyIdToken','isSuperadminUid','Object.keys(data).length!==2','notifyR76KitchenStage'])ok(api.includes(t),'superadmin only '+t);
for(const t of ['kickR76KitchenStage','await updateDelivery(delivery.id','r76KitchenPlan','Início do preparo registrado.'])ok(view.includes(t),'post write UI '+t);
for(const t of ['localKitchenEvidence','preparation_started_at','preparation_ready_at'])ok(tracking.includes(t),'actual evidence '+t);
ok(server.includes('r76KitchenAudienceAllowed(process.env,plan.phone)'),'only pilot enters durable ledger');
ok(!server.includes('sendWhatsApp('),'no second bot');ok(!server.includes('issueGrant('),'no extra tracking token');
console.log(`R76 P2 ENTREGAS: ${count} verificações herméticas OK; zero rede e zero envio.`);
