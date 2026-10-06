const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const ok=(v,m)=>{if(!v)throw new Error(`V25.2: ${m}`);console.log('OK:',m)};

const details=read('app/entregas/details/page.tsx');
const route=read('components/home/RouteAccordion.tsx');
const store=read('store/useAppStore.ts');

console.log('=== BALCÃO / RETIRADA ===');
ok(details.includes("mode === 'counter'"),'ficha reconhece Balcão explicitamente');
ok(details.includes("if (!logistics) {") && details.includes("router.replace(deliveriesReturn);"),
  'atendimento sem rota retorna deterministicamente à lista após a baixa');
const executeStart=details.indexOf('const executeCompletion');
const executeEnd=details.indexOf('const handleCompletionAction',executeStart);
const execute=details.slice(executeStart,executeEnd);
ok(execute.includes('await updateDelivery(delivery.id, payload)'),
  'retorno só ocorre depois da persistência da baixa');
ok(execute.indexOf('await updateDelivery(delivery.id, payload)') < execute.indexOf('router.replace(deliveriesReturn)'),
  'navegação não antecede a gravação');
ok(details.includes("if (logistics) {") && details.includes("if (!route) {"),
  'validação de rota continua restrita às entregas logísticas');

console.log('\n=== PÓS-ROTA IFOOD ===');
ok(store.includes('Encerrar a rota não significa que os pedidos já foram confirmados'),
  'fechamento mantém separação entrega concluída x confirmação externa');
ok(store.includes("id: `ifood-route-${delivery.id}`"),
  'pendência pós-rota possui identidade idempotente por entrega');
ok(store.includes(".filter((delivery) => delivery.origin === 'ifood')"),
  'fila pós-rota nasce somente de pedidos iFood');
ok(store.includes("status: 'pending'") && store.includes('addIfoodPendingConfirmations(confirmationItems)'),
  'fechamento prepara fila externa');
ok(store.includes("existing.status === 'resolved'") &&
   store.includes("? 'resolved'"),
  'pendência resolvida não ressuscita ao reconciliar a fila');
ok(store.includes('delivery.confirmation_code || customer?.last_confirmation_code'),
  'código salvo é carregado como dado, não como confirmação externa');
ok(store.includes('notifyIfoodRoutePending('),
  'rota fechada pode notificar confirmações externas pendentes');

console.log('\n=== CTA PÓS-ROTA ===');
ok(route.includes('.ifoodPendingConfirmations') &&
   route.includes("(item.status || 'pending') === 'pending'"),
  'CTA considera somente pendências externas ainda abertas');
ok(route.includes("label: 'Confirmar iFood'"),
  'fechamento oferece ação explícita Confirmar iFood');
ok(route.includes('router.push(href)'),
  'ação pós-rota navega para a fila correspondente');

console.log('\n============================================================');
console.log(' DFL V25.2 — CONTRATOS OK');
console.log('============================================================');
