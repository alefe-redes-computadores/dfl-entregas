#!/usr/bin/env node
'use strict';
/** R299 P13: regressões herméticas; zero rede, Firestore ou compras reais. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const ok=(condition,label)=>{assert.ok(condition,`R299 P13: ${label}`);checks++;};
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,`R299 P13: ${label}`);checks++;};
const read=p=>fs.readFileSync(p,'utf8');
const policyFile='lib/operation/stock-buy-review.ts';
const policySource=read(policyFile);
const parsed=ts.createSourceFile(policyFile,policySource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const transpile=ts.transpileModule(policySource,{fileName:policyFile,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
ok(parsed.parseDiagnostics.length===0,'AST de política válido');
ok(!(transpile.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'política transpila');
const moduleOut={exports:{}};
new Function('require','module','exports',transpile.outputText)(()=>{throw Error('A política é pura, sem importação em execução.');},moduleOut,moduleOut.exports);
const {stockBuyReview}=moduleOut.exports;
ok(typeof stockBuyReview==='function','função de conferência exportada');
const p=(extra={})=>({id:'c1',name:'Tomate',unit:'kg',current_quantity:0,minimum_quantity:3,ideal_quantity:5,active:true,presentations:[],...extra});
const normal=stockBuyReview(p(),{netNeed:5,surplusQuantity:0});
eq(normal.kind,'normal','estoque normal não é penalizado');
eq(normal.autoSelect,true,'compra normal pode ser pré-selecionada');
eq(stockBuyReview(p({name:'Salsicha',minimum_quantity:2,ideal_quantity:100})).autoSelect,false,'meta excessiva pede conferência');
eq(stockBuyReview(p({minimum_quantity:2,ideal_quantity:8})).autoSelect,true,'meta coerente não gera alarme');
eq(stockBuyReview(p({minimum_quantity:0,ideal_quantity:60})).autoSelect,false,'meta alta sem mínimo pede conferência');
eq(stockBuyReview(p({current_quantity:NaN})).autoSelect,false,'saldo inválido requer revisão');
eq(stockBuyReview(p({minimum_quantity:-2})).autoSelect,false,'mínimo negativo requer revisão');
eq(stockBuyReview(p({unit:'pct',presentations:[{id:'caixa',label:'Caixa',active:true,purchase_unit:'cx',conversion_quantity:156}]})).autoSelect,false,'caixa sobre pacote pede revisão sem inventar conversão');
eq(stockBuyReview(p({unit:'un',presentations:[{id:'caixa',label:'Caixa',active:true,purchase_unit:'cx',conversion_quantity:6}]})).autoSelect,true,'unidade-base com caixa real não é alarmada só pela embalagem');
eq(stockBuyReview(p(),{netNeed:2,surplusQuantity:18}).autoSelect,false,'arredondamento gera excesso exige revisão');
eq(stockBuyReview(p(),{netNeed:20,surplusQuantity:2}).autoSelect,true,'excesso pequeno de embalagem é normal');
const input=p({minimum_quantity:2,ideal_quantity:100}),snapshot=JSON.stringify(input);
stockBuyReview(input,{netNeed:95,surplusQuantity:0});
eq(JSON.stringify(input),snapshot,'análise jamais modifica cadastro');
const shopping=read('app/estoque/compras/page.tsx');
const stock=read('app/estoque/page.tsx');
const notif=read('app/mais/notificacoes/page.tsx');
const pre=read('scripts/pre-apk.cjs');
for(const piece of ["stockBuyReview(product, commercial)","const autoSuggested = useMemo(","const reviewNeeded = useMemo(","autoSuggested.map((product)","const freshSuggestions = autoSuggested.filter(","purchasePlan?.review.kind === 'review'","Conferência manual:","!query.trim()", "localeCompare(b.name,'pt-BR'",'Buscar produto para comprar']){
  ok(shopping.includes(piece),'compras preserva '+piece);
}
ok(stock.includes('const purchaseReview=useMemo(')&&stock.includes('Conferir meta ou embalagem')&&stock.includes('Abrir compra para revisar'),'Estoque mostra revisão da reposição');
ok(notif.includes('APK Android: os avisos locais exigem permissão')&&notif.includes('Mensageria WhatsApp e acompanhamento do Site possuem autorizações separadas.'),'notificações distinguem APK e mensageria');
ok(!/fetch\(|getDocs\(|onSnapshot\(|runTransaction\(|setDoc\(/.test(policySource),'política sem I/O nem listeners');
ok(pre.includes("'scripts/test-r299-p13-stock-shopping.cjs'")&&pre.includes("'scripts/test-r299-p12-route-atomic.cjs'")&&pre.includes("'scripts/test-r299-p11-intelligence-macro.cjs'")&&pre.includes("'scripts/test-r299-p10a-future-route.cjs'"),'PRE-APK conserva P10A–P12');
for (const f of ['app/estoque/compras/page.tsx','app/estoque/page.tsx','app/mais/notificacoes/page.tsx']) {
  const source=read(f),ast=ts.createSourceFile(f,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(ast.parseDiagnostics.length===0,'AST '+f);
}
console.log(`R299 P13: ${checks} verificações de compra, estoque, busca e notificações aprovadas.`);
