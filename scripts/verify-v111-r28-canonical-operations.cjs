'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=file=>fs.readFileSync(file,'utf8');
for(const file of [
  'lib/access/staffCanonicalPolicy.ts','lib/access/staffCanonicalClient.ts',
  'app/api/access/canonical/route.ts','app/api/access/operations/route.ts',
  'app/mais/acessos/solicitacoes/page.tsx',
]){
  const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
  const issues=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
  assert.equal(issues.length,0,`Sintaxe inválida em ${file}`);
}
const moduleObj={exports:{}};
new Function('module','exports',ts.transpileModule(read('lib/access/staffCanonicalPolicy.ts'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
}).outputText)(moduleObj,moduleObj.exports);
const p=moduleObj.exports;
let scenarios=0;
const ok=(v,label)=>{assert.ok(v,label);scenarios++;};
const now=Date.parse('2026-10-20T18:10:00.000Z');
const request={kind:'delivery_confirmation',targetId:'delivery-one',routeId:'route-one',actorUid:'moto-00000001',status:'pending',createdAt:'2026-10-20T18:00:00.000Z'};
const acc={uid:request.actorUid,status:'active',role:'motoboy',linkedMotoboyId:'moto-one',permissions:['deliveries_read','deliveries_complete']};
const delivery={route_id:request.routeId,completed:false,fulfillment_mode:'delivery',updated_at:'2026-10-20T18:00:01.000Z'};
const route={status:'aberta',motoboy_id:'moto-one',started_at:'2026-10-20T17:50:00.000Z'};
ok(p.eligibleDeliveryClaim(request,acc,delivery,route,now),'Autoriza solicitação de entrega vinculada');
ok(!p.eligibleDeliveryClaim({...request,actorUid:'someone-else'},acc,delivery,route,now),'Bloqueia UID diferente');
ok(!p.eligibleDeliveryClaim(request,{...acc,status:'suspended'},delivery,route,now),'Revogado bloqueado');
ok(!p.eligibleDeliveryClaim(request,{...acc,permissions:['deliveries_read']},delivery,route,now),'Escrita exige permissão');
ok(!p.eligibleDeliveryClaim(request,acc,delivery,{...route,motoboy_id:'outro'},now),'Motoboy alheio bloqueado');
ok(!p.eligibleDeliveryClaim(request,acc,{...delivery,completed:true},route,now),'Não duplica baixa concluída');
ok(!p.eligibleDeliveryClaim(request,acc,delivery,{...route,status:'fechada'},now),'Rota fechada bloqueada');
ok(!p.eligibleDeliveryClaim(request,acc,{...delivery,source_system:'dfl_site',site_order_status:'cancelado'},route,now),'Pedido Site cancelado bloqueado');
ok(!p.eligibleDeliveryClaim(request,acc,delivery,route,now+8*86400000),'Pedido antigo não reativado');
ok(!p.eligibleDeliveryClaim({...request,execution:{expiresAt:'2026-10-20T18:12:00.000Z'}},acc,delivery,route,now),'Lease evita concorrência');
const ex={token:'aaaa-bbbb',issuedAt:'2026-10-20T18:05:00.000Z',expiresAt:'2026-10-20T18:11:00.000Z'};
ok(p.verifiedCanonicalDelivery({...request,execution:ex},{...delivery,completed:true,completed_at:'2026-10-20T18:06:00.000Z'},ex.token,now),'Confirma baixa gravada dentro da reserva');
ok(!p.verifiedCanonicalDelivery({...request,execution:ex},{...delivery,completed:true,completed_at:'2026-10-20T18:01:00.000Z'},ex.token,now),'Não aceita conclusão anterior ao claim');
ok(!p.verifiedCanonicalDelivery({...request,execution:ex},{...delivery,completed:true,completed_at:'2026-10-20T18:06:00.000Z'},'wrong',now),'Não aceita token diferente');
ok(!p.verifiedCanonicalDelivery({...request,execution:ex},{...delivery,completed:true,completed_at:'2026-10-20T18:06:00.000Z'},ex.token,now+300000),'Lease vencido bloqueia');
ok(!p.verifiedCanonicalDelivery({...request,execution:ex},{...delivery,completed:false},ex.token,now),'Sem baixa real não encerra fila');
const buyReq={kind:'purchase_intent',targetId:'product-1',unit:'kg',quantity:0.3,status:'pending',createdAt:'2026-10-20T18:00:00.000Z'};
const supply={status:'conferido',stock_integrated_at:'2026-10-20T18:05:00.000Z',items:[{id:'item_1',stock_product_id:'product-1',quantity:0.3,unit:'kg'}]};
ok(p.verifyIntegratedSupply(buyReq,supply,now)?.quantity===0.3,'Compra integrada com unidade e quantidade corretas');
ok(!p.verifyIntegratedSupply(buyReq,{...supply,status:'recebido'},now),'Recebido sem integrar não passa');
ok(!p.verifyIntegratedSupply(buyReq,{...supply,stock_reversed_at:'2026-10-20'},now),'Estorno bloqueia conciliação');
ok(!p.verifyIntegratedSupply(buyReq,{...supply,stock_integrated_at:'2026-10-20T17:59:00.000Z'},now),'Não associa entrada anterior ao pedido');
ok(!p.verifyIntegratedSupply(buyReq,{...supply,items:[{...supply.items[0],quantity:0.2}]},now),'Quantidade abaixo da solicitada bloqueada');
ok(!p.verifyIntegratedSupply(buyReq,{...supply,items:[{...supply.items[0],unit:'un'}]},now),'Unidade diferente bloqueada');
ok(p.existingOutcome({status:'linked',effect:'owner_integrated_supply_verified',linkedSupplyId:'supply1'},'purchase','supply1'),'Confirmação repetida idempotente');
const api=read('app/api/access/canonical/route.ts'),client=read('lib/access/staffCanonicalClient.ts'),r27=read('app/api/access/operations/route.ts'),screen=read('app/mais/acessos/solicitacoes/page.tsx');
for(const token of ['verifyIdToken(header.slice(7),true)',"process.env.DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED!=='true'",'adminDb.runTransaction','eligibleDeliveryClaim','verifiedCanonicalDelivery','verifyIntegratedSupply','staff_canonical_receipts',"status:'applied'","status:'linked'",'staff_access_audit'])ok(api.includes(token),'Servidor exige '+token);
ok(!/tx\.update\(adminDb\.collection\('(deliveries|routes|customers|stock_products|stock_supplies|stock_movements)'/.test(api),'Servidor não cria segunda autoridade de baixa/estoque');
ok(client.includes('useAppStore.getState()') && client.includes('store.updateDelivery(row.targetId,{completed:true})'),'Conclui por regra de negócio da store existente');
ok(client.includes('getDocFromServer')&&client.includes("action:'complete_delivery'"),'Conferência online antes e depois');
ok(!client.includes('updateDoc(')&&!client.includes('setDoc('),'Cliente não escreve direto no Firebase');
ok(screen.includes('applyCanonicalDelivery')&&screen.includes('verifyCanonicalPurchase'),'Central tem dois fluxos canônicos');
ok(screen.includes('stock_integrated_at')&&screen.includes('Revisado (sem aplicar)'),'Compra exige integração, e revisão manual continua distinta');
ok(r27.includes('Date.parse(lease.expiresAt)>Date.now()'),'Revisão não atropela aplicação em andamento');
ok(read('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r28-canonical-operations.cjs'"),'Gate R28 integrado ao PRE-APK');
ok(!read('security/firestore.v111-r26-candidate.rules').includes('match /staff_operation_requests'),'Rules continuam sem escrita direta de funcionários');
console.log(`DFL V111 R28: ${scenarios} verificações de contrato e comportamento aprovadas. Não concede acesso a funcionários.`);
