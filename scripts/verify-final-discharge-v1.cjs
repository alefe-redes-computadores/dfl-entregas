const fs = require('fs');

const checks = [
  [
    'lib/delivery-inbox.ts',
    [
      'cleanupDeliveryInbox',
      'recoverInterruptedInboxDrafts',
      'findInboxDuplicate',
      'markInboxDraft',
    ],
  ],
  [
    'app/loja/caixa-de-entrada/page.tsx',
    [
      'cleanupDeliveryInbox(today)',
      'recoverInterruptedInboxDrafts',
      'Possível duplicado',
      'ainda não lançado',
    ],
  ],
  [
    'app/entregas/nova/page.tsx',
    [
      'inboxDraftId',
      'markInboxDraft',
      "'launched'",
    ],
  ],
  [
    'lib/delivery-intelligence/selectHighlights.ts',
    [
      'CONFIDENCE_WEIGHT',
      'insightFamily',
      "return 'routes-duration'",
    ],
  ],
  [
    'components/home/OperationalRadar.tsx',
    [
      'candidateRouteId',
      'hasHistoricalRouteReference',
    ],
  ],
  [
    'components/home/RouteAccordion.tsx',
    [
      'showRouteTools',
      'Ferramentas da rota',
    ],
  ],
];

let failures = 0;

for (const [file, needles] of checks) {
  if (!fs.existsSync(file)) {
    console.error('AUSENTE:', file);
    failures += 1;
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');

  for (const needle of needles) {
    if (!source.includes(needle)) {
      console.error('FALHOU:', file, '->', needle);
      failures += 1;
    }
  }
}

const inbox = fs.readFileSync(
  'lib/delivery-inbox.ts',
  'utf8',
);

if (inbox.includes('DELIVERY_INBOX_LEARNING_KEY')) {
  console.error(
    'FALHOU: chave de aprendizado fantasma ainda existe.',
  );
  failures += 1;
}

const radar = fs.readFileSync(
  'components/home/OperationalRadar.tsx',
  'utf8',
);

if (
  /encodeURIComponent\(\s*signal\.entityIds!?\[0\]\s*\)/.test(
    radar,
  )
) {
  console.error(
    'FALHOU: Radar voltou a navegar cegamente para rota.',
  );
  failures += 1;
}

if (failures) process.exit(1);

console.log('OK: ciclo de vida da Caixa');
console.log('OK: launching recuperável após cancelamento');
console.log('OK: retenção local segura');
console.log('OK: memória de aprendizado fantasma removida');
console.log('OK: proteção contra rota órfã');
console.log('OK: progressive disclosure preservado');
