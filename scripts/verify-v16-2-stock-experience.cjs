const fs=require('fs');

const read=p=>fs.readFileSync(p,'utf8');
const display=read('lib/stock-commercial-display-v2.ts');
const move=read('app/estoque/movimentar/page.tsx');
const edit=read('app/estoque/editar/page.tsx');
const novo=read('app/estoque/novo/page.tsx');
const editor=read('components/stock/StockPresentationEditor.tsx');
const health=read('lib/stock-commercial-health.ts');

const checks=[
 ['equação comercial centralizada',display.includes('commercialPresentationEquation')],
 ['prévia comercial centralizada',display.includes('commercialMovementPreview')],
 ['movimentação usa equação humana',move.includes('commercialPresentationEquation(item,product.unit)')],
 ['movimentação usa prévia humana',move.includes('commercialMovementPreview(selectedPresentation,product.unit,typed)')],
 ['texto técnico 1 = X removido',!move.includes('>1 = {item.conversion_quantity')],
 ['prévia técnica multiplicação removida',!move.includes(' × {selectedPresentation?.label')],
 ['editar usa humanPurchasePlan',edit.includes('humanPurchasePlan({purchaseQuantity:commercialSuggestion.purchaseQuantity')],
 ['editar não usa formatter legado',!edit.includes('formatCommercialPlan({purchaseQuantity:commercialSuggestion.purchaseQuantity')],
 ['novo usa editor compartilhado',novo.includes('StockPresentationEditor')],
 ['editar usa editor compartilhado',edit.includes('StockPresentationEditor')],
 ['editor preserva conversão direta',editor.includes('conversion_quantity')],
 ['editor preserva nome editável',editor.includes('value={item.label}')],
 ['diagnóstico identifica apresentação',health.includes('const invalid = (product.presentations || []).find')],
 ['diagnóstico pede nome quando falta',health.includes('informe um nome para a embalagem')],
 ['diagnóstico pede conteúdo quando inválido',health.includes('informe quanto existe dentro de cada embalagem')],
 ['sem Firestore no formatter',!display.includes('firebase/firestore')],
 ['sem Firestore no editor',!editor.includes('firebase/firestore')],
];

let failures=0;
for(const [name,ok] of checks){
 console.log(`${ok?'OK':'ERRO'}: ${name}`);
 if(!ok)failures++;
}

if(failures){
 console.error(`\nV16.2: ${failures} contrato(s) falharam.`);
 process.exit(1);
}
console.log('\nV16.2 STOCK EXPERIENCE: contratos OK');
