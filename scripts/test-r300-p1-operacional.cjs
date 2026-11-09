const fs=require('fs'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const code=read('lib/operation/departure-stop-summary.ts');
assert(code.includes('ID iFood ${ifood}')&&code.includes("return 'Sem referência comercial"));
const details=read('app/entregas/details/page.tsx');
assert(details.includes('deliveryReferenceLabel(delivery)')&&details.includes('manual_order_items'));
const home=read('components/home/OperationalCommandCenter.tsx');
assert(home.includes('/confirmacoes?route=')&&home.includes('deliveryActionHref(firstMissingIfoodCode)'));
const center=read('app/confirmacoes/page.tsx');
assert(center.includes('delivery.route_id === requestedRouteId')&&center.includes('Registrar código')&&center.includes('sem finalizar a rota'));
const edit=read('app/entregas/editar/page.tsx'),create=read('app/entregas/nova/page.tsx');
assert(create.includes('manual_order_items:origin')&&edit.includes('manual_order_items: origin')&&create.includes('O que é o pedido?'));
const policy=read('lib/integration/manualMessagingPolicy.ts');
assert(policy.includes('payload.order_description =')&&policy.includes("'delivery.completed'"));
// Nunca fingir que a próxima parada de pedidos manuais está implementada.
assert(!policy.includes("| 'delivery.next_stop'"));
assert(read('scripts/pre-apk.cjs').includes("'scripts/test-r300-p1-operacional.cjs'"));
console.log('R300 P1: contratos de identidade, central iFood durante rota, itens manuais e gate de mensageria OK');
