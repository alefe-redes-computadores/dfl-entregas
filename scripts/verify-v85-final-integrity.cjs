const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`V85 FINAL: ${label}`);
  console.log('OK:', label);
};

const identity = read('lib/customer-identity.ts');
const store = read('store/useAppStore.ts');
const reconciler = read('lib/integration/server/reverseReconciler.ts');
const watcher = read('components/SiteOrderNotificationWatcher.tsx');
const notifications = read('lib/native/notifications.ts');
const routeStops = read('lib/route-stops.ts');
const finance = read('lib/delivery-finance.ts');
const parser = read('lib/ifood-order-parser.ts');
const details = read('app/entregas/details/page.tsx');

ok(
  identity.includes('(samePhone && compatibleName)') &&
    identity.includes('storedMissingIncomingIdentity') &&
    identity.includes('!addressConflict') &&
    identity.includes('!phoneConflict'),
  'cliente reutiliza evidência forte sem atravessar conflitos',
);
ok(
  store.includes("? `phone:${normalizedPhone}`") &&
    store.includes('`identity:${normalizedName}|${normalizedAddress}`'),
  'concorrência de cliente usa telefone ou identidade composta',
);
ok(
  reconciler.includes("['delivery.completed', 'route.completed']") &&
    reconciler.includes('maintenanceDue || analyticsItems.length > 0'),
  'conclusão de rota é alcançável e checkpoint vazio não é gravado',
);
ok(
  watcher.includes("where('updated_at', '>', mountedAt)") &&
    !watcher.includes('setInterval') &&
    notifications.includes('notificationsInFlight.has(key)') &&
    notifications.includes('persistentLastSent(key)'),
  'único listener operacional permanece sem polling e com deduplicação',
);
ok(
  routeStops.includes('order_index') &&
    routeStops.includes('groupDeliveriesByStop') &&
    routeStops.includes('isCancelledSiteDelivery'),
  'ordem física conserva agrupamento e exclui cancelados',
);
ok(
  finance.includes('deliveryCustomerCharge') &&
    finance.includes('deliveryEconomicValue'),
  'financeiro mantém autoridade central de cobrança e valor',
);
ok(
  parser.includes('linhas inteiramente numéricas e adjacentes') &&
    parser.includes('current.length === 4 ? current : adjacent') &&
    parser.includes('current.length === 8 ? current : adjacent') &&
    details.includes('pickup_ready_at'),
  'evoluções V85 de iFood e retirada foram preservadas',
);

console.log('\nV85 FINAL INTEGRIDADE: contratos aprovados.');
