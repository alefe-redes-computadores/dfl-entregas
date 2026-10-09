const fs = require('node:fs');
const assert = require('node:assert/strict');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const native = read('components/NativeRuntime.tsx');
const site = read('lib/integration/site-order.ts');
const home = read('app/page.tsx');
const dashboard = read('hooks/useStoreDashboard.ts');
const hub = read('components/store/SiteAdminHub.tsx');
const deliveries = read('app/entregas/page.tsx');
const persistence = read('lib/integration/server/siteOrderPersistence.ts');

function check(label, condition) {
  assert.ok(condition, label);
  console.log('OK:', label);
}

check(
  'deep link inicial respeita navegação posterior',
  native.includes('currentPath === launchPath') &&
  native.includes('await App.getLaunchUrl()')
);

check(
  'deep links recebidos em execução continuam ativos',
  native.includes("App.addListener('appUrlOpen'") &&
  (
    native.includes('if (href) router.replace(href)') ||
    (
      native.includes("navigate(href, 'app-url-open')") &&
      native.includes('if (disposed) return;') &&
      native.includes('router.replace(href)')
    )
  )
);

check(
  'botão Voltar continua usando o mapa nativo',
  native.includes("App.addListener('backButton'") &&
  native.includes('nativeBackTarget(')
);

check(
  'helper de cancelamento disponível',
  site.includes('isCancelledSiteDelivery')
);

check(
  'Home reconhece cancelamentos',
  home.includes('isCancelledSiteDelivery')
);

check(
  'dashboard reconhece cancelamentos',
  dashboard.includes('isCancelledSiteDelivery')
);

check(
  'Minha Loja reconhece cancelamentos',
  hub.includes('isCancelledSiteDelivery')
);

check(
  'Entregas possui filtro de cancelados',
  deliveries.includes("'canceladas'") &&
  deliveries.includes('isCancelledSiteDelivery')
);

check(
  'backend preserva proteção contra reabertura',
  persistence.includes('currentCancelled') &&
  persistence.includes('incomingCancelled') &&
  persistence.includes('!currentCancelled || incomingCancelled')
);

check(
  'backend preserva data de cancelamento',
  persistence.includes('site_order_cancelled_at')
);

console.log('\\nV64.1: CONTRATOS ESTÁTICOS OK');
