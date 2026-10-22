const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const queue=read('components/store/OperationalAttentionQueue.tsx');
const shop=read('app/estoque/compras/page.tsx');
for(const x of ['Buscar pendência por cliente, pedido ou endereço','Nenhuma pendência encontrada','haystack.includes(token)','setShowAll(false)','Limpar busca de pendências']) assert(queue.includes(x),'Fila V93: '+x);
for(const x of ['toggleVisibleSelection','Selecionar no filtro','Desmarcar no filtro','selectedDisplayedCount','aria-pressed={!!selected[product.id]}','disabled={busy}','setQuantities(current =>','displayed.map(product => [product.id,shouldSelect])','inclusive os que ainda não aparecem na tela']) assert(shop.includes(x),'Compras V93: '+x);
assert(shop.includes('parseStockQuantityInput'),'Quantidade comercial preservada');
assert(queue.includes('operationalAttentionTasks(orders)'),'Fonte de dados existente preservada');
console.log('V93: busca operacional e selecao em lote de compras OK');
