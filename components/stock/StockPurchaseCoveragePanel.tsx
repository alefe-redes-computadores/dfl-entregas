'use client';
import {useMemo,useState} from 'react';
import {ChevronDown,ChevronUp,ShoppingBasket,ShieldCheck,ClipboardCopy,Search} from 'lucide-react';
import {toast} from '@/lib/operational-toast';
import {formatStockPurchaseNeedList,filterStockPurchaseCoverage} from '@/lib/stock-purchase-export';
import type {StockProduct} from '@/types';
import {buildStockPurchaseCoverage} from '@/lib/stock-purchase-coverage';
import {formatStockQuantity} from '@/lib/stock-quantity';
export function StockPurchaseCoveragePanel({products,committed}:{products:StockProduct[];committed:ReadonlyMap<string,number>}){
 const [expanded,setExpanded]=useState(false);
 const [search,setSearch]=useState('');
 const [mode,setMode]=useState<'all'|'need'|'covered'>('all');
 const rows=useMemo(()=>buildStockPurchaseCoverage(products,committed),[products,committed]);
 const need=rows.filter(r=>r.state==='need');
 const covered=rows.filter(r=>r.state==='covered');
 const shown=useMemo(()=>filterStockPurchaseCoverage(rows,search,mode),[rows,search,mode]);
 const copyNeeded=async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard indisponivel');await navigator.clipboard.writeText(formatStockPurchaseNeedList(rows));toast.success('Lista de faltas copiada.');}catch{toast.error('Não foi possível copiar a lista.');}};
 if(!need.length&&!covered.length)return null;
 return <section aria-label="Cobertura de compras abertas" className="mx-3 mb-4 rounded-[22px] border border-sky-500/20 bg-sky-500/[.045] p-4">
  <div className="flex items-start justify-between gap-2">
   <div><p className="flex items-center gap-2 text-xs font-black text-sky-300"><ShoppingBasket size={16}/> Cobertura das compras</p>
   <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Falta física e compras abertas são números diferentes.</p></div>
   <ShieldCheck size={18} className="shrink-0 text-emerald-400"/>
  </div>
  <div className="mt-3 grid grid-cols-2 gap-2">
   <div className="rounded-xl bg-zinc-950/50 p-3"><p className="text-[10px] text-zinc-400">Ainda faltam comprar</p><p className="mt-1 text-2xl font-black text-amber-300">{need.length}</p></div>
   <div className="rounded-xl bg-zinc-950/50 p-3"><p className="text-[10px] text-zinc-400">Já cobertos por pedidos</p><p className="mt-1 text-2xl font-black text-emerald-300">{covered.length}</p></div>
  </div>
  <button type="button" disabled={!need.length} onClick={()=>void copyNeeded()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.06] text-xs font-black text-amber-200 disabled:opacity-40"><ClipboardCopy size={15}/> Copiar lista do que falta comprar</button>
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-zinc-700/60 px-3 text-xs font-bold text-zinc-300">
   {expanded?'Ocultar detalhes':'Ver produtos e faltas'}{expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
  </button>
  {expanded&&<div className="mt-3 space-y-3">
    <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input aria-label="Buscar produto na cobertura" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrar produtos" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-xs text-zinc-100 outline-none focus:border-sky-500"/></div>
    <div className="grid grid-cols-3 gap-1.5">{([['all','Todos'],['need','Faltando'],['covered','Cobertos']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={mode===key} onClick={()=>setMode(key)} className={`min-h-10 rounded-lg border px-2 text-[10px] font-black ${mode===key?'border-sky-500/40 bg-sky-500/10 text-sky-300':'border-zinc-800 text-zinc-400'}`}>{label}</button>)}</div>
    <div className="max-h-72 space-y-2 overflow-y-auto">
    {shown.slice(0,40).map(row=><div key={row.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
     <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-black text-zinc-200">{row.name}</p><span className={row.state==='covered'?'text-[10px] font-bold text-emerald-300':'text-[10px] font-bold text-amber-300'}>{row.state==='covered'?'Pedido cobre':'Falta comprar'}</span></div>
     <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Faltam {formatStockQuantity(row.missing,row.unit as StockProduct['unit'])} · Em pedidos {formatStockQuantity(row.pending,row.unit as StockProduct['unit'])} · Necessidade restante {formatStockQuantity(row.remaining,row.unit as StockProduct['unit'])}</p>
    </div>)}
   {shown.length>40&&<p className="text-center text-[10px] text-zinc-500">Exibindo 40 produtos prioritários.</p>}
    {!shown.length&&<p className="py-4 text-center text-xs text-zinc-500">Nenhum produto nesse filtro.</p>}
    </div>
  </div>}
  <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Somente acompanhamento. Pedido aberto não movimenta estoque e não substitui o recebimento.</p>
 </section>;
}
