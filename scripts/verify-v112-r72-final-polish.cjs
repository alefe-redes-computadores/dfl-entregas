const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`V112 R72: ${label}`);
  console.log('OK:', label);
};

const watcher = read('components/SiteOrderNotificationWatcher.tsx');
const inbox = read('app/loja/caixa-de-entrada/page.tsx');
const deliveries = read('app/entregas/page.tsx');
const purchases = read('app/estoque/compras/page.tsx');
const stock = read('app/estoque/page.tsx');

ok((watcher.match(/onSnapshot\(/g) || []).length === 1, 'listener operacional permanece único');
ok(watcher.includes('new Set(readUnreadSiteOrderIds())'), 'não lidos são consultados uma vez por lote');
ok(watcher.includes('new Map(state.customers.map'), 'clientes são indexados uma vez por lote');
ok(watcher.includes('markUnreadSiteOrders(newUnreadIds)'), 'badge recebe atualização agrupada');
ok(!inbox.includes('await Haptics.impact'), 'haptics não bloqueiam análise da Caixa');
ok(inbox.includes('void Haptics.impact') && inbox.includes('.catch(() => undefined)'), 'falha tátil é isolada');
ok(!deliveries.includes('const matchesOrigin =') && !deliveries.includes('const matchesFulfillment ='), 'lista não repete filtros já aplicados');
ok(purchases.includes('STOCK_PURCHASE_DRAFT_KEY'), 'montagem possui rascunho persistente');
ok(purchases.includes('Compra em andamento recuperada.'), 'recuperação é comunicada ao operador');
ok(purchases.includes('localStorage.removeItem(STOCK_PURCHASE_DRAFT_KEY)'), 'rascunho é limpo após criar a compra');
ok(stock.includes('aria-label="Resumo do estoque"') && stock.includes('grid-cols-3'), 'resumo do estoque foi compactado');

console.log('V112 R72 POLIMENTO FINAL: contratos estáticos OK');
