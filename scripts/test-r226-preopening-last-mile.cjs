#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks=0;
const read=p=>fs.readFileSync(p,'utf8');
const ok=(v,name)=>{assert.ok(v,'R226: '+name); checks++; console.log('OK R226:',name)};
const components=[
  'app/estoque/compras/page.tsx',
  'components/stock-supplies/StockSupplyForm.tsx',
  'components/stock-supplies/StockProductPicker.tsx',
  'components/stock-supplies/StockSupplierPicker.tsx',
  'components/stock/StockCategoryPicker.tsx',
];
for(const f of components){
  const code=read(f);
  const tree=ts.createSourceFile(f,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(!tree.parseDiagnostics.length,`JSX válido ${f}: ${tree.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
  ok(code.includes('max-h-[calc(100dvh-') && code.includes('env(safe-area-inset-bottom)'),`viewport e safe area ${f}`);
  ok(code.includes('overflow-y-auto'),`rolagem disponível ${f}`);
  ok(code.includes('createPortal('),`modal fora de ancestral transformado ${f}`);
  ok(code.includes('document.body'),`portal da camada raiz ${f}`);
}
const buy=read(components[0]);
ok(buy.includes('leavePrompt && typeof document') && buy.includes('Sair e salvar') && buy.includes('Continuar compra'),'sair da lista ainda oferece rascunho e retorno');
ok(buy.includes('purchaseCommitted.current') && buy.includes('purchaseDraftSnapshotRef'),'rascunho de compra preservado');
const form=read(components[1]);
ok(form.includes('const assignedProductIds = useMemo('),'índice memorizado de itens da compra');
ok(form.includes('!assignedProductIds.has(candidate.id)'),'filtro O(1) por candidato e item atual preservado');
ok(!form.includes('!items.some('),'não varrer toda a lista de itens para cada produto');
ok(form.includes('leaveOpen && typeof document') && form.includes('Salvar rascunho e sair') && form.includes('Descartar alterações'),'formulário conserva três saídas sem descartar silenciosamente');
ok(form.includes('submitInFlight') && form.includes('disabled={busy || submitting}'),'não duplicar compra');
const picker=read(components[2]);
ok(picker.includes('createBusyRef.current') && picker.includes('Cadastrar e usar na compra'),'seleção de produto preserva proteção de cadastro');
const supplier=read(components[3]);
ok(supplier.includes('saving') && supplier.includes('Cadastrar fornecedor') && supplier.includes('setCreating(false)'),'fornecedor conserva persistência e retorno');
const category=read(components[4]);
ok(category.includes('mounted && open && createPortal('),'categoria só monta portal quando disponível');
const store=read('store/useAppStore.ts');
for(const token of [
  "addStockMovement: async (movement) => {",
  "result = await runTransaction(db, async (transaction) => {",
  "transaction.get(productRef), transaction.get(movementRef)",
  "transaction.update(productRef, sanitizeForFirebase(plan.changed))",
  "transaction.set(movementRef, sanitizeForFirebase(plan.record))",
  "addStockSupply: async (supply) => {",
  "await trackStockSupplyWrite(next.id, operation)",
  "assertRemoteDeliveryTransition(",
])ok(store.includes(token),'integridade existente preservada: '+token.slice(0,64));
const v92=read('scripts/verify-v92-premium-forms.cjs');
ok(v92.includes('max-h-[calc(100dvh-24px)]') && v92.includes("'createPortal('") && !v92.includes('max-h-[92dvh]'),'V92 atualizada sem abrir mão da segurança do modal');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r226-preopening-last-mile.cjs'"),'R226 integrada ao PRE-APK');
for(const p of [
  'scripts/test-r225-stock-premium.cjs','scripts/test-r224-final-closeout.cjs',
  'scripts/test-v112-r95-remote-authority.cjs','scripts/test-v112-r94-delivery-concurrency.cjs',
  'scripts/test-r221-mobile-route-ux.cjs','scripts/test-r220-urgent-ux.cjs',
])ok(pre.includes(`'${p}'`),`regressão histórica preservada: ${p}`);
ok(!pre.includes('ONLY_R226_TESTS'),'sem suprimir suítes antigas');
console.log(`R226 FECHAMENTO: ${checks} contratos aprovados (sem rede, sem escrita).`);
