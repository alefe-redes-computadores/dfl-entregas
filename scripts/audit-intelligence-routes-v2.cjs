const fs=require('fs');

const hot=[
 'lib/delivery-intelligence/selectHighlights.ts',
 'hooks/useDeliveryIntelligence.ts',
 'components/home/OperationalRadar.tsx',
 'components/store/OperationalIntelligencePanel.tsx',
 'components/reports/ReportIntelligencePanel.tsx'
];

for(const file of hot){
 const source=fs.readFileSync(file,'utf8');

 if(/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(source)){
   console.error('Leitura Firestore introduzida em:',file);
   process.exit(1);
 }
}

const radar=fs.readFileSync(
 'components/home/OperationalRadar.tsx',
 'utf8'
);

if(
 radar.includes(
   "encodeURIComponent(signal.entityIds![0])"
 )
){
 console.error(
   'Radar ainda navega cegamente para entityIds[0]'
 );
 process.exit(1);
}

console.log('OK: nenhum Firestore novo no cérebro');
console.log('OK: navegação cega de rota eliminada');
