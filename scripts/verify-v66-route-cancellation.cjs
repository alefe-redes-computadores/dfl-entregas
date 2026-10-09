const fs=require('fs'); const assert=require('assert/strict');
const s=fs.readFileSync('store/useAppStore.ts','utf8');
const checks=[
 ['rota inteligente ignora cancelados',s.includes('route_id === routeId && !delivery.completed && !isCancelledSiteDelivery(delivery)')],
 ['reordenação manual ignora cancelados',(s.match(/route_id === routeId && !delivery.completed && !isCancelledSiteDelivery\(delivery\)/g)||[]).length===3],
 ['inserção calcula ordem sem cancelados',s.includes('item.route_id === delivery.route_id && !item.completed && !isCancelledSiteDelivery(item)')],
 ['lote calcula ordem sem cancelados',s.includes('!item.completed && !isCancelledSiteDelivery(item)')],
 ['ordenação exclui cancelados dos pendentes',s.includes('const pending = routeDeliveries.filter((delivery) => !delivery.completed && !isCancelledSiteDelivery(delivery));')],
 ['histórico de rota preserva cancelados',s.includes('delivery.completed || isCancelledSiteDelivery(delivery)')],
 ['rota não inicia somente com cancelados',s.includes('route_id === routeId && !isCancelledSiteDelivery(delivery)')],
 ['importação individual bloqueia cancelados',s.includes('if (isCancelledSiteDelivery(delivery)) throw new Error(')],
 ['importação em lote bloqueia cancelados',s.includes('if (items.some(isCancelledSiteDelivery)) throw new Error(')],
];
for(const [name,ok] of checks){assert.ok(ok,name); console.log('OK:',name)}
console.log('V66: 9 contratos de integridade operacional aprovados');
