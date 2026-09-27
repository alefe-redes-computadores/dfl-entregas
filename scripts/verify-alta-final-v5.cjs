const fs=require('fs');
const card=fs.readFileSync('components/home/DeliveryCard.tsx','utf8');
const nova=fs.readFileSync('app/entregas/nova/page.tsx','utf8');
const wa=fs.readFileSync('lib/whatsapp.ts','utf8');
const rec=fs.readFileSync('lib/customer-recurrence.ts','utf8');
const checks=[
 ['recorrência exclui operacional',rec.includes('delivery.exclude_customer_metrics !== true')],
 ['iFood conta recorrência',rec.includes('const completedOrders = history.length')],
 ['iFood não dispara benefício direto',rec.includes('!isIfoodOrder(currentDelivery)')],
 ['marco é sugestão, não benefício automático',rec.includes('avaliar taxa grátis') && !rec.includes('free_delivery: true')],
 ['card usa histórico carregado',card.includes('customerRecurrence(allDeliveries')],
 ['card mostra supercliente/frequente',card.includes("'Supercliente' : 'Frequente'")],
 ['controle operacional fora do modal e antes do salvar',nova.indexOf('Pedido operacional / não contar como cliente')>0 && nova.indexOf('Pedido operacional / não contar como cliente')<nova.indexOf('Salvar Entrega')],
 ['msg2 não detalha troco',wa.includes('Trocos:* conferir a Mensagem 3') && !wa.includes('DINHEIRO PRA ENTREGAR NO CAIXA')],
 ['msg3 preservada',wa.includes('TROCOS · Rota') && wa.includes('buildRouteChangePlan')],
 ['sem leitura Firestore nova',!rec.match(/getDocs\(|onSnapshot\(/)],
];
let bad=0; for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`); if(!ok) bad++;} if(bad)process.exit(1); console.log('\nALTA FINAL V5: contratos OK');
