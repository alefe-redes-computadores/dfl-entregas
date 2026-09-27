const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');

const f = {
  t: read('types/index.ts'),
  s: read('store/useAppStore.ts'),
  n: read('app/entregas/nova/page.tsx'),
  c: read('components/home/DeliveryCard.tsx'),
  k: read('components/routes/RouteDepartureChecklist.tsx'),
  r: read('lib/reports/buildReportModel.ts'),
  i: read('lib/delivery-intelligence/buildOperationalIntelligence.ts'),
};

const helperStart = f.s.indexOf('autoOrganizeLoadedRouteAfterInsert');
const helperEnd = f.s.indexOf('interface AppState');

const helper =
  helperStart >= 0
    ? f.s.slice(
        helperStart,
        helperEnd > helperStart ? helperEnd : undefined
      )
    : '';

const checks = [
  [
    'flag operacional',
    f.t.includes('exclude_customer_metrics?: boolean'),
  ],
  [
    'auto organização local',
    f.s.includes('autoOrganizeLoadedRouteAfterInsert') &&
      f.s.includes('buildSmartRouteOrder'),
  ],
  [
    'sem leitura no helper',
    helperStart >= 0 &&
      !/getDocs\(|onSnapshot\(|geocodeAddress\(/.test(helper),
  ],
  [
    'controle operacional',
    f.n.includes('exclude_customer_metrics'),
  ],
  [
    'multi pedido melhorado',
    f.n.includes('Usar cliente principal nos pedidos'),
  ],
  [
    'ranking exclui operacional',
    f.r.includes('exclude_customer_metrics'),
  ],
  [
    'inteligência exclui operacional',
    f.i.includes('exclude_customer_metrics'),
  ],
  [
    'checklist por parada',
    f.k.includes('physicalStops') &&
      f.k.includes('groupDeliveriesByStop'),
  ],
  [
    'card recorrente',
    /recorr|frequent|supercliente/i.test(f.c),
  ],
  [
    'card fala parada',
    f.c.includes('pedidos · 1 parada'),
  ],
];

let bad = 0;

for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'ERRO'}: ${name}`);
  if (!ok) bad++;
}

if (bad) {
  console.error(`\nSUPER OPERAÇÃO V2: ${bad} contrato(s) falharam`);
  process.exit(1);
}

console.log('\nSUPER OPERAÇÃO V2: contratos OK');
