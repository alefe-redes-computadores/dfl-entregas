// V108: regressões funcionais com execução das funções puras.
// Não requer Firebase, navegador, node_modules do aplicativo ou rede.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const ts=require('typescript');
const originalResolve=Module._resolveFilename;
const root=process.cwd();
Module._resolveFilename=function(request,parent,isMain,options){
  if(request.startsWith('@/'))return originalResolve.call(this,path.join(root,request.slice(2))+'.ts',parent,isMain,options);
  return originalResolve.call(this,request,parent,isMain,options);
};
Module._extensions['.ts']=function(mod,filename){
  const raw=fs.readFileSync(filename,'utf8');
  const result=ts.transpileModule(raw,{fileName:filename,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
  const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,`${filename}: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' '))}`);
  mod._compile(result.outputText,filename);
};
const stock=require('../lib/stock-intelligence.ts');
const daily=require('../lib/stock-daily-plan.ts');
const shop=require('../lib/stock-shopping.ts');
const now=new Date('2026-10-18T12:00:00-03:00');
function prod(id){return {id,name:'Produto '+id,unit:'un',category:'Mercearia',current_quantity:8,minimum_quantity:4,ideal_quantity:15,lead_time_days:2,active:true,presentations:[]};}
const products=[prod('a'),prod('b'),prod('c')];
const moves=[
  {product_id:'a',type:'saida',quantity:2,occurred_at:'2026-10-17T12:00:00-03:00',reason:'Venda'},
  {product_id:'b',type:'saida',quantity:3,occurred_at:'2026-10-17T18:00:00-03:00',reason:'Consumo'},
  {product_id:'a',type:'saida',quantity:1,occurred_at:'2026-10-11T12:00:00-03:00',reason:'Consumo'},
  {product_id:'a',type:'entrada',quantity:9,occurred_at:'2026-10-17T11:00:00-03:00',reason:'Entrada'},
  {product_id:'b',type:'saida',quantity:4,occurred_at:'2026-10-16T10:00:00-03:00',reason:'Estorno de contagem'},
  {product_id:'c',type:'saida',quantity:1,occurred_at:'2026-09-17T12:00:00-03:00',reason:'Venda'},
];
const old=products.map(product=>stock.buildStockRecommendation(product,moves,now));
const indexed=stock.buildStockRecommendations(products,moves,now);
assert.deepEqual(indexed,old,'Indexação não pode modificar recomendação nem amostra');
const index=new Map(products.map(product=>[product.id,moves.filter(m=>m.product_id===product.id)]));
for(let i=0;i<products.length;i++){
  const before=daily.buildDailyStockSignal(products[i],moves,now);
  const after=daily.buildDailyStockSignal(products[i],index.get(products[i].id),now,indexed[i]);
  assert.deepEqual(after,before,`Plano do dia divergente no produto ${products[i].id}`);
}
assert.deepEqual(stock.stockIntelligenceSummary(products,moves,indexed),stock.stockIntelligenceSummary(products,moves));
const supplies=[
  {id:'s1',occurred_at:'2026-10-15T11:00:00-03:00',stock_integrated_at:'2026-10-15',items:[{stock_product_id:'a',quantity:2,unit_price:5,total_price:10},{stock_product_id:'b',quantity:4,unit_price:6,total_price:24}]},
  {id:'s2',occurred_at:'2026-10-14T11:00:00-03:00',stock_integrated_at:'2026-10-14',items:[{stock_product_id:'a',quantity:5,unit_price:8,total_price:40}]},
  {id:'s3',occurred_at:'2026-10-13T11:00:00-03:00',stock_integrated_at:'2026-10-13',stock_reversed_at:'2026-10-16',items:[{stock_product_id:'a',quantity:1,unit_price:500,total_price:500}]},
  {id:'s4',occurred_at:'2026-10-12T11:00:00-03:00',items:[{stock_product_id:'a',quantity:1,unit_price:30,total_price:30}]},
];
const priceIndex=shop.indexShoppingPriceHistory(supplies);
for(const product of products){
  for(const price of [0,2,5,12]){
    assert.deepEqual(shop.shoppingPriceSignal(product,supplies,price,priceIndex),shop.shoppingPriceSignal(product,supplies,price));
  }
}
const dashboard=fs.readFileSync('hooks/useStoreDashboard.ts','utf8');
const modal=fs.readFileSync('components/store/PerformanceModals.tsx','utf8');
const page=fs.readFileSync('app/estoque/page.tsx','utf8');
assert.match(dashboard,/key === selectedDateKey && !isCancelledSiteDelivery\(delivery\)/);
assert.match(dashboard,/deliveryEconomicValue\(order\)/);
assert.match(modal,/if\(isCancelledSiteDelivery\(item\)\)return false/);
assert.match(modal,/filteredTotals=useMemo/);
assert.match(modal,/const visibleRows=rows\.slice\(0,visibleLimit\)/);
assert.match(modal,/Mostrar mais lançamentos/);
assert.match(modal,/setVisibleLimit\(40\)/);
assert.match(page,/movementsByProduct\.get\(product\.id\)/);
assert.match(page,/stockIntelligenceSummary\(active,movements,recommendations\)/);
const shoppingUI=fs.readFileSync('components/stock-supplies/ShoppingSession.tsx','utf8');
assert.match(shoppingUI,/indexShoppingPriceHistory\(supplies\)/);
assert.match(shoppingUI,/confirmedTotal = items\.reduce/);
assert.match(shoppingUI,/Lista completa · estimativa/);
const traceUI=fs.readFileSync('components/diagnostics/MessageTraceCard.tsx','utf8');
assert.match(traceUI,/Etapas da comunicação/);
assert.match(traceUI,/WhatsApp.*Não verificado/s);
assert.doesNotMatch(traceUI,/setInterval\(/);
for(const file of ['app/estoque/page.tsx','hooks/useStoreDashboard.ts','components/store/PerformanceModals.tsx','components/stock-supplies/ShoppingSession.tsx','components/diagnostics/MessageTraceCard.tsx','lib/stock-intelligence.ts','lib/stock-daily-plan.ts','lib/stock-shopping.ts']){
 const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.Preserve}});
 assert.equal((result.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error).length,0,file);
}
console.log('V108 ESTOQUE/COMPRAS/EXTRATO: equivalência de cálculo, filtros, paginação e sintaxe OK');
