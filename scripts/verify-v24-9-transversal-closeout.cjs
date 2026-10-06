const fs=require('fs');
const r=f=>fs.readFileSync(f,'utf8');
const ok=(v,m)=>{if(!v)throw Error(`V24.9 R1: ${m}`);console.log('OK:',m)};

const stock=r('lib/stock-intelligence.ts');
const semantic=r('lib/stock-semantic-confidence-v24-8.ts');
const details=r('app/estoque/detalhes/page.tsx');
const reports=r('lib/reports/buildReportModel.ts');
const exclusions=r('lib/operational-exclusions.ts');
const radar=r('components/home/OperationalRadar.tsx');
const highlights=r('lib/delivery-intelligence/selectHighlights.ts');

const a=stock.indexOf('export function buildStockRecommendation');
const b=stock.indexOf('export function buildStockRecommendations');
ok(a>=0&&b>a,'motor real de recomendação localizado');
const body=stock.slice(a,b);
ok(body.includes('semanticUnitRisk')&&body.includes('if (semanticUnitRisk)')&&body.includes("dataQuality: 'revisar_unidade'"),
   'ambiguidade semântica bloqueia previsão no motor real');
ok(body.includes('averageDailyConsumption: 0')&&body.includes('coverageDays: null'),
   'motor não inventa consumo/cobertura ambíguos');
ok(semantic.includes('stock-1789166741727-79tek')&&semantic.includes('catalog-luva'),
   'quarentena forense preservada');
ok(!semantic.includes('catalog-ketchup-sache')&&!semantic.includes('catalog-sacola-38x48')&&!semantic.includes('catalog-agua-com-gas-500')&&!semantic.includes('stock-1790443008324-xgpwj'),
   'itens confiáveis/falsos agrupamentos permanecem fora da quarentena');
ok(details.includes('StockSemanticReviewNotice'),'detalhes explica revisão semântica');

/*
 * O modelo de relatórios NÃO usa internalCustomerIds.
 * A implementação real enriquece a delivery com customer/route e filtra
 * `normalized` antes de buildPeriod/current/aggregate.
 */
const normalized=reports.indexOf('const normalized: ReportDelivery[]');
const period=reports.indexOf('const period = buildPeriod', normalized);
ok(normalized>=0&&period>normalized,'pipeline normalized dos relatórios localizado');
const clean=reports.slice(normalized,period);
ok(clean.includes('!delivery.exclude_customer_metrics'),'flag de exclusão aplicada antes das agregações');
ok(clean.includes('!isInternalOperationalCustomer(delivery.customer)'),'cliente interno excluído pela autoridade central');
ok(clean.includes('!isInternalOperationalRoute(delivery.route)'),'rota interna excluída no mesmo pipeline');
ok(exclusions.includes('export function isInternalOperationalCustomer')&&exclusions.includes('export function isInternalOperationalRoute'),
   'autoridade de exclusão permanece centralizada');

ok(radar.includes('highlightLimit: 2'),'Home reduz candidatos do radar');
ok(radar.includes('chooseHomeSignal')&&radar.includes('const signal = chooseHomeSignal'),
   'Home continua exibindo um único sinal prioritário');
ok(highlights.includes('usefulnessScore')&&highlights.includes('SEVERITY_WEIGHT')&&highlights.includes('CONFIDENCE_WEIGHT'),
   'ranking por utilidade/severidade/confiança preservado');
ok(highlights.includes('categories')&&highlights.includes('family'),
   'deduplicação por categoria/família preservada');

console.log('\n============================================================');
console.log(' DFL V24.9 R1 — CONTRATO TRANSVERSAL OK');
console.log('============================================================');
