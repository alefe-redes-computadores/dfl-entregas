const fs = require('fs');
const assert = require('node:assert/strict');

const read = (path) => fs.readFileSync(path, 'utf8');

const store = read('store/useAppStore.ts');
const details = read('app/entregas/details/page.tsx');
const edit = read('app/entregas/editar/page.tsx');
const list = read('app/entregas/page.tsx');
const site = read('lib/integration/site-order.ts');
const persistence = read(
  'lib/integration/server/siteOrderPersistence.ts'
);
const reverse = read(
  'lib/integration/server/reverseReconciler.ts'
);

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`OK: ${name}`);
  } catch (error) {
    console.error(`FALHOU: ${name}`);
    throw error;
  }
}

function has(source, fragment) {
  assert.ok(
    source.includes(fragment),
    `Trecho obrigatório ausente: ${fragment}`
  );
}

const update = store.split(
  'updateDelivery: async (id, updatedData) => {'
)[1]?.split('deleteDelivery: async (id) => {')[0];

const remove = store.split(
  'deleteDelivery: async (id) => {'
)[1];

check('Store possui ações de atualização e exclusão', () => {
  assert.ok(update);
  assert.ok(remove);
});

check('Atualização bloqueia cancelamento antes de alterar rota', () => {
  const guard = update.indexOf(
    'isCancelledSiteDelivery(deliveryToUpdate)'
  );
  const route = update.indexOf('const nextRouteId');
  assert.ok(guard >= 0 && route > guard);
});

check('Exclusão bloqueia cancelamento antes do Firebase', () => {
  const guard = remove.indexOf(
    'isCancelledSiteDelivery(deliveryToDelete)'
  );
  const deletion = remove.indexOf('deleteDoc(');
  assert.ok(guard >= 0 && deletion > guard);
});

check('Cancelamento é exclusivo de pedidos do Site', () => {
  has(site, "delivery.source_system === 'dfl_site'");
  has(site, "'cancelado'");
  has(site, "'cancelada'");
  has(site, "'cancelled'");
  has(site, "'canceled'");
});

check('Ficha identifica pedido cancelado', () => {
  has(details, 'isCancelledSiteDelivery(delivery)');
  has(details, "'Cancelado'");
});

check('Conclusão direta é bloqueada', () => {
  has(details, 'cancelled || delivery.completed || isCompleting');
});

check('Ação de conclusão é bloqueada', () => {
  has(details, 'cancelled || isCompleting');
});

check('Botão de conclusão fica desabilitado', () => {
  has(details, 'disabled={isCompleting || cancelled}');
});

check('Ficha impede acesso à edição', () => {
  has(details, 'disabled={cancelled}');
});

check('Ficha preserva valor original e zera o operacional', () => {
  has(details, 'cancelled ? money(0) : money(customerCharge)');
  has(details, 'Valor original:');
});

check('Lista identifica cancelamento e zera valor', () => {
  has(list, "isCancelledSiteDelivery(delivery) ? 'Cancelado'");
  has(
    list,
    'isCancelledSiteDelivery(delivery) ? 0 : deliveryCustomerCharge(delivery)'
  );
});

check('Edição direta por URL é protegida', () => {
  has(edit, 'isCancelledSiteDelivery(currentDelivery)');
  has(edit, 'Registro protegido.');
});

check('Integração impede reabertura comercial', () => {
  has(persistence, 'const currentCancelled');
  has(persistence, 'const incomingCancelled');
  has(
    persistence,
    '(!currentCancelled || incomingCancelled)'
  );
});

check('Integração preserva data do cancelamento', () => {
  has(persistence, 'site_order_cancelled_at: incoming.timestamp');
});

check('Reconciliador ignora pedido cancelado', () => {
  assert.match(
    reverse,
    /cancel\/i\.test\(str\(delivery\.site_order_status\)\)/
  );
});

check('Fluxo normal de atualização continua disponível', () => {
  has(update, 'const nextRouteId');
  has(update, 'routeChanged');
});

check('Fluxo normal de exclusão continua disponível', () => {
  has(remove, "deleteDoc(doc(db, 'deliveries', id))");
});

console.log(
  `\nV64.4: ${passed} contratos estáticos aprovados.`
);
