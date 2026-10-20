const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const read = p => fs.readFileSync(p,'utf8');
const load = (filename, mocks={}) => {
 const js=ts.transpileModule(read(filename),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod=new Module(filename,module);mod.filename=process.cwd()+'/'+filename;mod.paths=module.paths;
 mod.require=id=>{if(Object.hasOwn(mocks,id))return mocks[id];return require(id)};
 mod._compile(js,mod.filename);return mod.exports;
};
const search=load('lib/stock-search.ts');
const suppliers=load('lib/stock-supplier-insights.ts',{'@/lib/stock-search':search});
const shopping=load('lib/stock-shopping-session-state.ts');
const supply=(id,date,status,name,items,supplierId)=>({id,occurred_at:date,status,items,supplier:name,supplier_id:supplierId});
const item=(product='ovo',quantity=10,presentation='cartela',price=12)=>({id:'a',name:'Ovo',stock_product_id:product,presentation_id:presentation,purchase_unit:'cx',unit:'un',purchase_quantity:quantity,conversion_quantity:30,quantity:quantity*30,purchase_unit_price:price,total_price:price*quantity});
const history=[
 supply('old','2026-10-01T14:00:00Z','recebido','Mercadão',[item('ovo',1,'cartela',20)]),
 supply('new','2026-10-09T14:00:00Z','conferido','Mercadao',[item('ovo',2,'cartela',18),item('tomate',3,'caixa',40)]),
 supply('other','2026-10-15T14:00:00Z','recebido','Loja vizinha',[item('ovo',1,'cartela',7)]),
 supply('pending','2026-10-16T14:00:00Z','solicitado','Mercadão',[item('ovo',1,'cartela',6)]),
];
const result=suppliers.supplierPurchaseInsights(history,'','mercadao');
const key=suppliers.supplierPriceKey(item());
assert.equal(result.latestPrices.get(key).price,18,'preço mais recente comparável, sem pendente');
assert.equal(result.preferredProductIds[0],'ovo','preferência por recorrência real');
assert.equal(suppliers.supplierPurchaseInsights(history,'','Mercadão','new').latestPrices.get(key).price,20,'edição ignora o próprio documento');
assert.equal(suppliers.supplierPurchaseInsights(history,'store-id','Mercadão').latestPrices.size,0,'id protege fornecedores homônimos');
assert.notEqual(suppliers.supplierPriceKey({...item(),conversion_quantity:12}),key,'não misturar cartela de 12 e de 30');
assert.equal(suppliers.supplierPriceKey({...item(),conversion_quantity:0}),null,'fator inválido rejeitado');
console.log('R11 fornecedores: 6 contratos de preço, histórico, ID e conversão');
const eggs=item();const sauce={...item('ketchup',2,'bisnaga',23),id:'b'};
const v1=shopping.reconcileShoppingDraft([eggs,sauce],{checked:{a:true,b:true},prices:{a:'R$ 18,00',b:'R$ 23,00'},signatures:{a:shopping.shoppingItemSignature(eggs),b:shopping.shoppingItemSignature(sauce)}},{a:'R$ 20,00',b:'R$ 30,00'});
assert.equal(v1.checked.a,true);assert.equal(v1.prices.a,'R$ 18,00');
const changed={...eggs,quantity:330,purchase_quantity:11};
const v2=shopping.reconcileShoppingDraft([changed,sauce],v1,{a:'R$ 20,00',b:'R$ 30,00'});
assert.equal(v2.checked.a,false,'alterar quantidade reabre a conferência');
assert.equal(v2.checked.b,true,'outros itens continuam conferidos');
assert.equal(v2.prices.a,'R$ 18,00','preço digitado permanece quando quantidade muda');
assert.equal(Object.keys(shopping.reconcileShoppingDraft([sauce],v1,{}).checked).length,1,'item removido não ressuscita');
assert.equal(shopping.reconcileShoppingDraft([eggs],{checked:{a:true},prices:{a:'x'.repeat(100)}},{a:'R$ 20,00'}).prices.a,'R$ 20,00','preço externo longo rejeitado');
assert.equal(shopping.reconcileShoppingDraft([eggs],{checked:{a:true},prices:{}},{a:'R$ 20,00'}).checked.a,true,'rascunho legado recuperável');
console.log('R11 conferência: 8 contratos de revisão, rascunho, preço e migração');
assert.equal(search.rankStockProducts([{id:'1',name:'Tomate Italiano',category:'Hortifruti'}],'tomte')[0].id,'1');
assert.equal(search.stockSearchScore({name:'x'.repeat(2000),category:'Teste'},'compra'),0);
console.log('R11 busca: 2 contratos de fuzzy limitado e compatibilidade');
const form=read('components/stock-supplies/StockSupplyForm.tsx');
const session=read('components/stock-supplies/ShoppingSession.tsx');
const pricing=read('lib/stock-shopping.ts');
assert(form.includes('supplierPurchaseInsights(historicalSupplies')&&form.includes('recommendationsById.get(product.id)'),'índice compartilhado evita trabalho N×M');
assert(session.includes('pagehide')&&session.includes('setTimeout(persist, 250)'),'rascunho protegido em navegação e IO moderado');
assert(session.includes('finishInFlight.current = true')&&session.includes('await onFinish(items);'),'autoridade transacional e idempotência preservadas');
assert(session.includes('if (completedSessionRef.current === supply.id) return;'),'finalização não ressuscita o rascunho em atualização do pedido');
assert(pricing.includes('rows.slice(0,40)')&&pricing.includes('values.reduce('),'sinal de preço bounded, sem spread gigante');
console.log('R11 integração: 5 contratos de performance, integridade e preço');
