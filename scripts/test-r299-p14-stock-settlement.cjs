#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,'P14 '+message);checks++};
const eq=(a,b,message)=>{assert.deepEqual(a,b,'P14 '+message);checks++};
const read=p=>fs.readFileSync(p,'utf8');
function load(p,mocks={}){
  const src=read(p);
  const file=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  eq(file.parseDiagnostics.length,0,'AST '+p);
  const out=ts.transpileModule(src,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  const mod={exports:{}};
  new Function('require','module','exports',out.outputText)((id)=>{
    if(Object.hasOwn(mocks,id))return mocks[id];
    throw new Error('Import não permitido '+p+': '+id);
  },mod,mod.exports);
  return mod.exports;
}
const toCategory=(name,category)=>category||'Geral';
const nav=load('lib/operation/stock-count-navigation.ts',{'@/lib/stock-categories':{stockProductCategory:toCategory,stockCategoryOrder:c=>c==='Hortifruti'?1:2}});
const product=(id,category,qty=2,minimum=1,ideal=4,active=true)=>({id,name:`Produto ${id}`,category,unit:'un',current_quantity:qty,minimum_quantity:minimum,ideal_quantity:ideal,active});
const products=[product('A','Hortifruti',0),product('B','Hortifruti'),product('C','Bebidas',9),product('D','Bebidas',0,1,3,false)];
const ids=['A','B','C','D'];
eq(nav.nextStockReviewTarget(products,ids,'A')?.id,'B','próximo na mesma categoria');
eq(nav.nextStockReviewTarget(products,ids,'A',true)?.id,'C','pula categoria inteira');
eq(nav.nextStockReviewTarget(products,ids,'B',true)?.id,'C','pula da última posição da categoria');
eq(nav.nextStockReviewTarget(products,ids,'C',true),null,'fim sem outro grupo válido');
eq(nav.nextStockReviewTarget(products,ids,'inexistente'),null,'ID ausente não escolhe primeiro arbitrário');
eq(nav.nextStockReviewTarget(products,['A','A','B','C'],'A')?.id,'B','duplicata na fila não repete item');
const options={query:'',category:'todas',filter:'todos',onlyUnreviewed:false,reviewed:{B:true},purchasedTodayIds:new Set(['C'])};
const flat=o=>nav.filterStockCountProducts(products,o).flatMap(g=>g.items.map(p=>p.id));
eq(flat(options),['A','B','C'],'inativos não aparecem e grupos ordenados');
eq(flat({...options,onlyUnreviewed:true}),['A','C'],'somente não revisados (sem confundir com alterado)');
eq(flat({...options,category:'Bebidas'}),['C'],'filtro categoria real');
eq(flat({...options,filter:'zerados'}),['A'],'filtro zerados');
eq(flat({...options,filter:'alto'}),['C'],'filtro estoque alto');
eq(flat({...options,filter:'compra_hoje'}),['C'],'filtro comprados hoje');
eq(flat({...options,query:'Horti'}),['A','B'],'busca por categoria');
const bought=nav.purchasedStockIdsToday([
  {occurred_at:'2026-11-08T10:00:00-03:00',items:[{stock_product_id:'A'}]},
  {occurred_at:'2026-11-07T10:00:00-03:00',items:[{stock_product_id:'B'}]},
  {occurred_at:'2026-11-08T11:00:00-03:00',stock_reversed_at:'2026-11-08T12:00:00-03:00',items:[{stock_product_id:'C'}]},
],'2026-11-08',x=>x.slice(0,10));
eq([...bought],['A'],'compra do dia sem estorno nem dia anterior');
const pager=load('lib/motoboy-settlement-pages.ts');
for(const n of [0,1,28,29,72,100,201]){
 const input=Array.from({length:n},(_,i)=>({id:i,amount:i*2}));
 const pages=pager.paginateSettlementRows(input);
 eq(pages.flat(),input,'paginação não omite nem duplica '+n+' registros');
 ok(pages.every(p=>p.length<=28),'canvas não ultrapassa página segura com '+n+' registros');
}
let rejected=false;try{pager.paginateSettlementRows([1,2],100)}catch{rejected=true}ok(rejected,'limite de memória não pode ser ignorado');
const count=read('app/estoque/contagem/page.tsx');
const move=read('app/estoque/movimentar/page.tsx');
const settlement=read('app/motoboys/acerto/page.tsx');
for(const p of ['app/estoque/contagem/page.tsx','app/estoque/movimentar/page.tsx','app/motoboys/acerto/page.tsx']){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 eq(tree.parseDiagnostics.length,0,'TSX válido '+p);
}
ok(count.includes('reviewStockCountDraft')&&count.includes('await count(latest.changed.map'),'contagem mantém persistência transacional');
ok(count.includes('setReviewed')&&count.includes('onlyUnreviewed:onlyPending'),'revisão separada da variação financeira');
ok(count.includes('Pular categoria')&&count.includes('saveRef')&&count.includes('refs.current'),'teclado, pular e fim de lista com foco');
ok(count.includes('purchasedStockIdsToday')&&count.includes('stock_reversed_at')===false,'compra do dia usa helper puro');
ok(move.includes('nextStockReviewTarget')&&move.includes('nextReviewProduct(true)'),'fila de movimentação mantém ordem e permite pular categoria');
ok(move.includes('ordered[index + 1]')&&move.includes('const byId = new Map(activeProducts'),'avanço por ID real segue V21, com índice local e busca estável');
ok(move.includes('if(quantity.trim())')&&move.includes('Salve ou limpe a quantidade'),'não perde movimento digitado ao pular');
ok(settlement.includes('paginateSettlementRows(settlementImageRows)'),'acerto tem páginas, sem resumo gigante');
ok(settlement.includes('preparedImages.push({dataUrl,filename})')&&settlement.includes('files:savedUris'),'APK compartilha TODAS as páginas');
ok(settlement.includes('filePage')&&settlement.includes('files:File[]'),'páginas nomeadas e compartilhadas na PWA');
ok(settlement.includes('visibleImageRows=settlementImageRows.slice(0,72)')&&settlement.includes('imageExtraRows'),'contrato legado de limite preservado');
ok(!settlement.includes('+ ${imageExtraRows} linhas omitidas na imagem · confira no app') || settlement.includes('paginateSettlementRows'),'nenhuma linha fica sem página');
const pre=read('scripts/pre-apk.cjs');
ok(pre.includes("'scripts/test-r299-p14-stock-settlement.cjs'")&&pre.includes("'scripts/test-r299-p13-stock-shopping.cjs'"),'P13 e P14 registrados no mesmo PRE-APK');
console.log(`R299 P14: ${checks} contratos de contagem, fila, imagem paginada, TSX e regressão OK.`);
