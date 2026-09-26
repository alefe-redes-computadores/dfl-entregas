const fs = require('fs');

const localOnly = [
  'lib/delivery-inbox.ts',
  'app/loja/caixa-de-entrada/page.tsx',
  'lib/delivery-intelligence/selectHighlights.ts',
  'hooks/useDeliveryIntelligence.ts',
  'components/home/OperationalRadar.tsx',
  'components/store/OperationalIntelligencePanel.tsx',
];

const firestorePattern =
  /\b(getDocs|getDoc|onSnapshot|collection|query|setDoc|addDoc)\s*\(/;

let failures = 0;

for (const file of localOnly) {
  const source = fs.readFileSync(file, 'utf8');

  if (firestorePattern.test(source)) {
    console.error(
      'FALHOU: acesso Firestore inesperado em',
      file,
    );
    failures += 1;
  }
}

const inbox = fs.readFileSync(
  'lib/delivery-inbox.ts',
  'utf8',
);

if (
  !inbox.includes('localStorage.setItem') ||
  !inbox.includes('localStorage.getItem')
) {
  console.error(
    'FALHOU: persistência local da Caixa desapareceu.',
  );
  failures += 1;
}

if (failures) process.exit(1);

console.log('OK: Caixa continua local-only');
console.log('OK: cérebro não criou hot path Firestore');
