const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`R70 Site/99Food: ${label}`);
  console.log('OK:', label);
};

const home = read('app/page.tsx');
const store = read('store/useAppStore.ts');
const policy = read('lib/operation/siteInboxPolicy.ts');
const siteInbox = read('components/store/SiteInboxPanel.tsx');
const create = read('app/entregas/nova/page.tsx');
const edit = read('app/entregas/editar/page.tsx');
const customerForm = read('components/customers/CustomerForm.tsx');
const customers = read('app/clientes/page.tsx');
const reportModel = read('lib/reports/buildReportModel.ts');
const reportPage = read('app/relatorios/page.tsx');
const reportSheet = read('components/reports/ReportDrilldownSheet.tsx');

ok(
  policy.includes('siteInboxProjection') &&
    siteInbox.includes('siteInboxProjection(deliveries') &&
    siteInbox.includes('allocateSiteDelivery'),
  'pedido do Site permanece na Caixa até a escolha explícita da rota',
);
ok(
  store.includes('runTransaction(db') &&
    store.includes('assertSiteRouteAllocation(remoteDelivery, route') &&
    store.includes("transaction.update(deliveryRef, { route_id: routeId"),
  'alocação do Site é revalidada e persistida em transação',
);
ok(
  !home.includes("routes.push({ id: 'rota-site-aguardando-confirmacao'") &&
    !home.includes("routes.unshift({ id: 'rota-site-aguardando-confirmacao'"),
  'Home não fabrica rota vazia para pedidos do Site',
);
ok(
  create.includes("setFulfillmentMode('external_delivery')") &&
    create.includes("fulfillmentMode==='delivery'") &&
    edit.includes("fulfillmentMode === 'delivery'"),
  '99Food não exige nem exibe seleção de rota DFL',
);
ok(
  store.includes("left.origin === 'food99'") &&
    store.includes("right.origin === 'food99'") &&
    store.includes('dateKey(leftDate) === dateKey(rightDate)'),
  'cadastro manual também bloqueia pedido 99Food repetido no mesmo dia',
);
ok(
  home.includes("'Entrega 99Food'") &&
    home.includes('pela plataforma') &&
    !home.includes("isPlatform ? 'Balcão'"),
  'Home distingue entrega da plataforma de balcão e retirada',
);
ok(
  customerForm.includes("setOrigin('food99')") &&
    customers.includes("customerOrigin==='food99'"),
  'cadastro e lista de clientes preservam a origem 99Food',
);
ok(
  reportModel.includes('logisticsProviders') &&
    reportModel.includes("delivery.origin === 'food99') return '99Food'") &&
    reportPage.includes('Responsável pela entrega') &&
    reportSheet.includes("case 'logistics'"),
  'relatórios separam origem comercial de responsável logístico',
);
ok(
  !policy.includes('onSnapshot(') &&
    !siteInbox.includes('onSnapshot(') &&
    !reportModel.includes('onSnapshot(') &&
    !reportModel.includes('setInterval('),
  'fechamento não cria listener, polling ou leitura adicional',
);

console.log('\nV112 R70 SITE + 99FOOD: CONTRATOS OK');
