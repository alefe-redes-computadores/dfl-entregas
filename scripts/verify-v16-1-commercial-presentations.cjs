const fs=require('fs');

const editor=fs.readFileSync('components/stock/StockPresentationEditor.tsx','utf8');
const novo=fs.readFileSync('app/estoque/novo/page.tsx','utf8');
const editar=fs.readFileSync('app/estoque/editar/page.tsx','utf8');
const mover=fs.readFileSync('app/estoque/movimentar/page.tsx','utf8');

const checks=[
 ['editor compartilhado preservado no Novo',novo.includes('StockPresentationEditor')],
 ['editor compartilhado preservado no Editar',editar.includes('StockPresentationEditor')],
 ['edição recebe apresentações existentes',editar.includes('product?.presentations||[]')],
 ['apresentações existentes não são migradas automaticamente',!editor.includes('useEffect(')],
 ['forma comercial continua independente',editor.includes('purchase_unit')],
 ['conversão continua na unidade histórica',editor.includes('conversion_quantity')],
 ['texto explica cada embalagem',editor.includes('Cada {singular(item.purchase_unit)} contém')],
 ['prévia 1 embalagem = conteúdo',editor.includes('Como o app vai entender')],
 ['nome sugerido existe',editor.includes('suggestedLabel')],
 ['nome continua editável',editor.includes('value={item.label}')],
 ['pacote suportado',editor.includes("pct:'Pacote'")],
 ['caixa suportada',editor.includes("cx:'Caixa'")],
 ['fardo suportado',editor.includes("fardo:'Fardo'")],
 ['movimentação continua usando apresentação persistida',mover.includes('selectedPresentation?.id')],
 ['movimentação continua usando conversão persistida',mover.includes('conversion_quantity: conversion')],
];

let fail=0;
for(const [name,ok] of checks){
 console.log(`${ok?'OK':'ERRO'}: ${name}`);
 if(!ok)fail++;
}
if(fail)process.exit(1);
console.log('\nV16.1 APRESENTAÇÕES COMERCIAIS: contratos OK');
