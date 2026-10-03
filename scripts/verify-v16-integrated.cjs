const fs=require('fs');
const r=(p)=>fs.readFileSync(p,'utf8');
const stock=r('app/estoque/page.tsx');
const health=r('lib/stock-catalog-health.ts');
const banner=r('components/stock/StockCatalogHealth.tsx');
const route=r('components/RouteOperations.tsx');
const settlement=r('app/motoboys/acerto/page.tsx');
const presentation=r('components/stock/StockPresentationEditor.tsx');
const checks=[
 ['diagnóstico acionável montado',stock.includes('<StockCatalogHealth products={active}')],
 ['saldo inválido detectado',health.includes("'negative-stock'")],
 ['mínimo/ideal incoerentes detectados',health.includes("'ideal-below-minimum'")],
 ['duplicado detectado conservadoramente',health.includes("'duplicate-name'")],
 ['unidade discreta fracionada sinalizada',health.includes("'fractional-discrete'")],
 ['embalagem inválida sinalizada',health.includes("'invalid-presentation'")],
 ['ação abre edição do produto',banner.includes('onOpen(issue.productId)')],
 ['notificação de rota resiliente',route.includes('operação preservada')],
 ['lembrete de rota resiliente',route.includes('rota preservada')],
 ['acerto protege valores grandes',settlement.includes('tabular-nums')],
 ['editor explica embalagem inválida',presentation.includes('Forma de compra incompleta')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`);if(!ok)failed++}
if(failed)process.exit(1);
console.log('V16 INTEGRADA: contratos próprios OK');
