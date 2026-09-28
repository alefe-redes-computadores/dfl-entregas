const fs=require('fs');
const read=(p)=>fs.readFileSync(p,'utf8');
const f={
 cash:read('lib/route-cash-flow.ts'),
 whats:read('lib/whatsapp.ts'),
 checklist:read('components/routes/RouteDepartureChecklist.tsx'),
 nova:read('app/rotas/nova/page.tsx'),
 edit:read('app/rotas/editar/page.tsx'),
 portal:read('app/confirmar/page.tsx'),
 central:read('app/confirmacoes/page.tsx'),
};
const checks=[
 ['motor físico central criado',f.cash.includes('expectedPhysicalReturn')],
 ['cliente entrega dinheiro separado do valor do pedido',f.cash.includes('tenderedCash')],
 ['troco em espécie limitado ao dinheiro inicial',f.cash.includes('plannedCashChange')],
 ['restante previsto via Pix',f.cash.includes('plannedPixChange')],
 ['input nova rota usa parser robusto',f.nova.includes('parseMoneyDraft(changeMoney)')],
 ['input editar rota usa parser robusto',f.edit.includes('parseMoneyDraft(change)')],
 ['checklist usa motor único',f.checklist.includes('routeCashFlow(deliveries, route.change_money)')],
 ['checklist mostra Pix previsto',f.checklist.includes('Pix previsto')],
 ['WhatsApp usa motor único',f.whats.includes('routeCashFlow(deliveries, route.change_money)')],
 ['WhatsApp de trocos mantém dinheiro recebido do cliente',f.whats.includes('tenderedCash') || f.whats.includes('tendered')],
 ['WhatsApp de trocos mantém retorno físico previsto',f.whats.includes('expectedPhysicalReturn') || f.whats.includes('retornoFisico')],
 ['portal tem sucesso explícito',f.portal.includes('Funcionou · próximo')],
 ['portal tem código errado explícito',f.portal.includes('invalidCodeAndContinue')],
 ['código errado limpa Delivery',f.portal.includes('confirmation_code: undefined')],
 ['código errado limpa memória do cliente',f.portal.includes('last_confirmation_code: undefined')],
 ['sucesso valida memória do código',f.portal.includes('last_confirmation_code: validCode')],
 ['portal segue para próxima pendência',f.portal.includes('goNextOrLeave')],
 ['central expõe modo sequencial',f.central.includes('Modo sequencial')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'ERRO'}: ${name}`);if(!ok)failed++;}
if(failed){console.error(`\n${failed} contrato(s) V3C falharam.`);process.exit(1);}
console.log('\nOPERAÇÃO V3C: contratos estáticos OK');
