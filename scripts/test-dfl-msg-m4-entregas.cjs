'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const endpoint=read('app/api/integration/messaging-diagnostics/route.ts');
const ui=read('app/mais/mensageria/page.tsx');
const mais=read('app/mais/page.tsx');
let count=0;const ok=(v,msg)=>{assert.ok(v,msg);count++;console.log('MSG-M4 ENTREGAS OK:',msg)};
for(const [path,kind] of [['app/api/integration/messaging-diagnostics/route.ts',ts.ScriptKind.TS],['app/mais/mensageria/page.tsx',ts.ScriptKind.TSX],['app/mais/page.tsx',ts.ScriptKind.TSX]]){
 const a=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,kind);
 ok(!a.parseDiagnostics.length,`AST valido ${path}`);
}
ok(endpoint.includes('verifyIdToken(authorization.slice(7), true)'),'token revogado rejeitado');
ok(endpoint.includes('isSuperadminUid(decoded.uid)'),'somente owner no backend');
ok(endpoint.indexOf('verifyIdToken(authorization.slice(7), true)')<endpoint.indexOf('reverseOutboxStats()'),'nenhuma contagem antes de auth');
ok(endpoint.includes('reverseOutboxStats()'),'contagens de outbox persistida em vez de inventar eventos');
ok(endpoint.includes('planManualMessage({ delivery, reason:'),'politica real avaliada sem envio');
ok(endpoint.includes("NATIVE_ORIGINS.has(origin)"),'CORS nativo limitado');
ok(endpoint.includes('created >= activationMs'),'pedidos anteriores ao rollout bloqueados');
ok(!/notifyManualRoute\(|notifyNewManualDelivery\(|\.update\(|\.create\(|\.set\(|\.delete\(/.test(endpoint),'endpoint de diagnostico nao escreve nem envia');
ok(!/customer_phone|customer_name|payload:|secret:|token:|phone:/.test(endpoint),'sem exposicao de telefone, payload ou segredos');
ok(ui.includes('onClick={() => void consult()}'),'consulta so ao tocar no botao');
ok(ui.includes('auth.currentUser'),'usa token da sessao existente');
ok(ui.includes('Capacitor.isNativePlatform()'),'APK usa endpoint servidor');
ok(ui.includes('controller.abort()'),'consulta com timeout real');
ok(ui.includes("router.push('/mais')"),'retorno navegavel');
ok(mais.includes("router.push('/mais/mensageria')"),'atalho visivel apenas para owner');
ok(ui.includes('não confirma entrega no WhatsApp') || ui.includes('não equivale a recebido pelo cliente'),'nao inventa entrega confirmada');

(async()=>{
 const compiled=ts.transpileModule(endpoint,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let reads=0,stats=0;
 const modules={
   'next/server':{NextResponse:{json:(body,opts)=>({body,opts})}},
   '@/lib/integration/server/admin':{adminAuth:{verifyIdToken:async token=>{if(token==='bad')throw Error('bad');return {uid:token}}},adminDb:{collection:name=>{reads++;assert.equal(name,'deliveries');return {doc:id=>({get:async()=>({exists:true,id,data:()=>({origin:'loja',notify_whatsapp:true,manual_messaging_opt_in_v1:true,created_at:new Date().toISOString(),fulfillment_mode:'delivery',route_id:''})})})}}}},
   '@/lib/access/roles':{isSuperadminUid:uid=>uid==='owner'},
   '@/lib/integration/server/reverseConfig':{reverseRelayConfig:()=>({enabled:true,targetUrl:'present',signingSecret:'present'})},
   '@/lib/integration/server/reverseOutboxRepository':{reverseOutboxStats:async()=>{stats++;return {pending:2,processing:0,failed:1,dead_letter:0}},recentReverseOutboxIssues:async()=>[{eventType:'delivery.started',status:'failed',attempts:2,updatedAt:'2026-11-06T00:00:00Z',lastError:'timeout'}]},
   '@/lib/integration/manualMessagingPolicy':{planManualMessage:({reason})=>reason==='created'?{eligible:true,eventType:'order.created',phone:'SECRET',payload:{name:'SECRET'}}:{eligible:false,reason:'route_not_recently_started'}},
 };
 const exports={};const module={exports};
 vm.runInNewContext(compiled,{module,exports,require:key=>{if(!(key in modules))throw Error('module '+key);return modules[key]},process:{env:{DFL_MANUAL_MESSAGING_ENABLED:'false',DFL_SITE_INTEGRATION_URL:'configured',DFL_INTEGRATION_SIGNING_SECRET:'configured'}},Date,Number,String,console}, {timeout:1500});
 const GET=module.exports.GET;
 const req=(token,id='')=>({headers:{get:key=>key==='authorization'&&token?'Bearer '+token:null},nextUrl:{searchParams:{get:key=>key==='deliveryId'?id:null}}});
 const anon=await GET(req(''));ok(anon.opts.status===401,'anonimo bloqueado');
 const bad=await GET(req('bad'));ok(bad.opts.status===401,'token invalido bloqueado');
 const nonOwner=await GET(req('nonowner'));ok(nonOwner.opts.status===403,'outro usuario bloqueado');
 ok(reads===0&&stats===0,'nenhum acesso a banco antes de autorizar');
 const invalid=await GET(req('owner','../../etc/passwd'));ok(invalid.opts.status===400,'ID invalido bloqueado');
 ok(reads===0&&stats===0,'ID invalido nao gera consultas');
 const normal=await GET(req('owner'));ok(normal.opts.status===200&&normal.body.ok,'owner autorizado consegue diagnosticar');
 ok(normal.body.gates.manualEnabled===false,'gate OFF corretamente reportado');
 ok(normal.body.reverseOutbox.pending===2,'backlog reflete contagem real simulada');
 const inspect=await GET(req('owner','dfl-12345678-1234-1234-1234-123456789abc'));
 ok(inspect.body.delivery.created==='eligible_by_policy'&&inspect.body.delivery.sendingPermitted===false,'politica elegivel nao ativa envio quando OFF');
 ok(!JSON.stringify(inspect.body).includes('SECRET'),'dados de contato nunca retornam ao cliente');
 ok(reads===1 && stats===2,'consultas limitadas a 1 pedido e contagens sob demanda');
 console.log(`MSG-M4 ENTREGAS: ${count} contratos aprovados; ZERO rede, Firebase real ou WhatsApp.`);
})().catch(e=>{console.error(e);process.exit(1)})
