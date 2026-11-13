#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require(require.resolve('typescript',{paths:[process.cwd()]}));
const helperPath='lib/operation/delivery-registration-feedback.ts';
const pagePath='app/entregas/nova/page.tsx';
const source=fs.readFileSync(helperPath,'utf8');
const page=fs.readFileSync(pagePath,'utf8');
const ast=ts.createSourceFile(helperPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const pageAst=ts.createSourceFile(pagePath,page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,'helper TypeScript AST');
assert.equal(pageAst.parseDiagnostics.length,0,'tela TSX AST');
const compiled=ts.transpileModule(source,{fileName:helperPath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sandboxExports={};vm.runInNewContext(compiled,{exports:sandboxExports,require:()=>{throw Error('helper must be pure')}},{timeout:1500});
const classify=sandboxExports.deliveryRegistrationBusinessFeedback;
let checks=0;const ok=(x,msg)=>{assert.ok(x,msg);checks++};
for (const msg of [
  'Este pedido já foi importado. Abra a entrega existente.',
  'Um dos pedidos deste lote já foi importado. Revise os IDs antes de salvar.',
  'Pedido já registrado no Firestore por outro aparelho. Sincronize antes de continuar.',
]) {
  const result=classify(msg,'ifood');
  ok(result && result.kind==='duplicate' && result.title.includes('iFood'),'iFood duplicate classified: '+msg);
  ok(!result.description.includes('Firebase')&&!result.description.includes('preparacao'),'no generic Firebase for duplicate');
}
ok(classify('Este pedido ja esta sendo registrado. Aguarde a confirmacao.','ifood')?.kind==='in_progress','registration in flight separate');
ok(classify('Lote de importação com IDs repetidos ou inválidos. Confira os pedidos.','ifood')?.kind==='invalid_batch','invalid batch not misclassified duplicate');
ok(classify('99Food precisa de numero comercial de seis digitos e data valida.','food99')?.kind==='business','99Food business reason preserved');
ok(classify('Keeta precisa de numero comercial valido e data de criacao.','keeta')?.kind==='business','Keeta business reason preserved');
ok(classify('Pedido cancelado não pode ser importado como entrega ativa.','ifood')?.kind==='business','canceled business reason preserved');
for (const msg of ['','Firebase: Missing or insufficient permissions','NetworkError when attempting to fetch resource','X'.repeat(1001)])
  ok(classify(msg,'ifood')===null,'unexpected errors not disguised as duplicate');
for (const phrase of [
  "import { deliveryRegistrationBusinessFeedback } from '@/lib/operation/delivery-registration-feedback';",
  "const businessFeedback = deliveryRegistrationBusinessFeedback(rawMessage,origin);",
  "toast.error(businessFeedback?.title ?? 'Não foi possível cadastrar a entrega.'",
  "const knownIfoodIds = new Set(deliveries.filter(item => item.origin === 'ifood')",
  "return normalizedId.length === 8 && knownIfoodIds.has(normalizedId);",
  "showFormIssue('order', 'Este ID iFood já foi cadastrado.",
  "registrationStage='pedido';\n        try {\n          await addDeliveries(deliveriesToCreate);",
  'void updateDelivery(stopSource.id, { stop_group_id: stopGroupId }).catch(',
  '!isCancelledSiteDelivery(candidate)',
  '!isCancelledSiteDelivery(sameStopSource)',
  "await addDelivery({",
])ok(page.includes(phrase),'page contract '+phrase.slice(0,48));
ok(!page.includes('const knownBusinessError = /^(Este pedido já foi importado'),'obsolete generic handler removed');
ok(page.indexOf('const knownIfoodIds') < page.indexOf('submitFlight.current = true;'),'pre-check before any save attempt');
ok(page.indexOf("registrationStage='pedido';\n        try {\n          await addDeliveries") < page.indexOf('await addDeliveries(deliveriesToCreate);'),'correct stage prior to batch write');
ok(!/(?:fetch\(|getDocs\(|setDoc\(|onSnapshot\()/.test(source),'classifier pure, no I/O');
console.log(`R68 FIX1 ID IFOOD: ${checks} contratos hermeticos OK; sem Firestore, sem envio.`);
