'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const crypto=require('node:crypto');
function load(path, env={}, extras='', supplied={}) {
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{
    fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText+'\n'+extras;
  const exports={};
  const imports={'server-only':{},'node:crypto':crypto,'./admin':{adminDb:{}},...supplied};
  const context={exports,require(name){if(Object.hasOwn(imports,name))return imports[name];throw Error('R52 unexpected import '+name+' at '+path);},process:{env},Date,Number,String,Math,Map,Set,JSON,RegExp,URL,AbortController,setTimeout,clearTimeout,console};
  vm.runInNewContext(code,context,{filename:path});
  return exports;
}
const policy=load('lib/integration/manualMessagingPolicy.ts');
const pilot='5534999999999';
const env={DFL_MANUAL_OWNER_PILOT_ENABLED:'true',DFL_MANUAL_MESSAGING_SCOPE:'canary',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MANUAL_NEXT_STOP_ENABLED:'true',DFL_MANUAL_NEXT_STOP_KILL_SWITCH:'false',DFL_MANUAL_NEXT_STOP_SCOPE:'canary',DFL_MESSAGING_PILOT_PHONE_E164:pilot};
const time=new Date().toISOString();
const base={id:'dfl-12345678-1234-1234-1234-123456789abc',source_system:undefined,origin:'loja',phone:pilot,customer_name:'Titular piloto',fulfillment_mode:'delivery',address_string:'Rua Nova, 100',developer_test:true,owner_order_context:'owner_test',exclude_from_reports:true,notify_whatsapp:true,manual_messaging_opt_in_v1:true,created_at:time,createdAt:time,completed:false};
const before=policy.planManualMessage({delivery:base,reason:'created'});
assert.equal(before.eligible,false,'política pura continua negando DEV');
function messaging(e){return load('lib/integration/server/manualMessaging.ts',e,'exports.__R52_ownerPilot=ownerPilot;exports.__R52_plan=plannedManualMessage;',{'../manualMessagingPolicy':policy});}
function next(e){return load('lib/integration/server/manualNextStop.ts',e,'exports.__R52_auth=authorizedCandidate;exports.__R52_enabled=enabled;',{'../manualMessagingPolicy':policy,'../manualNextStopPolicy':{planManualNextStopTransition(){return null}}});}
const s=messaging(env),n=next(env);
assert.equal(s.__R52_ownerPilot(base),true,'exceção somente para titular explicitamente autorizado');
assert.equal(s.__R52_plan(base,'created').eligible,true,'cadastro titular piloto elegível com gate');
assert.equal(n.__R52_auth(base,pilot),true,'próxima parada titular piloto elegível com gate');
for(const [reason,over] of [
 ['flag OFF',{}],['outro escopo',{DFL_MANUAL_MESSAGING_SCOPE:'consented_customers'}],
 ['outro telefone',{DFL_MESSAGING_PILOT_PHONE_E164:'5534998888888'}],
 ['kill switch',{DFL_MANUAL_MESSAGING_KILL_SWITCH:'true'}]
]) {
  const e=reason==='flag OFF'?{...env,DFL_MANUAL_OWNER_PILOT_ENABLED:'false'}:{...env,...over};
  assert.equal(messaging(e).__R52_plan(base,'created').eligible,false,reason+' cadastro negado');
  const nextState=next(e);
  if(reason==='kill switch') assert.equal(nextState.__R52_enabled(),false,reason+' desliga toda próxima parada');
  else assert.equal(nextState.__R52_auth(base,e.DFL_MESSAGING_PILOT_PHONE_E164),false,reason+' próxima parada negada');
}
for(const [reason,over] of [
 ['sem consentimento',{notify_whatsapp:false}],
 ['opt-in incompleto',{manual_messaging_opt_in_v1:false}],
 ['origem marketplace',{origin:'ifood'}],
 ['pedido Site',{source_system:'dfl_site'}],
 ['externo',{external_order_id:'123'}],
 ['não é DEV',{developer_test:false}],
 ['contexto provisório',{owner_order_context:'owner_provisional'}],
 ['retirada',{fulfillment_mode:'pickup'}],
 ['outro destinatário',{phone:'5534988888888'}]
]) {
  assert.equal(s.__R52_plan({...base,...over},'created').eligible,false,reason+' cadastro negado');
  assert.equal(n.__R52_auth({...base,...over},pilot),false,reason+' próxima parada negada');
}
const a=load('lib/operational-address.ts');
const best=a.bestOperationalAddress('Rua Nova, 100 - Bairro Novo','Rua Antiga, 999 - Bairro Antigo');
assert.match(best,/Rua Nova/,'snapshot sempre prevalece');
assert.doesNotMatch(best,/Rua Antiga/,'não mostra endereço principal antigo');
const compact=a.compactAddressForCard('Rua Nova, 100','Rua Antiga, 999','Bairro Antigo');
assert.match(compact,/Rua Nova/,'cartão usa destino específico');
assert.doesNotMatch(compact,/Bairro Antigo/,'bairro do cliente não contamina outro destino');
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
assert.match(card,/!delivery\.address_string\?\.trim\(\) \? customer\?\.maps_link : ''/,'Maps padrão apenas sem endereço do pedido');
const form=fs.readFileSync('app/entregas/nova/page.tsx','utf8');
assert.match(form,/if \(next !== streetAddress\) setMapsLink\(''\)/,'troca de destino apaga geolocalização anterior');
assert.match(form,/sameStopSource && sameCustomerAddress\(sameStopSource\.address_string,cleanStreet\)/,'não reutiliza parada com outro endereço');
const kick=fs.readFileSync('lib/integration/client/manualMessagingKick.ts','utf8');
assert.match(kick,/controller\.abort\(\),16000/,'timeout do cliente acompanha o backend');
const route=fs.readFileSync('app/api/integration/route-kick/route.ts','utf8');
assert.match(route,/\[integration\/manual-canary\]/,'diagnóstico seguro em logs');
// R52 R2: os fallbacks `off` nao possuem `reason`, portanto estreitar a union.
assert.match(route,/['"]reason['"] in manualMessaging/,'razão tipada apenas quando existe no retorno manual');
assert.match(route,/['"]reason['"] in manualNextStop/,'razão tipada apenas quando existe no retorno próxima parada');
assert.doesNotMatch(route,/console\.info\('\[integration\/manual-canary\]'[^;]*customer_phone/,'sem telefone no log da ponte');
console.log('R52: 30+ verificações de piloto DEV restrito, consentimento, snapshots, Maps e auditoria OK');
