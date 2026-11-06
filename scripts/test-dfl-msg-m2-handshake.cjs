'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const project = process.cwd();
const site = path.join(process.env.HOME || '', 'projects', 'da-familia-lanches-v2');
const secret = 'offline-contract-secret-for-test-only';
const captured = [];
const now = new Date();
const activation = new Date(now.getTime() - 60_000).toISOString();
const record = {
  id:'dfl-12345678-1234-1234-1234-123456789abc',
  source_system:'dfl_entregas', origin:'loja',
  notify_whatsapp:true, manual_messaging_opt_in_v1:true,
  phone:'(34) 99999-9999', customer_name:'Cliente Teste',
  created_at:new Date(now.getTime()-2500).toISOString(),
  fulfillment_mode:'delivery', customer_charge:33.5,
};
const env = {
  DFL_MANUAL_MESSAGING_ENABLED:'true',
  DFL_MANUAL_MESSAGING_SCOPE:'canary',
  DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999',
  DFL_MANUAL_MESSAGING_ACTIVATED_AT:activation,
  DFL_SITE_INTEGRATION_URL:'https://dafamilialanches.com.br',
  DFL_INTEGRATION_SIGNING_SECRET:secret,
};
const database = {collection: (name)=>{
  assert.equal(name,'deliveries');
  return {doc:(id)=>{assert.equal(id,record.id);return {get: async()=>({exists:true,id,data:()=>record})}}};
}};
const transpile = (input) => ts.transpileModule(fs.readFileSync(input,'utf8'),{
  fileName:input,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
}).outputText;
function load(file, dependencies, globals={}){
  const exports={};
  vm.runInNewContext(transpile(file), {
    require:(name)=>{if(name in dependencies)return dependencies[name];throw Error(`Unexpected ${name}`)},
    exports, console, Buffer, Date, process:{env}, URL, fetch:async(url,args)=>{
      captured.push({url,args});
      return {ok:true,status:200,json:async()=>({ok:true,queued:true})};
    },AbortController,setTimeout,clearTimeout,Math,Number,Set,RegExp,JSON,...globals,
  },{filename:path.basename(file),timeout:2000});
  return exports;
}
const policy=load(path.join(project,'lib/integration/manualMessagingPolicy.ts'),{});
const manual=load(path.join(project,'lib/integration/server/manualMessaging.ts'),{
  'server-only':{},'node:crypto':crypto,'./admin':{adminDb:database},
  '../manualMessagingPolicy':policy,
});
const signature=load(path.join(site,'src/lib/integration/server/signature.ts'),{
  'server-only':{},'node:crypto':crypto,
});
(async()=>{
  const result=await manual.notifyNewManualDelivery(record.id);
  assert.equal(result.status,'queued');
  assert.equal(captured.length,1);
  const request=captured[0];
  assert.equal(request.url,'https://dafamilialanches.com.br/api/integration/manual-messaging');
  // Real Site validator uses Number(timestamp), not Date.parse(timestamp).
  // The reverse direction uses bare hexadecimal HMAC, not the sha256= prefix.
  assert.match(request.args.headers['x-dfl-timestamp'],/^\d{13}$/);
  assert.ok(Math.abs(Date.now()-Number(request.args.headers['x-dfl-timestamp']))<300000);
  assert.match(request.args.headers['x-dfl-signature'],/^[a-f0-9]{64}$/);
  assert.equal(request.args.headers['x-dfl-signature'],crypto.createHmac('sha256',secret)
    .update(`${request.args.headers['x-dfl-timestamp']}.${request.args.body}`,'utf8').digest('hex'));
  const body=JSON.parse(request.args.body);
  assert.equal(body.source,'manual');
  assert.equal(body.event_type,'order.created');
  assert.equal(body.order_id,'entregas:'+record.id);
  signature.assertSignedIntegrationRequest({
    body:request.args.body,timestamp:request.args.headers['x-dfl-timestamp'],
    signature:request.args.headers['x-dfl-signature'],
    eventId:request.args.headers['x-dfl-event-id'], expectedEventId:body.event_id,
  });
  const signed={
    body:request.args.body,timestamp:request.args.headers['x-dfl-timestamp'],
    signature:request.args.headers['x-dfl-signature'],
    eventId:request.args.headers['x-dfl-event-id'],expectedEventId:body.event_id,
  };
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,body:signed.body+' '}),/Assinatura/i,'payload adulterado');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,eventId:'evento-trocado'}),/event-id/i,'eventId alterado');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,timestamp:new Date().toISOString()}),/Timestamp/i,'ISO rejeitado pelo contrato Site');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,signature:`sha256=${signed.signature}`}),/Assinatura/i,'prefixo nao suportado');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,timestamp:String(Date.now()-301000)}),/Timestamp/i,'timestamp expirado');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,timestamp:String(Date.now()+301000)}),/Timestamp/i,'timestamp futuro');
  assert.throws(()=>signature.assertSignedIntegrationRequest({...signed,signature:'0'.repeat(64)}),/Assinatura/i,'HMAC errado');
  env.DFL_MANUAL_MESSAGING_ACTIVATED_AT = new Date(now.getTime()+5000).toISOString();
  const old=await manual.notifyNewManualDelivery(record.id);
  assert.equal(old.status,'skipped');assert.equal(old.reason,'predates_rollout');
  assert.equal(captured.length,1);
  env.DFL_MANUAL_MESSAGING_ENABLED='false';
  assert.equal((await manual.notifyNewManualDelivery(record.id)).status,'off');
  assert.equal(captured.length,1);
  console.log('MSG-M2: assinatura HMAC REAL entre módulos de Site/Entregas, epoch-ms, tamper, replay-window, rollout e OFF: APROVADOS (zero rede).');
})().catch(err=>{console.error(err);process.exitCode=1});
