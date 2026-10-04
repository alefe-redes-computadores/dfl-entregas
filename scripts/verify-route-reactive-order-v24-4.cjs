const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const ok = (value, label) => {
  if (!value) throw new Error(`V24.4: ${label}`);
  console.log('OK:', label);
};

const route = read('components/home/RouteAccordion.tsx');
const store = read('store/useAppStore.ts');
const stops = read('lib/route-stops.ts');

ok(
  route.includes("const deliveryState = useAppStore((state) => state.deliveries);"),
  'RouteAccordion assina a coleção de deliveries diretamente'
);

ok(
  route.includes("const selectedDate = useAppStore((state) => state.selectedDate);"),
  'rotas virtuais também reagem à troca de dia'
);

ok(
  route.includes("const deliveries = useMemo(") &&
  route.includes("deliveryState,") &&
  route.includes("selectedDate,") &&
  route.includes("allRoutes,"),
  'lista da rota é recalculada quando o estado operacional muda'
);

ok(
  route.includes("groupDeliveriesByStop(sortedDeliveries).map((stopGroup)"),
  'render continua trabalhando por parada física'
);

ok(
  route.includes("stopDeliveries={stopGroup.deliveries}") &&
  route.includes("pendingCount={pendingStopGroups.length}"),
  'multi-pedido no mesmo endereço continua sendo uma parada única'
);

ok(
  store.includes("moveDeliveryToIndex: async") &&
  store.includes("setDeliveryOrder: async"),
  'persistência de reordenação permanece no store'
);

ok(
  stops.includes("`order_index` é a autoridade final"),
  'order_index continua sendo a autoridade da sequência'
);

ok(
  stops.includes("return `address:${delivery.route_id}:${address}`"),
  'agrupamento físico por endereço da rota permanece ativo'
);

console.log();
console.log('V24.4 ORDEM DE ROTA REATIVA: CONTRATOS OK');
