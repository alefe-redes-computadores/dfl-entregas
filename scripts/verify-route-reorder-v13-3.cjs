const fs = require('fs');

const stops = fs.readFileSync('lib/route-stops.ts', 'utf8');
const store = fs.readFileSync('store/useAppStore.ts', 'utf8');
const card = fs.readFileSync('components/home/DeliveryCard.tsx', 'utf8');

const checks = [
  ['ordem visual respeita order_index', stops.includes('`order_index` é a autoridade final')],
  ['render não reparticiona urgentes', !stops.includes('return [...urgent, ...normal]')],
  ['urgente ainda entra primeiro automaticamente', store.includes('delivery.is_urgent ? minIndex - 1 : maxIndex + 1')],
  ['lote urgente ainda entra primeiro automaticamente', store.includes('delivery.is_urgent ? -1000000 + position : tail + 1')],
  ['ordem manual usa rota exibida', card.includes('moveDeliveryToIndex(route.id, delivery.id, boundedTarget)')],
  ['setas móveis preservadas como fallback', card.includes('ArrowUp') && card.includes('ArrowDown') && !card.includes('GripVertical')],
  ['filas virtuais não reordenam', card.includes("route.id !== 'rota-site-aguardando-confirmacao'")],
];

let failed = 0;
for (const [label, pass] of checks) {
  if (pass) console.log(`OK: ${label}`);
  else { console.error(`ERRO: ${label}`); failed += 1; }
}
if (failed) process.exit(1);
console.log('\nV13.3 ORDEM MISTA WHATSAPP/IFOOD/SITE: CONTRATOS OK');
