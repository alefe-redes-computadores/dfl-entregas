const fs=require('fs');
const checks=[
 ['app/estoque/page.tsx',['dfl-stock-filter','dfl-stock-collapsed','Compra do dia','naturalStockNameCompare','SlidersHorizontal','humanPurchasePlan']],
 ['components/stock/StockCriticalBanner.tsx',['Math.max(Number(p.minimum_quantity)','Reposição urgente']],
 ['components/stock/StockPresentationEditor.tsx',['Conteúdo de 1 embalagem',"from==='g'&&to==='kg'"]],
 ['lib/stock-commercial-display-v2.ts',['humanPurchasePlan','physicalStockDisplay','naturalStockNameCompare']],
 ['lib/stock-daily-plan.ts',['weekdaySamples','getDay()']],
 ['store/useAppStore.ts',['cleanupDuplicateStockProducts',"deleteDoc(doc(db,'stock_products'"]],
 ['app/estoque/catalogo/page.tsx',['Revisar e limpar duplicados']]
];
let bad=0;
for(const [f,needles] of checks){
 if(!fs.existsSync(f)){console.error('FALHOU arquivo ausente',f);bad++;continue}
 const s=fs.readFileSync(f,'utf8');
 for(const n of needles)if(!s.includes(n)){console.error('FALHOU',f,n);bad++}
}
if(bad)process.exit(1);
console.log('OK: contratos da supercirurgia V2 presentes');
