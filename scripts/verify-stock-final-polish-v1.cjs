const fs=require('fs');
const page=fs.readFileSync('app/estoque/page.tsx','utf8');
const details=fs.readFileSync('app/estoque/detalhes/page.tsx','utf8');
const edit=fs.readFileSync('app/estoque/editar/page.tsx','utf8');
const display=fs.readFileSync('lib/stock-commercial-display-v2.ts','utf8');

const checks=[
 ['abas de planejamento',page.includes("planningTab==='dia'")&&page.includes("setPlanningTab('montar')")],
 ['amostra de quatro',page.includes('daily.slice(0,4)')],
 ['contador excedente',page.includes("daily.length-4")],
 ['montagem centralizada',page.includes('Abrir montagem da compra')],
 ['scroll com retry',page.includes('tries<6')&&page.includes('rememberAndPush')],
 ['saída limpa scroll',page.includes("sessionStorage.removeItem('dfl-stock-scroll')")],
 ['detalhes preserva origem',details.includes("from==='estoque'?'estoque':'detalhes'")],
 ['editar lê origem',edit.includes("const from=search.get('from')")],
 ['editar devolve origem',edit.includes("'&from=estoque'")],
 ['embalagem fechada humana',display.includes("closedPackage")&&display.includes("'embalagens'")],
 ['quantidade comercial na compra do dia',page.includes('signal.commercialPlan.purchaseQuantity')],
];

let bad=0;
for(const [name,ok] of checks){
 if(ok) console.log('OK:',name);
 else {console.error('FALHOU:',name);bad++;}
}
if(bad) process.exit(1);
console.log('OK: acabamento final do estoque validado');
