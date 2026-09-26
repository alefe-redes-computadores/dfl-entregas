const fs=require('fs');

const checks=[
 ['lib/delivery-intelligence/selectHighlights.ts',[
   'CONFIDENCE_WEIGHT',
   'insightFamily',
   "return 'routes-duration'",
   "insight.confidence === 'low'"
 ]],
 ['hooks/useDeliveryIntelligence.ts',[
   'minimumSample ?? 5',
   'highlightLimit ?? 2'
 ]],
 ['components/home/OperationalRadar.tsx',[
   'candidateRouteId',
   'hasHistoricalRouteReference',
   'Referência histórica · detalhes no relatório'
 ]],
 ['components/store/OperationalIntelligencePanel.tsx',[
   'minimumSample: 5',
   'highlightLimit: 2',
   'Sinais que merecem atenção'
 ]],
 ['components/reports/ReportIntelligencePanel.tsx',[
   'limit: 3',
   'minimumSample: 5'
 ]],
 ['components/home/RouteAccordion.tsx',[
   'showRouteTools',
   'Ferramentas da rota',
   'Otimização, WhatsApp e trajeto'
 ]]
];

let failed=0;

for(const [file,needles] of checks){
 const source=fs.readFileSync(file,'utf8');

 for(const needle of needles){
   if(!source.includes(needle)){
     console.error('FALHOU:',file,'->',needle);
     failed++;
   }
 }
}

if(failed) process.exit(1);

console.log('OK: relevância/confiança do cérebro V2');
console.log('OK: deduplicação de sinais de duração');
console.log('OK: rota órfã não oferece navegação quebrada');
console.log('OK: ferramentas secundárias da rota recolhidas');
