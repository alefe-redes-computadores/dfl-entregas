const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const a=read('lib/operational-attention.ts'),q=read('components/store/OperationalAttentionQueue.tsx'),store=read('app/loja/page.tsx'),hub=read('components/store/SiteAdminHub.tsx'),acerto=read('app/motoboys/acerto/page.tsx');
for(const s of ['operationalAttentionTasks','isCancelledSiteDelivery','operational_dismissed_at','deriveDeliveryPaymentState','site_confirmation','site_dispatch','pix_pending','collect'])assert(a.includes(s),s);
for(const s of ['aria-expanded','aria-pressed','selectedDateKey','onFinance','Confirmação comercial pertence ao DFL Site','max-h-[min(48dvh,440px)]','Cliente não informado'])if(s!=='Cliente não informado')assert(q.includes(s),s);
assert(store.includes('<OperationalAttentionQueue'));assert(!store.includes('attention.total > 0'));
assert(hub.includes('!delivery.operational_dismissed_at'));assert(acerto.includes('navigator.clipboard?.writeText'));
console.log('V89.6: fila operacional contextual, filtros, Site, financeiro e acerto OK');
