const fs=require('fs');
const checks=[
 ['lib/ifood-order-parser.ts',['IFOOD_HEADER_PATTERNS','editDistance','bestScore >= 0.84','explicitIfoodId(line),']],
 ['lib/route-stops.ts',['urgência é soberana','const urgent = result.filter']],
 ['components/home/RouteAccordion.tsx',['dfl-route-last-open-v2','toggleRouteOpen','localStorage.setItem']],
 ['store/useAppStore.ts',['automaticIndex','-1000000 + position',"order_source: delivery.order_source || 'smart'"]],
 ['lib/ifood-parser-quality.ts',['assessIfoodParseQuality','ID iFood']]
];
let bad=0;
for(const [f,needles] of checks){if(!fs.existsSync(f)){console.error('AUSENTE',f);bad++;continue}const s=fs.readFileSync(f,'utf8');for(const n of needles)if(!s.includes(n)){console.error('FALHOU',f,n);bad++}}
if(bad)process.exit(1);
console.log('OK: contratos Operação/iFood/Rotas presentes');
