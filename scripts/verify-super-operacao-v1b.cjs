const fs=require('fs'),r=p=>fs.readFileSync(p,'utf8');
const f={
 route:r('components/home/RouteAccordion.tsx'), wa:r('lib/whatsapp.ts'),
 phone:r('lib/phone.ts'), change:r('lib/route-change-plan.ts'),
 store:r('store/useAppStore.ts'), nova:r('app/entregas/nova/page.tsx'),
 edit:r('app/entregas/editar/page.tsx'), customer:r('components/customers/CustomerForm.tsx')
};
const c=[
 ['3 tipos no copiador',f.route.includes('msgType: 1 | 2 | 3')],
 ['card Trocos no sheet',f.route.includes('Mensagem 3 (Trocos)')],
 ['clipboard msg3',f.route.includes("msgsToCopy[2]")],
 ['msg2 sem troco da bag no rótulo',f.route.includes('Bebidas, maquininha, códigos e dinheiro esperado na volta.')],
 ['msg3 gerada',f.wa.includes('TROCOS · Rota')&&f.wa.includes("msg3.join('\\n')")],
 ['motor financeiro único',f.change.includes("routeCashFlow")],
 ['telefone central',f.phone.includes('normalizeBrazilPhone')&&f.nova.includes('formatBrazilPhone')&&f.edit.includes('formatBrazilPhone')],
 ['customer central',f.customer.includes('formatBrazilPhone')],
['smart não trava tudo', !fs.readFileSync('components/home/RouteAccordion.tsx','utf8').includes('order_locked: optimizerEdited')],
['reorder pula trava', fs.readFileSync('store/useAppStore.ts','utf8').includes('const freeIndices = groups.map') && fs.readFileSync('store/useAppStore.ts','utf8').includes('[groups[currentIndex], groups[targetIndex]] = [groups[targetIndex], groups[currentIndex]]')],
 ['helpers sem firestore',!f.phone.includes('firebase')&&!f.change.includes('firebase')&&!f.change.includes('getDocs(')],
];
let bad=0;for(const [n,ok] of c){console.log(`${ok?'OK':'ERRO'}: ${n}`);if(!ok)bad++}
if(bad)process.exit(1);console.log('\nSUPER OPERAÇÃO V1B: contratos OK');
