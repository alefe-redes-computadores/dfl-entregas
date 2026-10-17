const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const settlement=read('app/motoboys/acerto/page.tsx');const queue=read('components/store/OperationalAttentionQueue.tsx');const purchase=read('app/estoque/compras/page.tsx');
for(const v of ['adjustmentSubmitting.current||existing','adjustmentSubmitting.current=true','finally{adjustmentSubmitting.current=false;setAdjustmentBusy(false);}','disabled={Boolean(existing)||adjustmentBusy}','aria-label="Valor do ajuste"','aria-label="Motivo do ajuste"'])assert(settlement.includes(v),'Acerto: '+v);
for(const v of ['hasActiveSearch','Limpar filtros',"setQuery('')","setFilter('all')"])assert(queue.includes(v),'Fila: '+v);
for(const v of ['if(busy||!displayed.length)return','aria-label="Seleção em lote de produtos"','aria-live="polite"'])assert(purchase.includes(v),'Compras: '+v);
console.log('V94: ajuste idempotente por interação, filtros e compras protegidos OK');
