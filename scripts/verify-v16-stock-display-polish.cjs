const fs=require('fs');

const file='lib/stock-commercial-display-v2.ts';
const s=fs.readFileSync(file,'utf8');

const checks=[
  ['equivalência exige conversão real',s.includes('const hasRealConversion=')],
  ['conversão unitária não repete total',s.includes('Math.abs(conversion-1)>1e-9')],
  ['equivalência compara total e quantidade comercial',s.includes('Math.abs(totalBase-count)>1e-9')],
  ['unidade interna fica explícita',s.includes("'internas'")],
  ['separador visual compacto',s.includes('` · ${formatPlanningQuantity(totalBase,baseUnit)}')],
  ['prefixo quebrado é limpo',/\.replace\(\/\^\[-–—\]\+\\s\*\//.test(s)],
  ['pacote preservado',s.includes("p.purchase_unit==='pct'?'pacotes'")],
  ['caixa preservada',s.includes("p.purchase_unit==='cx'?'caixas'")],
  ['fardo preservado',s.includes("p.purchase_unit==='fardo'?'fardos'")],
  ['embalagem fechada de peso preservada',s.includes('closedPackage')],
];

let failed=0;
for(const [name,ok] of checks){
  console.log(`${ok?'OK':'ERRO'}: ${name}`);
  if(!ok) failed++;
}

if(failed){
  console.error(`\\nV16 DISPLAY: ${failed} contrato(s) falharam.`);
  process.exit(1);
}

console.log('\\nV16 DISPLAY ESTOQUE: contratos OK');
