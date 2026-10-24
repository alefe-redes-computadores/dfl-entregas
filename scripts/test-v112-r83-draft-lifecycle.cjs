#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const files={
  purchase:'app/estoque/compras/page.tsx',
  form:'components/stock-supplies/StockSupplyForm.tsx',
  session:'components/stock-supplies/ShoppingSession.tsx',
};
for(const [name,p] of Object.entries(files)){
  const text=read(p);
  const ast=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length,0,'TSX integro: '+p);
  assert.ok(text.length>8000,'arquivo nao truncado: '+p);
  console.log('OK: sintaxe e integridade '+name);
}
const purchase=read(files.purchase),form=read(files.form),session=read(files.session);
const requirePart=(file,fragment,label)=>{assert.ok(file.includes(fragment),label);console.log('OK: '+label)};
requirePart(purchase,'purchaseDraftSnapshotRef.current = { selected, quantities, presentationIds }','snapshot de embalagens e quantidades sempre atual');
requirePart(purchase,"window.addEventListener('pagehide', onPageHide)",'lista salva em pagehide');
requirePart(purchase,"document.visibilityState === 'hidden'",'lista salva em pausa Android');
requirePart(purchase,'persistPurchaseDraft(true);\n    if (!claimSubmission(purchaseSubmitLock))','ultimo rascunho guardado antes da escrita remota');
requirePart(purchase,'purchaseCompletedRef.current = true','sucesso remoto impede recriar rascunho');
requirePart(purchase,"try { window.localStorage.removeItem(STOCK_PURCHASE_DRAFT_KEY); }",'falha do storage isolada do sucesso Firestore');
requirePart(purchase,'draftStorageFailed &&','quota/localStorage falha comunicada');
requirePart(purchase,'invalidStockPurchaseSelections(','quantidade invalida continua bloqueada');
requirePart(purchase,'normalizeTypedPurchaseQuantity(','compra em unidade comercial intacta');
requirePart(purchase,'const purchaseSubmitLock = useRef(false)','trava de toque duplo intacta');
requirePart(form,'currentFormDraftRef.current = formDraft','snapshot de formulario atualizado');
requirePart(form,'isDirtyRef.current = dirty','somente alteracoes sao persistidas na pausa');
requirePart(form,'remotePurchaseSavedRef.current = true;','nao ressuscita compra ja salva');
requirePart(form,"window.addEventListener('pagehide', flush)",'form completo salva na pausa Android');
requirePart(form,'await onSubmit({','autoridade transacional original preservada');
requirePart(form,'submitInFlight.current = true','trava de submissao preservada');
requirePart(form,'itemErrors[item.id]','validacao de unidades e quantidades preservada');
requirePart(session,'draftSnapshotRef.current = draft','conferencia nao grava fechamento atrasado');
requirePart(session,'JSON.stringify(draftSnapshotRef.current)','ultima edicao persistida');
requirePart(session,"document.visibilityState === 'hidden'",'conferencia nao grava ao voltar para foreground');
requirePart(session,'shoppingSupplySignature(supply.items), [supply.items]','assinatura de itens memoizada');
requirePart(session,'<details className="mt-2 rounded-xl border','analise de custos recolhivel por item');
requirePart(session,'buildStockCheckoutPreview(items, productById)','projecao de custo preservada');
requirePart(session,'await onFinish(items);','nenhum estoque e integrado antes da confirmacao');
requirePart(session,'finishInFlight.current = true','finalizacao sem toque duplo');
requirePart(session,'completedSessionRef.current = supply.id','nao restaura checklist finalizado');
requirePart(session,'if (completedSessionRef.current === supply.id) return;','debounce atrasado nao recria rascunho finalizado');
for(const [name,code] of Object.entries({purchase,form,session})) {
  assert.ok(!/\bonSnapshot\s*\(|\bgetDocs\s*\(|\brunTransaction\s*\(/.test(code),'sem consultas remotas extras: '+name);
}
console.log('R83 DRAFTS ANDROID: 26 contratos de protecao aprovados.');
