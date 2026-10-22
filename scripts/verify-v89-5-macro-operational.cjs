const fs=require('fs');const assert=require('assert');
const get=p=>fs.readFileSync(p,'utf8');
const attention=get('lib/operational-attention.ts');const store=get('app/loja/page.tsx');const modal=get('components/store/PerformanceModals.tsx');const settle=get('app/motoboys/acerto/page.tsx');const site=get('components/store/SiteAdminHub.tsx');
for(const text of ['deriveDeliveryPaymentState','isCancelledSiteDelivery','siteInboxState','pendingPix','collectOnDelivery']) assert(attention.includes(text));
const queue=get('components/store/OperationalAttentionQueue.tsx');for(const text of ['Pontos para conferir','Site · confirmar','Site · montar rota','Pix · verificar pagamento','Cobrança na entrega'])assert(queue.includes(text));assert(store.includes('<OperationalAttentionQueue'));
assert(modal.includes('deriveDeliveryPaymentState(delivery)'));assert(!modal.includes("delivery.is_paid?'Pago no app'"));
assert(settle.includes('Não foi possível copiar o resumo.'));assert(settle.includes('ACERTO REGISTRADO') && settle.includes('AGUARDANDO CONFERÊNCIA'));assert(site.includes('pendingTasks'));
console.log('V89.5: loja, triagem local, financeiro, Site e acerto: contratos aprovados');
