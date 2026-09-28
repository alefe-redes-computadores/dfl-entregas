const fs=require('fs');
const {execFileSync}=require('child_process');
let fail=0;
const ok=(n,v)=>{console.log(`${v?'OK':'ERRO'}: ${n}`);if(!v)fail++};
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';

const nova=read('app/entregas/nova/page.tsx');
const edit=read('app/entregas/editar/page.tsx');
const inbox=read('lib/delivery-inbox.ts');
const parser=read('lib/ifood-order-parser.ts');
const finance=read('lib/delivery-finance.ts');
const cash=read('lib/route-cash-flow.ts');
const card=read('components/home/DeliveryCard.tsx');

console.log('--- RELEASE CONTRACT ---');
ok('gate único existe',fs.existsSync('scripts/pre-apk.cjs'));
ok('Nova usa estado financeiro explícito',nova.includes('payment_state'));
ok('Editar usa estado financeiro explícito',edit.includes('payment_state'));
ok('Card usa apresentação financeira central',card.includes('deliveryPaymentStateLabel'));
ok('Caixa entrega objeto estruturado à Nova',nova.includes('inboxParsedRef.current = draft.parsed'));
ok('Caixa não consulta Firestore diretamente',!/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(inbox));
ok('parser não consulta Firestore',!/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(parser));
ok('financeiro não consulta Firestore',!/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(finance));
ok('motor de troco não consulta Firestore',!/\b(getDocs|getDoc|onSnapshot|collection|query)\s*\(/.test(cash));
ok('motor financeiro de rota preservado',cash.includes('expectedPhysicalReturn')&&cash.includes('plannedPixChange'));

const diff=execFileSync('git',['diff','--unified=0'],{encoding:'utf8'});
const added=diff.split('\n').filter(x=>x.startsWith('+')&&!x.startsWith('+++')).join('\n');
ok('diff sem novo getDocs',!/\bgetDocs\s*\(/.test(added));
ok('diff sem novo onSnapshot',!/\bonSnapshot\s*\(/.test(added));

if(fail){
 console.error(`\nRELEASE CANDIDATE BLOQUEADO: ${fail} problema(s).`);
 process.exit(1);
}
console.log('\nRELEASE CANDIDATE V8D: contrato OK');
