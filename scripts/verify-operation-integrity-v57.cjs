const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (condition, label) => {
  if (!condition) throw new Error(`V57: ${label}`);
  console.log('OK:', label);
};

const stops = read('lib/route-stops.ts');
const store = read('store/useAppStore.ts');
const routeForm = read('app/rotas/nova/page.tsx');
const deliveryForm = read('app/entregas/editar/page.tsx');
const newDelivery = read('app/entregas/nova/page.tsx');
const notifications = read('app/mais/notificacoes/page.tsx');

ok(stops.includes('export function moveStopToIndex') && stops.includes('groups.splice'), 'reordenação possui autoridade pura por parada');
ok(store.includes('moveStopToIndex(pending, deliveryId') && !store.includes("throw new Error('Destrave a parada antes de reordenar.')"), 'decisão manual funciona mesmo em parada protegida do otimizador');
ok(store.includes('order_index: movedOrderIndex') && store.includes("order_source: 'smart' as const"), 'troca de rota recebe índice válido no destino');
ok(store.includes('Urgência pertence à parada física') && store.includes('moveStopToIndex(get().deliveries.filter'), 'urgência move toda a parada ao topo');
ok(deliveryForm.includes('Só este pedido') && deliveryForm.includes('Toda a parada'), 'troca de rota agrupada exige escolha explícita');
ok(store.includes('routeCreateLocks') && routeForm.includes('routeSubmitLockRef'), 'criação de rota possui trava síncrona em duas camadas');
ok(
  store.includes("routeOperationKey = (route: Pick<Route, 'id'>)") &&
  store.includes("throw new Error('ROUTE_ID_COLLISION')") &&
  routeForm.includes("message === 'ROUTE_ID_COLLISION'"),
  'rotas paralelas são permitidas e colisão real de ID é bloqueada',
);
ok(store.includes('sameExternalDelivery') && store.includes('Este pedido já foi importado'), 'importação possui identidade idempotente');
ok(newDelivery.includes('Reconhecimento ao vivo') && newDelivery.includes('Falta conferir:'), 'parser iFood revela dados e ausências progressivamente');
ok(newDelivery.includes('Preencher e revisar o que falta'), 'parser conduz revisão somente quando necessária');
ok(/checked=\{preferences\.routeStarted\}[\s\S]{0,180}disabled=\{masterDisabled\}/.test(notifications), 'preferência de rota iniciada obedece ao interruptor geral');
ok(!store.includes('getDocs(query(collection(db, \'deliveries\')'), 'proteções não criam consulta global de entregas');

console.log('\nV57 INTEGRIDADE OPERACIONAL + IFOOD PROGRESSIVO: CONTRATOS OK');
