const fs=require('fs');
const checks=[
 ['lib/ifood-order-parser.ts',['IFOOD_HEADER_PATTERNS','editDistance','bestScore >= 0.84','explicitIfoodId(line),']],
 ['lib/route-stops.ts',['`order_index` é a autoridade final','return [...groups.values()].sort(', 'a.pending.length === 0']],
 ['components/home/RouteAccordion.tsx',['readRememberedRouteId','rememberOpenRouteId','toggleRouteOpen']],
 ['lib/route-ui-storage.ts',['dfl-route-last-open-v2','dfl-active-operational-route-v1','localStorage.setItem','try {']],
 ['store/useAppStore.ts',['automaticIndex','delivery.is_urgent ? head - 1 : tail + 1',"order_source: delivery.is_urgent ? 'manual' : delivery.order_source || 'smart'",'order_locked: delivery.is_urgent ? true : delivery.order_locked']],
 ['lib/ifood-parser-quality.ts',['assessIfoodParseQuality','ID iFood']]
];
let bad=0;
for(const [f,needles] of checks){if(!fs.existsSync(f)){console.error('AUSENTE',f);bad++;continue}const s=fs.readFileSync(f,'utf8');for(const n of needles)if(!s.includes(n)){console.error('FALHOU',f,n);bad++}}
if(bad)process.exit(1);
console.log('OK: contratos Operação/iFood/Rotas presentes');
