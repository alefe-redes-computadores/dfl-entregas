const fs=require('fs');
const files=['app/estoque/page.tsx','lib/stock-daily-plan.ts','lib/stock-commercial-display-v2.ts','components/stock/StockPresentationEditor.tsx'];
for(const f of files){const s=fs.readFileSync(f,'utf8');if(/\b(getDocs|getDoc|onSnapshot|collection)\s*\(/.test(s)){console.error('ABORTADO: consulta Firestore direta introduzida em',f);process.exit(1)}}
console.log('OK: nenhuma consulta Firestore direta nova nas camadas de UI/inteligência');
