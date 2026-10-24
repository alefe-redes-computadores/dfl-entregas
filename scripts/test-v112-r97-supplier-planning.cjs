#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const ts=require('typescript');
const root=process.cwd();
const realResolve=Module._resolveFilename;
const realExtension=Module._extensions['.ts'];
Module._resolveFilename=function(request,parent,isMain,options){
 if(request.startsWith('@/'))return realResolve.call(this,path.join(root,request.slice(2))+'.ts',parent,isMain,options);
 return realResolve.call(this,request,parent,isMain,options);
};
Module._extensions['.ts']=function(mod,filename){
 const source=fs.readFileSync(filename,'utf8');
 const output=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},reportDiagnostics:true});
 const errors=(output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,filename+' invalid TS');
 mod._compile(output.outputText,filename);
};
let n=0;
const ok=(yes,why)=>{assert.ok(yes,'R97: '+why);n++};
const near=(a,b,why)=>{ok(Math.abs(a-b)<0.001,why+`: ${a} !== ${b}`)};
const rootSource=fs.readFileSync('app/estoque/compras/page.tsx','utf8');
const panelSource=fs.readFileSync('components/stock/StockPurchaseIntelligencePanel.tsx','utf8');
const helperSource=fs.readFileSync('lib/stock-purchase-forecast.ts','utf8');
for(const [filename,code] of [['app/estoque/compras/page.tsx',rootSource],['components/stock/StockPurchaseIntelligencePanel.tsx',panelSource],['lib/stock-purchase-forecast.ts',helperSource]]){
 const file=ts.createSourceFile(filename,code,ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(file.parseDiagnostics.length===0,'TS/TSX '+filename+' válido');
}
const {buildStockPurchaseForecast,stockSupplierPurchaseText,stockVendorSpecificLines}=require('../lib/stock-purchase-forecast.ts');
const fixed=Date.parse('2026-10-24T10:00:00Z');
const row=(id,baseQuantity,unit='kg')=>({id:'item-'+id,productId:id,name:id.toUpperCase(),category:'Frios',purchaseText:`3 pacotes (${baseQuantity} ${unit})`,purchaseQuantity:3,baseQuantity,signature:'sig-'+id,supplyItem:{id:'item-'+id,name:id,stock_product_id:id,quantity:baseQuantity,unit,purchase_quantity:3}});
const rows=[row('cheese',1.5),row('bread',40,'un'),row('unknown',2,'kg')];
const supply=(id,days,status,supplier_id,supplier,items,extra={})=>({id,occurred_at:new Date(fixed-days*86400_000).toISOString(),status,supplier_id,supplier,items,...extra});
const item=(product,quantity,total,unit='kg')=>({id:product,stock_product_id:product,unit,quantity,total_price:total});
const vendors=[{id:'s1',name:'Mercadão',active:true},{id:'s2',name:'Atacado',active:true},{id:'s3',name:'Mercadão',active:true}];
const supplies=[
 supply('a1',20,'conferido','s1','Mercadão',[item('cheese',2,40),item('bread',20,40,'un')]),
 supply('a2',5,'recebido','s2','Atacado',[item('cheese',5,75),item('bread',40,120,'un')]),
 supply('a3',1,'solicitado','s1','Mercadão',[item('cheese',1,1)]),
 supply('a4',1,'conferido','s1','Mercadão',[item('cheese',1,0.50)],{stock_reversed_at:'2026-10-24'}),
 supply('a5',220,'recebido','s1','Mercadão',[item('cheese',1,1)]),
 supply('a6',-2,'recebido','s2','Atacado',[item('cheese',1,1)]),
 supply('a7',3,'conferido','s1','Mercadão',[item('cheese',1,1,'g')]),
 supply('a8',17,'conferido','','Mercadão',[item('cheese',1,9)]),
];
const result=buildStockPurchaseForecast(rows,supplies,vendors,fixed);
ok(result.totalItems===3 && result.pricedItems===2 && result.unpriced.length===1,'previsão parcial não inventa preço desconhecido');
ok(result.unpriced[0].row.productId==='unknown','itens sem preço preservados');
const cheese=result.lines.find(line=>line.row.productId==='cheese');
ok(cheese.quotes.length===3,'IDs de fornecedores homônimos e legado ambíguo não são mesclados');
const cheapest=cheese.best;
ok(cheese.quotes.some(q=>q.supplierKey==='legacy:mercadao'&&q.unlinked),'histórico sem ID ambíguo sinalizado e separado');
ok(cheapest.supplierKey==='id:s2','nome homônimo sem ID não assume fornecedor mais barato');
near(cheapest.unitBasePrice,15,'menor preço com fornecedor identificado por unidade base');
near(cheapest.estimatedTotal,22.5,'1,5kg mantém valor correto');
ok(!cheese.quotes.some(q=>q.unitBasePrice===1),'pedido solicitado, estorno e data futura ignorados');
ok(cheese.quotes.find(q=>q.supplierKey==='id:s1')?.unitBasePrice===20,'custo base histórico confirmado preservado');
const bread=result.lines.find(line=>line.row.productId==='bread');
ok(bread.best.unitBasePrice===2,'menor custo histórico bread fornecedor s1');
near(result.partialTotal,102.5,'total parcial soma apenas preços históricos conhecidos');
ok(!result.groups.some(g=>g.key==='legacy:mercadao') && result.groups.some(g=>g.key==='id:s2') && result.groups.some(g=>g.key==='id:s1'),'legado ambíguo não recebe compras sugeridas automaticamente');
ok(stockVendorSpecificLines(result,'id:s2').length===2,'lista filtrada mostra itens com histórico do fornecedor escolhido');
ok(stockVendorSpecificLines(result,'nonexistent').length===0,'fornecedor sem registros não inventa itens');
const full=stockSupplierPurchaseText(result,{'item-cheese':'sig-cheese'},new Date(fixed));
ok(full.includes('PRECOS A COTAR') && full.includes('UNKNOWN') && full.includes('SEM PRECO'),'roteiro geral inclui itens sem cotação');
ok(full.includes('[x] CHEESE') && full.includes('[ ] BREAD'),'checklist preserva situação');
ok(full.includes('Estimativa PARCIAL'),'exportação explica total incompleto');
const filtered=stockSupplierPurchaseText(result,{},new Date(fixed),'id:s2');
ok(filtered.includes('FORNECEDOR: ATACADO') && filtered.includes('1 produto(s) da lista sem preco'),'roteiro individual identifica itens sem cotação');
ok(!filtered.includes('PRECOS A COTAR'),'roteiro individual não se passa por roteiro global');
const sparse=buildStockPurchaseForecast(rows,[],vendors,fixed);
ok(sparse.pricedItems===0 && sparse.partialTotal===0 && sparse.unpriced.length===3,'histórico vazio seguro');
const typo=buildStockPurchaseForecast(rows,[supply('bad',1,'conferido','s1','Mercadão',[item('cheese',1,NaN),item('bread',0,15,'un')])],vendors,fixed);
ok(typo.pricedItems===0,'quantidades e preços inválidos descartados');
// Alias legado unico (sem misturar IDs diferentes)
const alias=buildStockPurchaseForecast([row('cheese',1)], [supply('old',2,'recebido','','Atacado',[item('cheese',1,30)])],vendors,fixed);
ok(alias.lines[0].best.supplierKey==='id:s2','nome unico legado mapeia cadastro existente');
// Não faz buscas nem writes. Operações de exportação são explícitas e isoladas.
for(const fragment of ['getDocs(', 'setDoc(', 'updateDoc(', 'onSnapshot(', 'setInterval(', 'runTransaction('])ok(!helperSource.includes(fragment),'helper não abre Firebase: '+fragment);
for(const needle of ['StockPurchaseIntelligencePanel','marketPreview.rows','marketChecked','marketPreview.invalid.length'])ok(rootSource.includes(needle),'painel conectado ao rascunho R96: '+needle);
ok(panelSource.includes('useMemo(() => buildStockPurchaseForecast') && panelSource.includes('stockSupplies'),'histórico cacheado e índice memoizado');
ok(panelSource.includes('aria-expanded={expanded}') && panelSource.includes('min-h-11') && panelSource.includes('aria-label="Inteligência de compras e fornecedores R97"'),'design acessível e toques Android');
ok(panelSource.includes('void Haptics.impact') && panelSource.includes('.catch(() => undefined)'),'feedback tátil não bloqueante');
ok(panelSource.includes("toast.error(") && panelSource.includes('busyAction') && panelSource.includes('actionLock.current'),'feedback de falha e lock contra duplo toque');
ok(panelSource.includes('exportStockMarketPdf') && panelSource.includes('Share.share') && panelSource.includes('copyToClipboard'),'PDF por fornecedor e envio de texto');
ok(panelSource.includes('Itens sem histórico permanecem na lista geral R96'),'PDF restrito não finge lista completa');
ok(!panelSource.includes('getDocs(') && !panelSource.includes('setDoc('),'painel não lê/grava no Firestore');
const gate=fs.readFileSync('scripts/pre-apk.cjs','utf8');
ok(gate.includes('scripts/test-v112-r97-supplier-planning.cjs'),'R97 registrada no pré-APK');
ok(gate.includes('scripts/test-v112-r96-market-list.cjs'),'R96 preservada');
// Ensaio com muitos itens para garantir índice por produto e bom custo.
const bulkRows=Array.from({length:600},(_,i)=>row('p'+i,1,'un'));
const bulkSupplies=Array.from({length:80},(_,i)=>supply('u'+i,3,'conferido','s1','Mercadão',Array.from({length:30},(_,j)=>item('p'+((i*30+j)%600),1,2,'un'))));
const bulk=buildStockPurchaseForecast(bulkRows,bulkSupplies,vendors,fixed);
ok(bulk.totalItems===600 && bulk.pricedItems===600 && bulk.partialTotal===1200,'600 itens e 2400 preços sem duplicação no orçamento');
console.log('R97 COMPRAS/INTELIGENCIA: '+n+' contratos e cenários aprovados');
