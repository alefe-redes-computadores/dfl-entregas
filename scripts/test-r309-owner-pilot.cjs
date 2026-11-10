'use strict';
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const assert=require('node:assert/strict');
let checks=0;
const ok=(v,n)=>{assert.ok(v,n);checks++;};
const source=fs.readFileSync('lib/integration/manualPickupPolicy.ts','utf8');
const server=fs.readFileSync('lib/integration/server/manualPickup.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
const normalize=(raw)=>{const d=String(raw||'').replace(/\D/g,'');return /^55[1-9]\d{9,10}$/.test(d)?d:/^[1-9]\d{9,10}$/.test(d)?'55'+d:null;};
vm.runInNewContext(js,{exports:mod.exports,require:(name)=>{
 if(name==='./manualMessagingPolicy')return {normalizeManualMessagePhone:normalize};
 throw Error('UNEXPECTED_IMPORT '+name);
},Date,Number,Math,Set,String,RegExp,Boolean,Array}, {timeout:5000,filename:'manualPickupPolicy.ts'});
const {planManualPickup,manualPickupRecipientAccess}=mod.exports;
const phone='5534999999999',id='dfl-12345678-1234-1234-1234-123456789abc';
const at=new Date().toISOString();
const base={id,origin:'loja',fulfillment_mode:'pickup',phone,customer_name:'Titular piloto',
 notify_whatsapp:true,manual_messaging_opt_in_v1:true,owner_order_context:'owner_test',
 developer_test:true,exclude_from_reports:true,created_at:at,createdAt:at,completed:false,customer_charge:12};
const env={DFL_MANUAL_PICKUP_ENABLED:'true',DFL_MANUAL_PICKUP_KILL_SWITCH:'false',
 DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',
 DFL_MANUAL_PICKUP_SCOPE:'authorized_clients',DFL_MANUAL_PICKUP_APPROVED_PHONES_E164:phone};
const plan=(o={},extra={},reason='created')=>planManualPickup({delivery:{...base,...o},reason,now:Date.now(),...extra});
ok(plan().eligible===false,'owner test bloqueado por padrao');
ok(plan({}, {allowOwnerPilot:true}).eligible===true,'piloto autorizado durante criacao');
ok(plan({pickup_ready_at:at},{allowOwnerPilot:true},'ready').eligible===true,'piloto pronto para retirada');
ok(plan({manual_messaging_opt_in_v1:false},{allowOwnerPilot:true}).eligible===false,'consentimento nao dispensado');
ok(plan({notify_whatsapp:false},{allowOwnerPilot:true}).eligible===false,'notify nao dispensado');
ok(plan({owner_order_context:'owner_provisional'},{allowOwnerPilot:true}).eligible===false,'provisorio permanece bloqueado');
ok(plan({owner_order_context:'store_pickup'},{allowOwnerPilot:true}).eligible===false,'retirada real do dono permanece bloqueada');
ok(plan({developer_test:false},{allowOwnerPilot:true}).eligible===false,'sem DEV nao ha excecao');
ok(plan({source_system:'dfl_site'},{allowOwnerPilot:true}).eligible===false,'Site nao recebe excecao');
ok(plan({origin:'ifood'},{allowOwnerPilot:true}).eligible===false,'marketplace nao recebe excecao');
ok(plan({completed:true},{allowOwnerPilot:true}).eligible===false,'pedido concluido nao recebe aviso');
ok(manualPickupRecipientAccess(env,phone).allowed===true,'lista unitaria autorizada');
ok(manualPickupRecipientAccess(env,'5534888888888').allowed===false,'outro telefone negado');
ok(manualPickupRecipientAccess({...env,DFL_MANUAL_PICKUP_ENABLED:'false'},phone).allowed===false,'kill por enabled mantido');
ok(manualPickupRecipientAccess({...env,DFL_MANUAL_PICKUP_KILL_SWITCH:'true'},phone).allowed===false,'kill por safety mantido');
ok(server.includes("process.env.DFL_MANUAL_PICKUP_SCOPE !== 'authorized_clients'"),'piloto impossivel com escopo amplo');
ok(server.includes('numbers.length !== 1'),'piloto impossivel com mais de um telefone');
ok(server.includes('phone === numbers[0]'),'piloto exige equivalencia de telefone');
ok(server.includes('allowOwnerPilot:r309OwnerPilot(delivery)'),'plan inicial restrito');
ok(server.includes('allowOwnerPilot:r309OwnerPilot({...freshSnap.data(),id:freshSnap.id} as Delivery)'),'releitura ainda restrita');
ok(server.includes('await ledgerRef.create('),'dedupe persistida');
ok(server.includes("status:'uncertain'"),'sem reenvio automatico em incerteza');
console.log(`R309_OWNER_PILOT_OK | ${checks} verificacoes`);
