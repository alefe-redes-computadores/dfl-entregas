const fs=require('fs');
const files=[
 'app/estoque/compras/page.tsx',
 'components/stock-supplies/StockSupplyForm.tsx',
 'components/stock-supplies/StockProductPicker.tsx',
 'lib/stock-commercial.ts',
 'lib/stock-shopping.ts',
 'lib/stock-pricing.ts',
 'lib/stock-intelligence.ts',
 'lib/stock-operation.ts',
];
const bad=[];
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 for(const token of ['getDocs(', 'onSnapshot(', 'collection(db']){
  if(s.includes(token)) bad.push(`${f}: ${token}`);
 }
}
if(bad.length){
 console.error(bad.join('\n'));
 process.exit(1);
}
console.log('OK: cirurgia final não introduziu consultas Firestore diretas.');
