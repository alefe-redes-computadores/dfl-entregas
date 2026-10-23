// V106: conferência de arraste prolongado, agrupamento compartilhado e atualização de cliente.
const fs=require('fs');
const assert=require('node:assert/strict');
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
const route=fs.readFileSync('components/home/RouteAccordion.tsx','utf8');
const hook=fs.readFileSync('hooks/useOptimizedDeliveries.ts','utf8');
const checks=[
 ['alça e pointer capture retirados do pacote mobile', !/handleReorderPointerDown|setPointerCapture\(event.pointerId\)|<GripVertical/.test(card)],
 ['setas estão visíveis no Android', /role="group" aria-label="Subir ou descer parada" className="flex/.test(card)],
 ['seta subir protege trava e limite', /disabled=\{reorderBusy \|\| orderLocked \|\| \(position \|\| 1\) <= 1\}/.test(card)],
 ['seta descer protege trava e limite', /disabled=\{reorderBusy \|\| orderLocked \|\| \(position \|\| 1\) >= pendingCount\}/.test(card)],
 ['reordenar somente dentro da mesma rota', /await moveDeliveryToIndex\(route.id, delivery.id, boundedTarget\)/.test(card)],
 ['gravação é guardada contra toque duplo', /if \(!canReorder \|\| reorderBusyRef.current\) return/.test(card)],
 ['pedidos no mesmo endereço continuam agrupados', /groupDeliveriesByStop\(deliveries\)/.test(hook) && /stopDeliveries=\{stopGroup\.deliveries\}/.test(route)],
 ['índice não depende de estado expandido', /return useMemo\(\(\) =>/.test(hook) && !/setState\(/.test(hook)],
 ['dados de vizinhança atualizam ao editar cliente', /\[deliveries, getCustomerById, customerSnapshot\]/.test(hook) && /getCustomerById, customers\)/.test(route)],
 ['rotas não reagrupam a mesma lista por render', /allStopGroups, pendingStopGroups } = useOptimizedDeliveries/.test(route) && !/const pendingStopGroups = useMemo/.test(route) && !/const allStopGroups = useMemo/.test(route)],
 ['resumo usa grupos de parada compartilhados', /const totalStops = allStopGroups\.length/.test(route) && /const pendingStopsCount = pendingStopGroups\.length/.test(route)],
 ['sem novas consultas remotas nos módulos de apresentação', !/\b(?:onSnapshot|runTransaction|collection\()/.test([card,hook,route].join('\n'))],
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log('OK:',label)}
console.log('V106 ARRASTE LONGO + CONSISTÊNCIA DA ROTA: 12 contratos aprovados');
