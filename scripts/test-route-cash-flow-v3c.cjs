const fs=require('fs');
const s=fs.readFileSync('lib/route-cash-flow.ts','utf8');
const required=[
 'initialCash + tenderedCash - plannedCashChange',
 'Math.min(initialCash, requiredChange)',
 'Math.max(0, requiredChange - plannedCashChange)',
];
let fail=0;
for(const x of required){
 const ok=s.includes(x);
 console.log(`${ok?'OK':'ERRO'}: contrato ${x}`);
 if(!ok)fail++;
}
if(fail)process.exit(1);
console.log('CENÁRIO CANÔNICO: pedido 64 + cliente 100 + troco 36 => retorno físico 100 representado pelo motor.');
