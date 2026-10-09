const fs=require('node:fs');const assert=require('node:assert/strict');
const s=fs.readFileSync('app/entregas/details/page.tsx','utf8');
const from=s.indexOf('const executeCompletion');const to=s.indexOf('const handleCompletionAction',from);
assert.ok(from>=0 && to>from,'Fluxo de conclusão');const body=s.slice(from,to);
for(const [name,check] of [
 ['haptics protegidos',s.includes('await Haptics.impact({ style });') && s.includes('Android sem haptics')],
 ['persistência precede feedback',body.indexOf('await updateDelivery(delivery.id, payload)')<body.indexOf('void vibrate(ImpactStyle.Medium)')],
 ['feedback não bloqueante',body.includes('void vibrate(ImpactStyle.Medium)')],
 ['falha tátil não mascara erro',body.includes('void vibrate(ImpactStyle.Heavy)')],
 ['balcão retorna após persistir',body.includes('if (!logistics)') && body.includes('router.replace(deliveriesReturn)')],
 ['iFood mantém código salvo',body.includes('confirmation_code: codeToSave')],
 ['falha de gravação mantém aviso',body.includes('Não foi possível concluir o pedido.')],
]){assert.ok(check,name);console.log('OK:',name)}
console.log('V66 BALCÃO: 7 contratos aprovados');
