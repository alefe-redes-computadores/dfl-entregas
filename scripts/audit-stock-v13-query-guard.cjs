const fs=require('fs');
const files=['lib/stock-commercial-health.ts','lib/stock-shopping.ts','lib/stock-pricing.ts','lib/stock-intelligence.ts','app/estoque/page.tsx','app/estoque/compras/page.tsx','components/stock-supplies/StockSupplyForm.tsx','components/stock-supplies/StockProductPicker.tsx'];
const re=/\b(getDocs|onSnapshot)\s*\(|query\s*\(\s*collection\s*\(\s*db|collection\s*\(\s*db/g,h=[];
for(const f of files){const t=fs.readFileSync(f,'utf8');if(re.test(t))h.push(f);re.lastIndex=0}
if(h.length)throw new Error('Firestore direto: '+h.join(', '));
console.log('OK nenhuma consulta Firestore direta');
