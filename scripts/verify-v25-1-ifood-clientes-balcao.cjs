const fs=require('fs');
const ok=(v,m)=>{if(!v)throw new Error(`V25.1: ${m}`);console.log('OK:',m)};
const read=f=>fs.readFileSync(f,'utf8');

const nova=read('app/entregas/nova/page.tsx');
const identity=read('lib/customer-identity.ts');
const parser=read('lib/ifood-order-parser.ts');
const confirmations=read('lib/ifood-confirmations.ts');

ok(nova.includes("fulfillmentMode==='counter'"),'Balcão é modalidade explícita');
ok((nova.match(/exclude_customer_metrics:excludeCustomerMetrics\|\|fulfillmentMode==='counter'/g)||[]).length>=2,
   'Balcão fica fora das métricas de cliente em pedido único e multi-pedido');
ok(nova.includes('preferredCustomerId:undefined') && nova.includes('sameCustomerAddress'),
   'multi-pedido revalida identidade por pedido e preserva agrupamento físico');
ok(nova.includes('sameCustomerAddress'), 'agrupamento físico continua baseado em endereço canônico');
ok(nova.includes('stop_group_id:draftStopGroupId'), 'pedidos da mesma parada preservam stop_group_id');
ok(nova.includes('await addDeliveries(deliveriesToCreate)'), 'multi-pedido continua gravado em lote');

ok(identity.includes("normalize('NFD')") || identity.includes('normalizeCustomer'),
   'identidade de cliente possui normalização');
ok(/reusable/.test(identity), 'identidade conserva decisão explícita de reutilização');

ok(parser.includes("normalize('NFD')"),'parser iFood normaliza acentos');
ok(parser.includes('parseIfoodOrdersText'),'parser multi-pedido preservado');
ok(parser.includes('confirmationCode'),'parser preserva código de confirmação');
ok(parser.includes('ifoodId'),'parser preserva ID iFood');

ok(confirmations.includes("delivery.confirmation_code"),'confirmação prioriza código salvo na entrega');
ok(confirmations.includes("customer?.last_confirmation_code"),'fallback histórico do cliente preservado');
ok(confirmations.includes("'missing_code'") && confirmations.includes("'missing_id'"),
   'fila diferencia falta de código e falta de ID');

console.log('\n============================================================');
console.log(' DFL V25.1 — IFOOD + CLIENTES + BALCÃO: CONTRATOS OK');
console.log('============================================================');
