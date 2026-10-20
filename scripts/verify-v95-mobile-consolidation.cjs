const fs=require('fs');const assert=require('assert');const read=p=>fs.readFileSync(p,'utf8');
const stock=read('app/estoque/page.tsx');const buy=read('app/estoque/compras/page.tsx');const settle=read('app/motoboys/acerto/page.tsx');const queue=read('components/store/OperationalAttentionQueue.tsx');
assert(stock.includes('setCommercialOnly(false)'),'Estoque: limpar revisão comercial ao voltar a todos');
for(const v of ['aria-label="Estado do estoque"','Baixo ·','Zerado ·','aria-label="Produtos do estoque"','Limpar filtros'])assert(stock.includes(v),'Estoque: '+v);
for(const v of ['id="dfl-purchase-review"','Revisar agora','Voltar à busca e revisão','setShowOnlySelected(true)'])assert(buy.includes(v),'Compra: '+v);
for(const v of ['aria-label="Selecionar dia do acerto"','aria-modal="true"',"aria-pressed={settlementStrategy==='offset'}",'disabled={adjustmentBusy||Boolean(existing)}'])assert(settle.includes(v),'Acerto: '+v);
for(const v of ['Lista de pendências filtradas','max-h-[min(48dvh,440px)]','max-w-[40%]'])assert(queue.includes(v),'Fila: '+v);
console.log('V95: Estoque, compra, acerto e fila mobile — contratos aprovados');
