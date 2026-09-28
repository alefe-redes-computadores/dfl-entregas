const fs=require('fs');

const files={
  types:fs.readFileSync('types/index.ts','utf8'),
  finance:fs.readFileSync('lib/delivery-finance.ts','utf8'),
  inbox:fs.readFileSync('lib/delivery-inbox.ts','utf8'),
  nova:fs.readFileSync('app/entregas/nova/page.tsx','utf8'),
  editar:fs.readFileSync('app/entregas/editar/page.tsx','utf8'),
  card:fs.readFileSync('components/home/DeliveryCard.tsx','utf8'),
};

const checks=[
  ['tipo financeiro explícito',files.types.includes("export type DeliveryPaymentState =")],
  ['Delivery persiste payment_state',files.types.includes('payment_state?: DeliveryPaymentState;')],
  ['legado possui fallback financeiro',files.finance.includes('deriveDeliveryPaymentState')],
  ['input novo normaliza estado',files.finance.includes('paymentStateForInput')],
  ['Pix pendente é explícito',files.finance.includes("return 'Pix pendente'")],
  ['nova multi-order persiste estado',files.nova.includes('payment_state:paymentStateForInput(draft.paymentMethod,draft.isPaid)')],
  ['nova comum persiste estado',files.nova.includes('payment_state:paymentStateForInput(paymentMethod,isPaid)')],
  ['edição persiste estado',files.editar.includes('payment_state: paymentStateForInput(paymentMethod, isPaid)')],
  ['card usa semântica central',files.card.includes('deliveryPaymentStateLabel(delivery)')],
  ['duplicidade fraca antiga removida',!files.inbox.includes('Mesmo cliente e endereço já aparecem nas entregas carregadas')],
  ['duplicidade conservadora por dia+valor',files.inbox.includes('Mesmo cliente, endereço e valor já foram lançados hoje')],
];

let bad=0;
for(const [name,ok] of checks){
  console.log(`${ok?'OK':'ERRO'}: ${name}`);
  if(!ok) bad++;
}

for(const file of ['lib/delivery-inbox.ts','lib/delivery-finance.ts']){
  const source=fs.readFileSync(file,'utf8');
  if(/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(source)){
    console.error('ERRO: leitura Firestore introduzida em',file);
    bad++;
  }
}

if(bad){
  console.error(`\nOPERAÇÃO V8A: ${bad} contrato(s) falharam.`);
  process.exit(1);
}
console.log('\nOPERAÇÃO V8A: contratos OK');
