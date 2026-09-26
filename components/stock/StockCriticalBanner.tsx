'use client';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { stockLevel } from '@/lib/stock';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { naturalStockNameCompare } from '@/lib/stock-commercial-display-v2';
import type { StockProduct } from '@/types';

export function StockCriticalBanner({products}:{products:StockProduct[]}){
 const router=useRouter();
 const zero=products.filter(p=>p.active&&stockLevel(p)==='zero'&&Math.max(Number(p.minimum_quantity)||0,Number(p.ideal_quantity)||0)>0).sort((a,b)=>naturalStockNameCompare(a.name,b.name));
 if(!zero.length)return null;
 const visible=zero.slice(0,3);
 return <section className="rounded-[22px] border border-red-500/25 bg-red-500/[.06] p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400"><AlertTriangle size={18}/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-red-400">Reposição urgente</p><p className="mt-1 text-sm font-black text-zinc-100">{zero.length} {zero.length===1?'produto precisa':'produtos precisam'} de reposição</p><div className="mt-3 space-y-1.5">{visible.map(p=><button type="button" key={p.id} onClick={()=>router.push(`/estoque/detalhes?id=${p.id}&from=estoque`)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-zinc-950/45 px-3 py-2 text-left active:bg-zinc-900"><span className="truncate text-[11px] font-bold text-zinc-300">{p.name}</span><span className="flex shrink-0 items-center gap-1 text-[10px] font-black text-red-300">{formatStockQuantity(p.current_quantity,p.unit)}<ChevronRight size={12}/></span></button>)}</div>{zero.length>visible.length&&<p className="mt-2 text-[9px] font-bold text-zinc-500">+ {zero.length-visible.length} com reposição configurada</p>}</div></div></section>;
}
