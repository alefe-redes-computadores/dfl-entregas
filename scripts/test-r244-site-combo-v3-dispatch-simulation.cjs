'use strict';
/** R244 Gate E: matriz de isolamento por pedido e integridade de bobina. SEM I/O real. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
let n=0;
const ok=(v,msg)=>{assert.ok(v,'R244 '+msg);n++};
const eq=(a,b,msg)=>{assert.equal(a,b,'R244 '+msg);n++};
const nope=(fn,re,msg)=>{assert.throws(fn,re,'R244 '+msg);n++};
const read=p=>fs.readFileSync(p,'utf8');
function load(path, allowed={}) {
 const input=read(path);
 const ast=ts.createSourceFile(path,input,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS parser '+path);
 const t=ts.transpileModule(input,{fileName:path,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 ok(!(t.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'TS transpile '+path);
 const module={exports:{}};
 vm.runInNewContext(t.outputText,{exports:module.exports,module,
  require:id=>{if(!Object.hasOwn(allowed,id))throw Error('IMPORT_NOT_ALLOWED '+id);return allowed[id];}},
  {filename:path,timeout:1500});
 return module.exports;
}
const modelLib=load('lib/integration/site-combo-v3-certification.ts');
const thermal=load('lib/integration/site-combo-v3-thermal-preview.ts');
const dispatch=load('lib/integration/site-combo-v3-dispatch-simulation.ts',{'./site-combo-v3-thermal-preview':thermal});
const raw=JSON.parse(read('scripts/fixtures/r243-site-r249-certification-only.json'));
const input=JSON.stringify(raw);
const model=modelLib.inspectSiteComboV3Candidate(raw);
const batch=dispatch.makeSiteV3Simulation(model);
eq(JSON.stringify(raw),input,'fixture imutavel');
eq(dispatch.SITE_V3_DISPATCH_SIMULATION_ONLY,true,'somente demo');
eq(dispatch.SITE_V3_DISPATCH_PRODUCTION_ENABLED,false,'producao continua OFF');
eq(batch.kind,'simulated_only','estado nao operacional');
for(const cap of ['canCreateDelivery','canSendMessage','canPrint','canPersist'])eq(batch[cap],false,'cap OFF '+cap);
eq(batch.noAutoMerge,true,'sem mesclagem por endereco');
eq(batch.orders.length,2,'dois pedidos distintos');
const [first,second]=batch.orders;
eq(first.address,second.address,'mesmo endereco');
ok(first.customer!==second.customer,'clientes distintos');
ok(first.code!==second.code,'codigos distintos');
ok(first.code.startsWith('DEMO-')&&second.code.startsWith('DEMO-'),'nenhum ID real');
eq(batch.routeCards.length,2,'um card por pedido');
ok(batch.routeCards[0].includes(first.code)&&!batch.routeCards[0].includes(second.code),'primeiro card isolado');
ok(batch.routeCards[1].includes(second.code)&&!batch.routeCards[1].includes(first.code),'segundo card isolado');
eq(dispatch.assertSimulationIsolated(batch),true,'gate de isolamento');
ok(batch.operatorNotes.length>model.unitCount,'operacao tem unidades detalhadas');
ok(batch.operatorNotes.some(line=>line.includes('SEM Cebola')),'remocao nao desaparece');
ok(batch.operatorNotes.some(line=>line.includes('+ Bacon')),'adicional nao desaparece');
ok(batch.operatorNotes.some(line=>line.includes('OBS: ')),'observacoes de unidade preservadas');
ok(batch.operatorNotes.some(line=>line.includes('Kuat 2 L')),'bebida preservada');
ok(batch.driverPreview[0].includes('NAO ENVIAR'),'mensagem nao autoriza envio');
ok(batch.driverPreview.filter(line=>line.startsWith('PEDIDO ')).length===2,'um cabecalho motoboy por pedido');
for(const order of batch.orders){
 for(const width of [58,80]){
  const lines=dispatch.simulatedDispatchReceipt(order,width);
  const cols=width===58?30:42;
  ok(lines.every(l=>thermal.printedColumns(l)<=cols),`limite ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes(order.code)),`codigo ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes(order.customer)),`cliente ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes('NAO IMPRIMIR')),`seguranca ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes('Kuat 2 L')),`bebida ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes('SEM Cebola')),`remocao ${width}mm ${order.code}`);
  ok(lines.some(l=>l.includes('Bacon')),`adicional ${width}mm ${order.code}`);
  ok(lines.some(l=>l.startsWith('FIM ')),`terminador ${width}mm ${order.code}`);
  const foreign=batch.orders.find(o=>o.code!==order.code);
  ok(lines.every(l=>!l.includes(foreign.code)),`nao mistura IDs ${width}mm ${order.code}`);
  const rebuilt=lines.filter(l=>/OBS:|^  /.test(l)).join('');
  ok(rebuilt.length>40,`conteudo observacoes ${width}mm ${order.code}`);
 }
}
nope(()=>dispatch.simulatedDispatchReceipt({...first,code:'12345'},58),/ORDER_IDENTITY/,'recibo com ID real proibido');
nope(()=>dispatch.simulatedDispatchReceipt({...first,address:'X\n123'},58),/ORDER_IDENTITY/,'endereco com controle bloqueado');
nope(()=>dispatch.simulatedDispatchReceipt(first,76),/WIDTH/,'largura nao suportada bloqueada');
for(const field of ['canPrint','canPersist','canCharge','canRelay']){
 const unsafe={...model,[field]:true};
 nope(()=>dispatch.makeSiteV3Simulation(unsafe),/UNSAFE_MODEL/,'modelo com capacidade ativada '+field);
 nope(()=>dispatch.simulatedDispatchReceipt({...first,model:unsafe},80),/UNSAFE_MODEL/,'bobina com capacidade ativada '+field);
}
nope(()=>dispatch.assertSimulationIsolated({...batch,canSendMessage:true}),/AUTHORIZATION/,'proibir envio em batch adulterado');
nope(()=>dispatch.assertSimulationIsolated({...batch,orders:[first,first]}),/ORDER_COLLISION/,'proibir repeticao de pedido');
nope(()=>dispatch.assertSimulationIsolated({...batch,orders:[first,{...second,address:'OUTRO ENDERECO'}]}),/IDENTITY_COLLISION/,'provar cenario comum');
const ui=read('components/integration/ComboV3DispatchSimulationPanel.tsx');
const ast=ts.createSourceFile('ComboV3DispatchSimulationPanel.tsx',ui,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TSX);
ok(ast.parseDiagnostics.length===0,'JSX sintaticamente valido');
ok(ui.includes('makeSiteV3Simulation')&&ui.includes('simulatedDispatchReceipt'),'tela usa modelo validado e simulacao');
ok(!/(?:fetch\(|onSnapshot\(|firebase|window\.open|href=.https|navigator\.share|navigator\.clipboard)/.test(ui),'tela sem rede nem envio');
const route=read('lib/integration/site-order.ts');
const storage=read('lib/integration/server/siteOrderPersistence.ts');
const endpoint=read('app/api/integration/events/route.ts');
for(const [name,body] of [['receiver',route],['persistence',storage],['endpoint',endpoint]]){
 ok(!body.includes('site-combo-v3-dispatch-simulation')&&!body.includes('ComboV3DispatchSimulationPanel'),name+' isolado do laboratorio');
}
ok(route.includes('legacySiteOrderCanPreserveContent(value)'),'receptor nao reabre V3');
const legacy=read('lib/integration/site-combo-unit-guard.ts');
ok(legacy.includes('SITE_COMBO_UNIT_PRODUCTION_SUPPORTED = false'),'guarda V3 continua OFF');
const diagnostics=read('app/mais/diagnostico/page.tsx');
ok(diagnostics.includes('if (!user || !isAdmin) return null'),'autorizacao admin preservada');
ok(diagnostics.includes('<ComboV3CertificationPanel />')&&diagnostics.includes('<ComboV3DispatchSimulationPanel />'),'duas areas de laboratorio preservadas');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r243-site-combo-v3-certification.cjs'")&&
  pre.includes("'scripts/test-r244-site-combo-v3-dispatch-simulation.cjs'"),'suites R243 e R244 no pre APK');
console.log(`R244 GATE E A2: ${n} verificacoes aprovadas; zero escrita, envio, print ou cliente real.`);
