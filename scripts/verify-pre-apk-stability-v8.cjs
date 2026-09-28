const fs=require('fs');
const path=require('path');
let fail=0;
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const ok=(name,value)=>{console.log(`${value?'OK':'ERRO'}: ${name}`);if(!value)fail++};

const types=read('types/index.ts');
const finance=read('lib/delivery-finance.ts');
const parser=read('lib/ifood-order-parser.ts');
const inbox=read('lib/delivery-inbox.ts');
const nova=read('app/entregas/nova/page.tsx');
const edit=read('app/entregas/editar/page.tsx');
const card=read('components/home/DeliveryCard.tsx');
const cash=read('lib/route-cash-flow.ts');
const confirm=read('app/confirmacoes/page.tsx');
const store=read('store/useAppStore.ts');

console.log('\n--- CONTRATO FINANCEIRO ---');
ok('Delivery possui payment_state',types.includes('payment_state'));
ok('estado financeiro tem fallback legado',finance.includes('deriveDeliveryPaymentState'));
ok('Nova persiste payment_state',nova.includes('payment_state'));
ok('Edição persiste payment_state',edit.includes('payment_state'));
ok('Card usa semântica financeira central',card.includes('deliveryPaymentStateLabel'));
ok('troco físico usa motor central',cash.includes('expectedPhysicalReturn')&&cash.includes('plannedPixChange'));

console.log('\n--- PARSER / CAIXA / NOVA ---');
ok('parser distingue negação de pagamento',parser.includes('negative')&&parser.includes('explicitPaid'));
ok('Pix pendente é negativo',parser.includes('pix\\s+pendente'));
ok('ID iFood suporta 4+4',parser.includes('(\\d{4})[\\s.-]?(\\d{4})'));
ok('CEP é protegido',parser.includes('POSTAL.test(line)'));
ok('telefone internacional +55 tratado',parser.includes("digits.startsWith('55')"));
ok('Caixa preserva estado pago',inbox.includes("parsed.isPaid ? ' · pago' : ''"));
ok('Caixa -> Nova transporta parsed estruturado',nova.includes('inboxParsedRef.current = draft.parsed')&&nova.includes('? [inboxParsedRef.current]'));
ok('multi-order persiste stop_group_id',nova.includes('stop_group_id:stopGroupId')||nova.includes('stop_group_id: stopGroupId'));
ok('multi-order valida ID/código',nova.includes("replace(/\\D/g,'').length!==8")||nova.includes("replace(/\\D/g, '').length !== 8"));

console.log('\n--- IDENTIDADE / DUPLICIDADE ---');
ok('Caixa possui deduplicação local',inbox.includes('duplicate')||inbox.includes('duplic'));
ok('Nova reutiliza findOrCreateCustomer',nova.includes('findOrCreateCustomer'));
ok('edição preserva vínculo de customer',edit.includes("currentDelivery?.customer_id")||edit.includes('currentDelivery?.customer_id'));

console.log('\n--- IFOOD / CONFIRMAÇÃO ---');
ok('Central existe',!!confirm);
ok('Central trabalha pendências',confirm.includes('pending'));
ok('código de confirmação está no fluxo',nova.includes('confirmationCode')&&confirm.includes('confirmation'));
ok('ID iFood está no fluxo',nova.includes('ifoodId')&&confirm.includes('ifood'));

console.log('\n--- LEITURAS QUENTES ---');
for(const [name,src] of [['parser',parser],['inbox',inbox],['finance',finance],['cash',cash]]){
  ok(`${name} sem Firestore direto`,!/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(src));
}

console.log('\n--- STORE / SYNC ---');
ok('store operacional presente',!!store);
ok('timestamps de atualização presentes',store.includes('updated_at')||store.includes('updatedAt'));

if(fail){
 console.error(`\nALTA V8C BLOQUEADA: ${fail} contrato(s) falharam.`);
 process.exit(1);
}
console.log('\nALTA V8C: contratos cruzados estáticos OK');
