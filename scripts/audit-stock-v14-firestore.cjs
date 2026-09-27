const fs=require('fs');
const files=['lib/stock-operation.ts','app/estoque/compras/page.tsx'];
const re=/\b(getDocs|onSnapshot)\s*\(|query\s*\(\s*collection\s*\(\s*db|collection\s*\(\s*db/g;
const hits=[];
for(const f of files){const t=fs.readFileSync(f,'utf8');if(re.test(t))hits.push(f);re.lastIndex=0}
if(hits.length)throw Error('Firestore direto detectado: '+hits.join(', '));
console.log('OK V14 não adicionou consultas Firestore');
