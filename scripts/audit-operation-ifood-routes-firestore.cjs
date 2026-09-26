const fs=require('fs');
for(const f of ['lib/ifood-order-parser.ts','lib/ifood-parser-quality.ts','lib/route-stops.ts','hooks/useOptimizedDeliveries.ts','components/home/RouteAccordion.tsx']){
 const s=fs.readFileSync(f,'utf8');
 if(/\b(getDocs|getDoc|onSnapshot)\s*\(/.test(s)){console.error('Consulta Firestore direta nova em',f);process.exit(1)}
}
console.log('OK: parser, agrupamento, expansão e ordenação visual não consultam Firestore');
