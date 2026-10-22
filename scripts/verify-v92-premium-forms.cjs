const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const supplier=read('components/stock-supplies/StockSupplierPicker.tsx');const product=read('components/stock-supplies/StockProductPicker.tsx');const queue=read('components/store/OperationalAttentionQueue.tsx');const stock=read('app/estoque/page.tsx');
for(const key of ['aria-modal="true"','max-h-[92dvh]','overscroll-contain','if(saving)return','const duplicate=suppliers.find','await add(item)'])assert(supplier.includes(key),`Supplier: ${key}`);
for(const key of ['aria-modal="true"','role="dialog"','!busy','aria-label="Buscar produto ativo para compra"','disabled={busy}'])assert(product.includes(key),`Product: ${key}`);
for(const key of ['overflow-x-auto','aria-pressed={effectiveFilter===kind}','ações encontradas','new Set(visible.map','focus-visible:outline'])assert(queue.includes(key),`Queue: ${key}`);
assert(stock.includes('{!query&&<section')&&stock.includes('aria-label="Resumo do estoque"'),'Estoque: dashboard compacto na busca');
console.log('V92 FORMULÁRIOS, MODAIS E FILA MOBILE: CONTRATOS OK');
