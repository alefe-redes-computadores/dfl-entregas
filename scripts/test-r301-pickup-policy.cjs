'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
const ok=(v,label)=>{assert.ok(v,'R301: '+label);checks++};
const targets=['lib/integration/manualPickupPolicy.ts','lib/integration/server/manualPickup.ts',
  'app/api/integration/manual-pickup/route.ts','lib/integration/client/manualMessagingKick.ts',
  'app/entregas/nova/page.tsx','app/entregas/details/page.tsx','app/entregas/editar/page.tsx',
  'components/messaging/MessagingOrderPicker.tsx'];
for(const p of targets){const syntax=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  ok(syntax.parseDiagnostics.length===0,'sintaxe '+p+' '+syntax.parseDiagnostics.map(x=>x.messageText).join(','));}
const make=(path,deps)=>{const out={};const c=ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  vm.runInNewContext(c.outputText,{exports:out,require:k=>{if(k in deps)return deps[k];throw Error('require inesperado '+k)},Date,Number,String,Math,RegExp,Set,Map,console});return out;};
const phone={normalizeManualMessagePhone:s=>{const digits=String(s||'').replace(/\D/g,'');return /^\d{10,11}$/.test(digits)?'55'+digits:null}};
const policy=make('lib/integration/manualPickupPolicy.ts',{'./manualMessagingPolicy':phone});
const now=Date.now(), iso=x=>new Date(x).toISOString();
const base={id:'dfl-12345678-1234-1234-1234-123456789abc',origin:'loja',fulfillment_mode:'pickup',
 phone:'34999999999',customer_name:'Cliente Teste',notify_whatsapp:true,manual_messaging_opt_in_v1:true,
 created_at:iso(now-2000),customer_charge:39.90,payment_method:'pix',is_paid:false};
const plan=(d={},kind='created')=>policy.planManualPickup({delivery:{...base,...d},reason:kind,now});
let p=plan();ok(p.eligible&&p.eventType==='order.created','criacao manual opt-in');
ok(p.eligible&&p.orderId==='entregas:'+base.id,'identidade da loja distinta do Site');
ok(p.eligible&&p.payload.manual_pickup_v1===true&&p.payload.completed===false,'flag de retirada sem baixa');
ok(p.eligible&&!('is_paid' in p.payload),'nao inferir pagamento');
const readyAt=iso(now-1000);p=plan({pickup_ready_at:readyAt},'ready');
ok(p.eligible&&p.eventType==='order.ready','pronto e evento independente');
ok(p.eligible&&p.occurredAt===readyAt&&p.payload.pickup_ready_at===readyAt,'tempo de prontidao autoritativo');
ok(!plan({pickup_ready_at:readyAt}).eligible,'recebimento atrasado bloqueado após pronto');
for(const [label,input,reason] of [
 ['sem opt-in',{manual_messaging_opt_in_v1:false}],
 ['sem notificacao',{notify_whatsapp:false}],
 ['Site',{source_system:'dfl_site'}],
 ['marketplace',{origin:'ifood'}],
 ['id externo',{external_order_id:'external'}],
 ['entrega',{fulfillment_mode:'delivery'}],
 ['balcao',{fulfillment_mode:'counter'}],
 ['DEV',{developer_test:true}],
 ['relatorios excluidos',{exclude_from_reports:true}],
 ['owner',{owner_order_context:'owner_test'}],
 ['pago nao significa concluido',{completed:true}],
 ['sem contato',{phone:''}],
 ['criacao antiga',{created_at:iso(now-16*60_000)}],
 ['pronto antigo',{pickup_ready_at:iso(now-8*60_000)},'ready'],
 ['pronto sem carimbo',{pickup_ready_at:null},'ready'],
 ])ok(!plan(input,reason||'created').eligible,'nega '+label);
ok(plan({is_paid:true}).eligible,'pedido pago ainda pode receber confirmacao sem marcar entrega');
const details=read('app/entregas/details/page.tsx');
ok(details.includes('await updateDelivery(delivery.id, { pickup_ready_at: new Date().toISOString() });')&&
 details.indexOf('await updateDelivery(delivery.id, { pickup_ready_at')<details.indexOf("void kickManualPickup(delivery.id, 'ready')"),'prontidao antes de tentar mensagem');
ok(details.includes("if (!canMarkSitePickupReady(delivery) || isMarkingReady) return;"),'autoridade Site intocada');
const create=read('app/entregas/nova/page.tsx');
ok(create.indexOf('await addDelivery(')<create.indexOf("void kickManualPickup(manualDeliveryId, 'created')"),'pedido confirmado antes do evento');
ok(create.includes("manual_messaging_opt_in_v1: notifyWhatsapp && origin === 'loja' && fulfillmentMode === 'delivery'"),'contrato legado R284 intocado');
const bridge=read('lib/integration/server/manualPickup.ts');
ok(bridge.includes("DFL_MANUAL_PICKUP_KILL_SWITCH === 'false'")&&bridge.includes("DFL_MANUAL_PICKUP_SCOPE === 'canary'"),'canario OFF por padrao');
ok(bridge.includes(".collection('manual_pickup_events_v2').doc(")&&bridge.includes('await ledgerRef.create('),'reserva Firestore atomica');
ok(bridge.includes('const freshSnap = await deliveryRef.get()')&&bridge.includes('stale_or_changed'),'releitura server antes do envio');
ok(bridge.includes("createHmac('sha256',target.secret)")&&bridge.includes('`${timestamp}.${body}`'),'HMAC correto do Site');
ok(!bridge.includes('retry')&&bridge.includes("reason:'network_unknown'"),'sem replay automatico apos timeout');
const api=read('app/api/integration/manual-pickup/route.ts');
ok(api.includes('adminAuth.verifyIdToken')&&api.includes('isSuperadminUid(user.uid)'),'API protegida owner');
ok(api.includes('NATIVE_ORIGINS')&&api.includes("'cache-control':'private, no-store'"),'APK CORS e cache protegido');
const pre=read('scripts/pre-apk.cjs');ok(pre.includes("'scripts/test-r301-pickup-policy.cjs'")&&pre.includes("'scripts/test-r301-pickup-server.cjs'"),'PRE-APK incluiu testes R301');
console.log(`R301 PICKUP: ${checks} contratos e cenarios aprovados, sem rede e Firestore real`);
