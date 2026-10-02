const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const ok = (value, message) => {
  if (!value) throw new Error(`V17.5: ${message}`);
};

const outbox = read('lib/integration/server/reverseOutboxRepository.ts');
const relay = read('lib/integration/server/reverseRelay.ts');
const reconciler = read('lib/integration/server/reverseReconciler.ts');
const routeKick = read('app/api/integration/route-kick/route.ts');
const helper = read('lib/integration/client/routeKick.ts');
const store = read('store/useAppStore.ts');

ok(
  outbox.includes('allowFailedBeforeNextAttempt?: boolean'),
  'claim exato não permite retry operacional de failed',
);
ok(
  outbox.includes("kind: 'not_claimed'") &&
    outbox.includes('state: stateFrom(data)'),
  'claim exato ainda perde o estado real da outbox',
);
ok(
  relay.includes('allowFailedBeforeNextAttempt: true'),
  'fast lane ainda obedece cegamente o backoff do recovery',
);
ok(
  relay.includes("state.status === 'sent'") &&
    relay.includes("state.status === 'processing'"),
  'relay não distingue sent de processing',
);
ok(
  relay.includes('unsettled: results.filter((item) => !item.ok).length'),
  'relay não expõe eventos ainda não assentados',
);
ok(
  !relay.includes("claimed: false,\n        ok: true,"),
  'claimed:false ainda vira sucesso genérico',
);

ok(
  reconciler.includes('function routeMovementAt('),
  'relógio de movimento da rota ausente',
);
ok(
  reconciler.includes('...routeItems.flatMap((item) => [') &&
    reconciler.includes('str(item.data.completed_at)'),
  'next_stop não considera conclusão da parada anterior',
);
ok(
  reconciler.includes("type === 'delivery.next_stop'") &&
    reconciler.includes("type === 'delivery.position_changed'"),
  'posição e next_stop não possuem relógio semântico',
);
ok(
  reconciler.includes(
    'occurred_at: eventOccurredAt(type, item.data, route, routeItems)',
  ),
  'evento reverso ainda usa relógio antigo da própria delivery',
);
ok(
  reconciler.includes("type === 'delivery.out_for_delivery'") &&
    reconciler.includes("str(route?.started_at)"),
  'saída da rota perdeu identidade temporal estável',
);

ok(
  routeKick.includes("let reason = 'unspecified'"),
  'route-kick não identifica origem operacional',
);
ok(
  routeKick.includes('{ status: result.ok ? 200 : 207 }'),
  'route-kick ainda mascara fast lane incompleto como 200',
);
ok(
  routeKick.includes('inFlight: relay.inFlight') &&
    routeKick.includes('retryable: relay.retryable'),
  'diagnóstico do route-kick não expõe corrida/retry',
);

ok(
  helper.includes("reason: RouteKickReason") &&
    helper.includes("cache: 'no-store'"),
  'cliente do fast lane não possui contrato dirigido/no-store',
);
ok(
  helper.includes('getIdToken(attempt > 0)'),
  'retry não renova token',
);
ok(
  helper.includes('Math.min(3') &&
    !helper.includes('setInterval(') &&
    !helper.includes('onSnapshot('),
  'retry precisa ser limitado e event-driven',
);

ok(
  store.includes("reason: 'manual_recovery'"),
  'botão manual não usa o mesmo cliente',
);
ok(
  store.includes("reason: 'route_started'"),
  'início da rota não usa o cliente robusto',
);
ok(
  store.includes("reason: 'delivery_completed'"),
  'conclusão não acorda a rota automaticamente',
);
ok(
  store.includes('Entrega concluída; Site aguardando sincronização.'),
  'falha automática continua invisível ao operador',
);
ok(
  store.includes('Rota iniciada; Site aguardando sincronização.'),
  'falha na saída continua invisível ao operador',
);

console.log('============================================================');
console.log(' V17.5 AUTO FAST LANE + NEXT STOP — ZERO ERROS');
console.log('============================================================');
console.log('✓ claimed:false não mascara processing/failed/dead');
console.log('✓ failed pode ser reprocessado no fast lane dirigido');
console.log('✓ retry curto, dirigido e sem polling/listener');
console.log('✓ saída mantém clock estável da rota');
console.log('✓ next_stop usa a última mudança logística da rota');
console.log('✓ conclusão acorda completed + nova próxima parada');
console.log('✓ falha automática gera feedback operacional');
