'use strict';
/** R33: testes comportamentais e contratos, sem acesso a rede/Firebase. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
let checks=0;
const pass=(v,name)=>{assert.ok(v,`R33: ${name}`);checks++;};
const read=file=>fs.readFileSync(file,'utf8');
function syntax(file){
  const output=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
  assert.deepEqual((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>d.messageText),[],`Sintaxe ${file}`);
  return output.outputText;
}
const cache=new Map();
function load(file){
  const resolved=path.resolve(file);
  if(cache.has(resolved))return cache.get(resolved).exports;
  const mod={exports:{}};cache.set(resolved,mod);
  new Function('module','exports','require',syntax(resolved))(mod,mod.exports,(x)=>{
    if(x.startsWith('.'))return load(path.resolve(path.dirname(resolved),x+'.ts'));
    throw new Error('Dependencia fora do teste: '+x);
  });
  return mod.exports;
}
const src='lib/access/staffIntegrityPolicy.ts',api='app/api/access/integrity/route.ts',
 page='app/mais/acessos/integridade/page.tsx',client='lib/access/staffIntegrityClient.ts',
 readiness='app/mais/acessos/prontidao/page.tsx';
for(const f of [src,api,page,client,readiness,'lib/access/staffProjectionGuard.ts']){syntax(f);pass(true,'JSX e TS validos: '+f);}
const p=load(src),projection=load('lib/access/staffProjection.ts');
const moto={uid:'moto-123456',role:'motoboy',status:'suspended',permissions:['home','routes_read','deliveries_read','stock_read'],linkedMotoboyId:'m-1'};
const buyer={uid:'compra-12345',role:'compras',status:'suspended',permissions:['home','stock_read','purchases_read','routes_read']};
const route={motoboy_id:'m-1',name:'Rota Noite',date:'2026-10-20',status:'aberta'};
const delivery={completed:false,route_id:'route-001',source_system:'local'};
const product={id:'produto-123',name:'Batata',current_quantity:0.3,unit:'kg',active:true};
const purchase={items:[{id:'x'}],status:'recebido'};
const routeRow=projection.projectRoute(route,'route-001');
const deliveryRow=projection.projectDelivery(delivery,'delivery-001');
const productRow=projection.projectProduct(product,'produto-123');
const purchaseRow=projection.projectPurchase(purchase,'compra-123');
const check=(area,row,account,original,id,linked)=>p.assessProjection(area,row,account,original,id,linked);
pass(check('routes',routeRow,moto,route,'route-001').length===0,'rota pertencente ao motoboy e atual');
pass(check('deliveries',deliveryRow,moto,delivery,'delivery-001',route).length===0,'entrega vinculada a rota correta');
pass(check('stock',productRow,buyer,product,'produto-123').length===0,'estoque do comprador validado');
pass(check('purchases',purchaseRow,buyer,purchase,'compra-123').length===0,'compra confere com origem');
pass(check('home',{title:'A',subtitle:'B',status:'C'},moto,null,'overview').length===0,'home nao demanda fonte individual');
pass(check('routes',routeRow,{...moto,linkedMotoboyId:'m-2'},route,'route-001').includes('wrong_motoboy'),'rota nao corresponde ao vinculo');
pass(check('deliveries',deliveryRow,moto,delivery,'delivery-001',null).includes('route_missing'),'rota da entrega removida');
pass(check('deliveries',deliveryRow,moto,delivery,'delivery-001',{...route,motoboy_id:'m-2'}).includes('wrong_motoboy'),'entrega de outro motoboy');
pass(check('stock',productRow,moto,product,'produto-123').includes('unauthorized_section'),'motoboy nao pode estoque, mesmo com permissao');
pass(check('routes',routeRow,buyer,route,'route-001').includes('unauthorized_section'),'compras nao pode rotas, mesmo com permissao');
pass(check('stock',productRow,buyer,null,'produto-123').includes('source_missing'),'produto apagado sinalizado');
pass(check('purchases',purchaseRow,buyer,{...purchase,status:'conferido'},'compra-123').includes('snapshot_diverged'),'compra desatualizada sinalizada');
pass(check('routes',{...routeRow,phone:'(34)99999-9999'},moto,route,'route-001').includes('unsafe_shape'),'campo extra rejeitado');
pass(check('routes',{...routeRow,title:'Email a@b.com'},moto,route,'route-001').includes('sensitive_pattern'),'dado sensivel nao vaza');
pass(check('routes',{...routeRow,status:'Errado'},moto,route,'route-001').includes('snapshot_diverged'),'status alterado detectado');
pass(check('home',{title:'X',subtitle:'telefone 34 99999-7777',status:'A'},moto,null,'overview').includes('sensitive_pattern'),'home escaneada sem ler origem');
pass(!p.mayHoldSection(moto,'purchases'),'motoboy nao pode compras');
pass(!p.mayHoldSection(buyer,'deliveries'),'compras nao pode entregas');
pass(!p.mayHoldSection({...moto,linkedMotoboyId:''},'routes'),'motoboy sem vinculo nao pode rotas');
pass(p.mayHoldSection(buyer,'stock'),'compras pode estoque');
pass(p.INTEGRITY_SAMPLE_LIMIT===12 && p.INTEGRITY_SOURCE_READ_BUDGET<=75,'orcamento de leitura limitado');
pass(p.tallyFindings(['wrong_motoboy','wrong_motoboy','source_missing']).wrong_motoboy===2,'contagem de riscos');
const routeFile=read(api);
for(const s of [
 'verifyIdToken(header.slice(7),true)', 'isSuperadminUid', 'safeUid(uid)', "collection('staff_accounts').doc(uid)",
 'INTEGRITY_SAMPLE_LIMIT+1','INTEGRITY_SOURCE_READ_BUDGET', 'adminDb.collection(collection).doc(id).get()',
 'assessProjection(area,data,account,original,row.id,route)','memo.set(key,pending)',
 "verification:'sample_only'", 'eligibleForActivation:false', "rulesProduction:'not_checked'",
 "'private, no-store, max-age=0'",'READ_BUDGET_EXCEEDED',
 ])pass(routeFile.includes(s),'Servidor com contrato '+s);
pass(!/\bPOST\(|\bPUT\(|\bPATCH\(|\bDELETE\(|runTransaction\(|writeBatch\(|\b(?:batch|tx|ref)\.(?:set|update|delete)\(/.test(routeFile),'API sem mutacao de Firestore');
pass(!/\.collection\('customers'\)|\.collection\('finance'\)|\.collection\('store'\)/.test(routeFile),'Sem leituras de clientes ou financeiro global');
const front=read(page),rdy=read(readiness),c=read(client);
for(const s of ['inspectStaffIntegrity(uid)','report.totals.alerts','report.totals.truncatedAreas','findingName','staffTouch','toast.success','toast.error','sample_only','eligibleForActivation']){
  // eligibleForActivation pertence ao contrato server, UI explicita nao habilitacao em texto.
  if(s!=='eligibleForActivation')pass(front.includes(s),'Experiencia premium '+s);
}
pass(front.includes('Não libera funcionários'),'Mensagem de bloqueio de ativacao presente');
pass(!/onSnapshot\(|setInterval\(/.test(front),'Sem listeners ou polling na auditoria');
pass(rdy.includes("router.push(`/mais/acessos/integridade?uid=${encodeURIComponent(account.uid)}`)"),'Link por conta na prontidao');
pass(rdy.includes('Auditar projeções'),'Acao visivel no painel');
for(const s of ['getIdToken(true)','credentials:\'omit\'','cache:\'no-store\'','encodeURIComponent(uid)','data.uid!==uid'])pass(c.includes(s),'Cliente seguro '+s);
pass(read('scripts/pre-apk.cjs').includes("'scripts/verify-v111-r33-integrity.cjs'"),'Suite R33 registrada');
pass(read('security/firestore.v111-r26-candidate.rules').includes('allow create, update, delete: if false;'),'Regras candidatas sem escrita de funcionarios');
console.log(`R33: ${checks} checagens aprovadas — integridade limitada, sem ativacao e sem escrita.`);
