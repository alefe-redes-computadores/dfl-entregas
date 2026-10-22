#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');
function load(path){let content=fs.readFileSync(path,'utf8');const js=ts.transpileModule(content,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;const mod={exports:{}};vm.runInNewContext(js,{module:mod,exports:mod.exports,Map,Set,Date,Math,JSON,Object,Number,String,Error},{filename:path});return mod.exports;}
const p=load('lib/access/staffOperationPolicy.ts');const s=load('lib/access/staffRequestRetry.ts');const proj=load('lib/access/staffProjection.ts');let checks=0;
const ok=(v,message)=>{assert.ok(v,message);checks++};
const base={uid:'worker-00000001',status:'active',role:'operacao',permissions:['home','routes_read','deliveries_read','deliveries_complete']};
const delivery={route_id:'route-A',completed:false,fulfillment_mode:'delivery'};const route={motoboy_id:'driver-A',status:'aberta',started_at:'2026-10-22T15:00:00Z'};
ok(p.maySubmitStaffOperation(base,base.uid,'delivery_confirmation'),'Operacao ativa solicita conferencia sem motoboy');
ok(!p.maySubmitStaffOperation({...base,status:'suspended'},base.uid,'delivery_confirmation'),'Suspensao bloqueia');
ok(!p.maySubmitStaffOperation({...base,permissions:['deliveries_read']},base.uid,'delivery_confirmation'),'Sem deliveries_complete bloqueia');
ok(!p.maySubmitStaffOperation({...base,permissions:['deliveries_complete']},base.uid,'delivery_confirmation'),'Sem deliveries_read bloqueia');
ok(!p.maySubmitStaffOperation({...base,uid:'outro-usuario'},base.uid,'delivery_confirmation'),'Identidade incorreta bloqueia');
ok(!p.maySubmitStaffOperation({...base,role:'compras'},base.uid,'delivery_confirmation'),'Compras sem logistica bloqueia');
ok(!p.maySubmitStaffOperation({...base,role:'motoboy'},base.uid,'delivery_confirmation'),'Motoboy sem vinculo bloqueia');
ok(!p.maySubmitStaffOperation({...base,role:'personalizado'},base.uid,'delivery_confirmation'),'Personalizado sem vinculo bloqueia');
ok(p.maySubmitStaffOperation({...base,role:'personalizado',linkedMotoboyId:'driver-A'},base.uid,'delivery_confirmation'),'Personalizado com vinculo e ambas permissoes');
ok(p.deliveryEligibleForRequest(delivery,route,'','route-A','operacao'),'Operacao pode propor em rota ativa projetada');
ok(!p.deliveryEligibleForRequest(delivery,route,'','route-B','operacao'),'Nao permite route ID divergente');
ok(!p.deliveryEligibleForRequest(delivery,{...route,motoboy_id:''},'','route-A','operacao'),'Bloqueia rota sem motoboy atribuido');
ok(!p.deliveryEligibleForRequest(delivery,{...route,status:'fechada'},'','route-A','operacao'),'Bloqueia rota fechada');
ok(!p.deliveryEligibleForRequest({...delivery,completed:true},route,'','route-A','operacao'),'Bloqueia entrega concluida');
ok(!p.deliveryEligibleForRequest({...delivery,fulfillment_mode:'pickup'},route,'','route-A','operacao'),'Bloqueia retirada');
ok(!p.deliveryEligibleForRequest({...delivery,source_system:'dfl_site',site_order_status:'cancelado'},route,'','route-A','operacao'),'Bloqueia cancelados site');
ok(!p.deliveryEligibleForRequest({...delivery,source_system:'dfl_site',site_order_status:'pendente'},route,'','route-A','operacao'),'Bloqueia pendente site');
ok(p.deliveryEligibleForRequest(delivery,route,'driver-A','route-A','motoboy'),'Motoboy correto permitido');
ok(!p.deliveryEligibleForRequest(delivery,route,'driver-B','route-A','motoboy'),'Motoboy de outra rota bloqueado');
ok(!p.deliveryEligibleForRequest(delivery,route,'','route-A','personalizado'),'Personalizado sem vinculo bloqueado');
const r=new s.StaffRequestRetry(90000,3);let created=0;const next=()=>`request-${++created}`;
const one=r.reserve('uid1','purchase_intent','stock1',0.3,100,next);
ok(one===r.reserve('uid1','purchase_intent','stock1',0.3,101,next)&&created===1,'Resposta incerta reutiliza ID');
ok(one!==r.reserve('uid1','purchase_intent','stock1',0.4,101,next),'Quantidade diferente nao reutiliza ID');
ok(one!==r.reserve('uid2','purchase_intent','stock1',0.3,101,next),'Identidade diferente nao compartilha ID');
ok(created===3,'Tres chaves distintas');
ok(one!==r.reserve('uid1','purchase_intent','stock1',0.3,90102,next),'Expiracao permite uma nova acao');
ok(r.reserve('uid1','delivery_confirmation','delivery1',undefined,90103,next)!==one,'Outro tipo de pedido nao colide');
r.reset();ok(r.reserve('uid1','purchase_intent','stock1',0.3,90104,next)!==one,'Reset elimina identificadores antigos');
const cancel=proj.projectDelivery({source_system:'dfl_site',site_order_status:'cancelado',completed:false,phone:'SENTINELA',price:9999},'delivery-abc');
ok(cancel.status==='Cancelada'&&cancel.subtitle==='Pedido cancelado','Projecao mostra cancelado corretamente');
ok(!JSON.stringify(cancel).includes('SENTINELA')&&!JSON.stringify(cancel).includes('9999'),'Projecao nao vaza PII e financeiro');
ok(proj.projectDelivery({completed:true},'delivery-ok').status==='Concluída','Concluida preservada');
ok(proj.projectDelivery({completed:false},'delivery-pending').status==='Pendente','Pendente preservada');
for(let i=0;i<120;i++){
 const testId=`target-${i}`;
 const id=r.reserve('uid1','purchase_intent',testId,i/100,100000+i,next);
 ok(id===r.reserve('uid1','purchase_intent',testId,i/100,100001+i,next),'Repeticao estavel '+i);
}
console.log('R63 STAFF WORKFLOWS:',checks,'cenarios comportamentais aprovados');
