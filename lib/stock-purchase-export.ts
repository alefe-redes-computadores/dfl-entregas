import type {StockPurchaseCoverage} from '@/lib/stock-purchase-coverage';
/** Só itens que ainda precisam ser comprados são exportados. */
export function formatStockPurchaseNeedList(rows:readonly StockPurchaseCoverage[]):string {
 const useful=rows.filter(r=>r.state==='need'&&Number.isFinite(r.remaining)&&r.remaining>0);
 if(!useful.length)return 'DFL | Nenhuma falta pendente de compra.';
 return ['DFL | Faltas para conferir antes de comprar',...useful.map(r=>`• ${r.name}: ${r.remaining.toLocaleString('pt-BR',{maximumFractionDigits:4})} ${r.unit} (falta física ${r.missing.toLocaleString('pt-BR',{maximumFractionDigits:4})}; em pedidos ${r.pending.toLocaleString('pt-BR',{maximumFractionDigits:4})})`),'Lista informativa. Confira embalagens e quantidades antes de comprar.'].join('\n');
}
export function filterStockPurchaseCoverage(rows:readonly StockPurchaseCoverage[],search:string,mode:'all'|'need'|'covered'){
 const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const query=clean(search.trim());
 return rows.filter(r=>(mode==='all'?r.state!=='ok':r.state===mode)&&(!query||clean(r.name).includes(query)));
}
