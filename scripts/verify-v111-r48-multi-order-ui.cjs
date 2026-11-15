#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let passed=0;
function check(v,msg){assert.ok(v,'R48: '+msg);passed++}
function file(f){const s=fs.readFileSync(f,'utf8');const d=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);check(d.parseDiagnostics.length===0,f+' JSX/syntax');return s}
const create=file('app/entregas/nova/page.tsx');
const edit=file('app/entregas/editar/page.tsx');
const card=file('components/home/DeliveryCard.tsx');
const lib=file('lib/operation/multiOrderDraft.ts');
check(edit.includes('sameStopDeliveries.map(')&&edit.includes('router.replace(`/entregas/editar?id='),'Editar mantém abas por número');
for(const name of ['activeDraftId','setActiveDraftId','role="tablist"','aria-selected={activeDraftId === draft.id}','#{draft.orderId ||','setExtraIfoodOrders','Salvar ${extraIfoodOrders.length + 1} pedidos','firstMultiOrderIssue(drafts)','setActiveDraftId(issue.id)'])check(create.includes(name),'Criar navegação: '+name);
for(const name of ['activeOrderId','activeIfoodId','activeConfirmationCode','activeCustomerName','activePhone','activeAddress','activeMapsLink','activeValue','activeSubsidy','activePaymentMethod','activeIsPaid','activeChangeFor','activeDrinks','activeObservation'])check(create.includes(name),'Campo individual: '+name);
for(const name of ['onChange={setActiveAddress}','onMapsLinkDetected={setActiveMapsLink}','setActivePaymentMethod(','setActiveOrderId(','setActiveConfirmationCode(','setActiveValue('])check(create.includes(name),'Edição ativa: '+name);
for(const bad of ['multiOrderReviewOpen','setMultiOrderReviewOpen','confirmationCode:item.confirmationCode||parsed.confirmationCode'])check(!create.includes(bad),'Modal antigo e cópia implícita proibidos: '+bad);
check(create.includes("confirmationCode:''")&&create.includes("customerCharge:''"),'Novo pedido não herda códigos nem valores');
check(
  create.includes('confirmedWhatsappRecipient === consentRecipientKey') &&
  create.includes("setConfirmedWhatsappRecipient(event.target.checked ? consentRecipientKey : '')") &&
  create.includes("notifyWhatsapp:false") &&
  create.includes("notify_whatsapp:notifyWhatsapp") &&
  create.includes("notify_whatsapp:drafts.length===1&&draft.notifyWhatsapp") &&
  create.includes("manual_messaging_opt_in_v1:drafts.length===1&&draft.notifyWhatsapp&&fulfillmentMode==='delivery'"),
  'R310: consentimento explícito, vinculado ao destinatário e sem herança entre pedidos'
);
check(create.includes('draft.notifyWhatsapp')&&create.includes('drinks:draft.drinks'),'Salvar mantém WhatsApp/bebidas por pedido');
const batchPersist=/notify_whatsapp:([^,]+),manual_messaging_opt_in_v1:([^,]+),observation:/.exec(create);
check(Boolean(batchPersist),'R48 regras individuais de persistencia localizadas');
const batchAllowed=new Function('drafts','draft','return Boolean('+batchPersist[1]+')');
const batchOptIn=new Function('drafts','draft','fulfillmentMode','return Boolean('+batchPersist[2]+')');
for(const count of [1,2,3,8]){
  const drafts=Array.from({length:count},(_,i)=>({id:'pedido-'+i,notifyWhatsapp:i===0}));
  check(batchAllowed(drafts,drafts[0])===(count===1),'R48 contato individual '+count);
  check(batchOptIn(drafts,drafts[0],'delivery')===(count===1),'R48 optin individual '+count);
  check(batchAllowed(drafts,{notifyWhatsapp:false})===false,'R48 sem consentimento '+count);
  check(batchOptIn(drafts,drafts[0],'external_delivery')===false,'R48 entrega plataforma bloqueada '+count);
}
check(create.includes("(origin !== 'ifood' || extraIfoodOrders.length === 0)"),'R48 nenhum WhatsApp no lote');
check(create.includes('hasOwnerIdentity({name:draftName,phone:draftPhone})'),'Pedido de teste não contamina irmãos');
check(create.includes('stopSource&&sameCustomerAddress(stopSource.address_string,draftAddress)'),'Agrupamento respeita endereço existente');
check(create.indexOf('const [drinks, setDrinks]') < create.indexOf('const activeDrinks ='),'Estado criado antes de ler campo ativo');
check(create.indexOf('const [observation, setObservation]') < create.indexOf('const activeObservation ='),'Observação criada antes de ler campo ativo');
check(create.includes('firstMultiOrderIssue(drafts)')&&lib.includes("kind:'duplicate_ifood_id'"),'IDs duplicados bloqueados antes de gravar');
check(card.includes('storedConfirmationCode = (item: Delivery) => orderConfirmationCode(item.confirmation_code)') && card.includes('const codeToSave = orderConfirmationCode(suppliedCode || storedConfirmationCode(item))'),'Confirmação agrupada usa código estrito do próprio pedido, sem truncamento');
check(card.includes('const groupedPaymentRows = useMemo('),'Financeiro de parada reutilizado');
check(card.includes('groupedDeliveries.every(') && card.includes("item.origin === 'ifood'") && card.includes('orderConfirmationCode(item.confirmation_code)'), 'Código comum somente quando todos os pedidos iFood têm o mesmo código válido');
const pre=file('scripts/pre-apk.cjs');const tests=[...pre.matchAll(/^\s*'(scripts\/[^']+\.cjs)'/gm)].map(m=>m[1]);check(tests.length>=178,'no mínimo 178 suítes anteriores preservadas');check(new Set(tests).size===tests.length,'Nenhuma suíte duplicada');for(const item of tests)check(fs.existsSync(item),'Suíte presente '+item);
console.log(`R48 UNIFICACAO CRIACAO/EDICAO: ${passed} contratos OK`);
