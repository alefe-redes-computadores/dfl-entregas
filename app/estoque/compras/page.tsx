// app/estoque/compras/page.tsx
'use client';
import { useMemo,useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle,Check,PackagePlus,Plus,Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { purchaseSuggestion,stockLevel } from '@/lib/stock';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import type { StockProduct,StockSupply } from '@/types';

const prioritySort=(a:StockProduct,b:StockProduct)=>{const rank={zero:0,baixo:1,ok:2};return rank[stockLevel(a)]-rank[stockLevel(b)]||a.name.localeCompare(b.name,'pt-BR')};

export default function ShoppingList(){
  const router=useRouter(); const products=useAppStore(s=>s.stockProducts.filter(p=>p.active)); const add=useAppStore(s=>s.addStockSupply); const user=useAppStore(s=>s.user);
  const suggested=useMemo(()=>products.filter(p=>purchaseSuggestion(p)>0).sort(prioritySort),[products]);
  const [showAll,setShowAll]=useState(false); const displayed=showAll?products:suggested;
  const [selected,setSelected]=useState<Record<string,boolean>>(()=>Object.fromEntries(suggested.map(p=>[p.id,true])));
  const [quantities,setQuantities]=useState<Record<string,string>>(()=>Object.fromEntries(suggested.map(p=>[p.id,String(purchaseSuggestion(p))])));
  const [busy,setBusy]=useState(false);
  const chosen=products.filter(p=>selected[p.id]&&Number((quantities[p.id]||'0').replace(',','.'))>0);
  const create=async()=>{setBusy(true);try{const now=new Date().toISOString();const supply:StockSupply={id:`supply-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,occurred_at:now,status:'solicitado',items:chosen.map(p=>({id:`item-${p.id}`,name:p.name,quantity:Number(quantities[p.id].replace(',','.')),unit:p.unit,stock_product_id:p.id})),products_amount:0,total_amount:0,purchaser_name:user?.displayName||undefined,observation:'Gerada pela lista de compras do estoque',created_at:now,updated_at:now};await add(supply);toast.success('Lista transformada em compra.');router.replace(`/abastecimentos/detalhes?id=${supply.id}`)}catch{toast.error('Não foi possível criar a compra.');setBusy(false)}};
  return <div className="pb-10"><PageHeader title="Lista de compras" subtitle="Reposição calculada pelo estoque" to="/estoque"/>
    <section className="mb-4 rounded-[24px] border border-amber-500/20 bg-amber-500/[.06] p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-400"><AlertTriangle size={19}/></span><div><p className="font-heading text-sm font-black text-zinc-200">{suggested.length} {suggested.length===1?'reposição sugerida':'reposições sugeridas'}</p><p className="mt-1 text-[10px] text-zinc-500">Zerados e baixos aparecem primeiro. Ajuste a quantidade se precisar.</p></div></div></section>
    <div className="mb-4 grid grid-cols-2 gap-2"><button onClick={()=>setShowAll(false)} className={`h-11 rounded-xl border text-xs font-black ${!showAll?'border-amber-500/40 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>Precisa comprar ({suggested.length})</button><button onClick={()=>setShowAll(true)} className={`h-11 rounded-xl border text-xs font-black ${showAll?'border-amber-500/40 bg-amber-500/10 text-amber-400':'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>Adicionar outro</button></div>
    <div className="space-y-2">{displayed.map(p=>{const recommendation=purchaseSuggestion(p);return <article key={p.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${selected[p.id]?'border-amber-500/30 bg-amber-500/[.05]':'border-zinc-800 bg-zinc-900/40'}`}><button onClick={()=>{setSelected(v=>({...v,[p.id]:!v[p.id]}));if(quantities[p.id]===undefined)setQuantities(v=>({...v,[p.id]:String(recommendation||1)}))}} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black ${selected[p.id]?'border-amber-500 bg-amber-500 text-zinc-950':'border-zinc-700 text-zinc-600'}`}>{selected[p.id]?<Check size={17}/>:<Plus size={17}/>}</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-zinc-200">{p.name}</p><p className="text-[10px] text-zinc-600">Saldo {p.current_quantity.toLocaleString('pt-BR')} · meta {Math.max(p.minimum_quantity,p.ideal_quantity||0).toLocaleString('pt-BR')}</p>{recommendation>0&&<p className="mt-0.5 text-[9px] font-black text-amber-400">Sugestão: {recommendation.toLocaleString('pt-BR')} {SUPPLY_UNIT_LABELS[p.unit]}</p>}</div><input aria-label={`Quantidade de ${p.name}`} inputMode="decimal" value={quantities[p.id]??String(recommendation||1)} onChange={e=>setQuantities(v=>({...v,[p.id]:e.target.value.replace(/[^0-9.,]/g,'')}))} className="h-11 w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-right font-black text-zinc-100 outline-none focus:border-amber-500"/></article>})}{!displayed.length&&<div className="py-16 text-center"><PackagePlus className="mx-auto text-emerald-500"/><p className="mt-3 text-sm font-bold text-zinc-300">Estoque em dia</p><p className="mt-1 text-xs text-zinc-600">Nenhum produto precisa de reposição.</p></div>}</div>
    <button onClick={create} disabled={busy||!chosen.length} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"><Save size={18}/>{busy?'Criando...':`Criar compra com ${chosen.length} item${chosen.length===1?'':'s'}`}</button>
  </div>;
}
