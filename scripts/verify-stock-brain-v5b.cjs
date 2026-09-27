const fs=require('fs'),r=p=>fs.readFileSync(p,'utf8');
const f={c:r('app/estoque/compras/page.tsx'),g:r('lib/stock-recommendation-guard.ts'),d:r('lib/stock-commercial-display-v2.ts'),p:r('lib/stock-daily-plan.ts'),h:r('app/estoque/page.tsx')};
const checks=[
 ['guarda conservadora preservada',/quantity\s*:\s*configuredDeficit/.test(f.g)],
 ['embalagem mostra total base',f.d.includes('no total')],
 ['cérebro diário usa guarda',f.p.includes('guardedStockRecommendation(product,rec)')],
 ['Home explica origem',f.h.includes('signal.recommendationReason')],
 ['Montar compra usa guarda',f.c.includes('const gross = guarded.quantity')],
 ['plano carrega guarda',f.c.includes('guard: guarded')],
 ['alvo visual usa meta guardada',f.c.includes('purchasePlan?.guard.configuredTarget')],
 ['controles têm faixa própria',f.c.includes("grid-cols-[minmax(0,1fr)_92px]")],
 ['max-width deformador removido',!f.c.includes('max-w-[150px]')],
 ['select ocupa largura útil',f.c.includes('h-11 w-full min-w-0 rounded-xl')],
 ['quantidade tem coluna estável',f.c.includes('w-[92px] shrink-0')],
 ['card explica a sugestão',f.c.includes('purchasePlan?.guard.reason')],
];
let bad=0;for(const [n,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${n}`);if(!ok)bad++;}
if(bad)process.exit(1);console.log('\nESTOQUE CÉREBRO V5B: contratos OK');
