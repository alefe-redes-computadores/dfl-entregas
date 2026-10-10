const fs=require('fs');
const read=(p)=>fs.readFileSync(p,'utf8');
const files={
  identity:read('lib/customer-identity.ts'),
  parser:read('lib/ifood-order-parser.ts'),
  inbox:read('lib/delivery-inbox.ts'),
  analytics:read('lib/motoboy-analytics.ts'),
  nova:read('app/entregas/nova/page.tsx'),
  route:read('components/home/RouteAccordion.tsx'),
  confirmations:read('app/confirmacoes/page.tsx'),
  whatsapp:read('lib/whatsapp.ts'),
  acerto:read('app/motoboys/acerto/page.tsx'),
};
const checks=[
 ['identidade exige nome exato e endereço igual sem conflito',files.identity.includes('exactName &&')&&files.identity.includes('sameAddress &&')&&files.identity.includes('!phoneConflict')],
 ['UI usa evidência canônica',files.nova.includes('customerIdentityEvidence(customer, customerName')],
 ['mesmo endereço/nome diferente é revisão',files.nova.includes("kind: 'same_address'")],
 ['parser aceita iFood sem palavra ID',files.parser.includes('ifood(?:\\s+id)?')],
 ['pedido curto limitado ao dia',files.inbox.includes('já lançado hoje')],
 ['rota ativa persistida',files.route.includes('dfl-active-operational-route-v1')],
 ['nova entrega recupera rota ativa',files.nova.includes("localStorage.getItem('dfl-active-operational-route-v1')")],
 ['acerto agrupa paradas',files.analytics.includes('groupDeliveriesByStop(completedDeliveries)')],
 ['taxa usa parada física',files.analytics.includes('calculateMotoboyFee(motoboy.payment_rule,physicalDeliveryCount)')],
 ['acerto carrega saldo anterior',files.acerto.includes('priorSettlement')],
 ['saldo anterior entra na matemática',files.analytics.includes('retainedCash+priorStoreCredit-liquidFee-priorMotoboyCredit')],
 ['WhatsApp explicita mesma parada',files.whatsapp.includes('pedidos / mesma parada')],
 ['dinheiro usa motor financeiro central V3C',files.whatsapp.includes('routeCashFlow(deliveries, route.change_money)')],
 ['Central ordena por completed_at',files.confirmations.includes("deliveryA?.completed_at")],
 ['Central possui código inválido',files.confirmations.includes('markInvalidCode')],
 ['código inválido limpa memória',files.confirmations.includes('last_confirmation_code:undefined')],
 ['código confirmado reaprende memória',files.confirmations.includes('last_confirmation_code:code')],
];
let fail=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`);if(!ok)fail++;}
if(fail){console.error(`\n${fail} contrato(s) falharam.`);process.exit(1);}
console.log('\nOPERAÇÃO V3B: contratos estáticos OK');
