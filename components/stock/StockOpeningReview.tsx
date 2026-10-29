'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardCheck, PackageSearch } from 'lucide-react';
import type { StockProduct, StockSupply } from '@/types';
import { stockOpeningReview } from '@/lib/stock-opening-review';

export function StockOpeningReview({ products, supplies }: { products: StockProduct[]; supplies: StockSupply[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const review = useMemo(() => stockOpeningReview(products, supplies), [products, supplies]);
  return <section aria-label="Conferência pré-abertura" className="rounded-[20px] border border-amber-500/20 bg-amber-500/[.045] p-3">
    <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
      <span className="flex min-w-0 items-center gap-2"><ClipboardCheck size={18} className="shrink-0 text-amber-300"/><span className="min-w-0"><span className="block text-xs font-black text-zinc-100">Conferência pré-abertura</span><span className="block text-[10px] text-zinc-400">Saldo físico, embalagem e compras sem alterar registros</span></span></span>
      <ChevronDown size={16} className={`shrink-0 text-amber-300 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
    </button>
    <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
      {([[review.zeros,'Zerados'],[review.belowMinimum,'No mínimo'],[review.unitReviews,'Revisar un.'],[review.openPurchases,'Compras']] as const).map(([number,label])=><div key={label} className="rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-1 py-2"><div className="text-base font-black tabular-nums text-zinc-100">{number}</div><div className="text-[9px] text-zinc-500">{label}</div></div>)}
    </div>
    {expanded && <div className="mt-3 space-y-1.5 border-t border-zinc-800/70 pt-3">
      {review.issueTotal === 0 ? <p className="text-xs text-emerald-300">Nenhum alerta identificado nos produtos ativos.</p> : review.issues.map((item,i)=><button key={`${item.id}:${item.reason}:${i}`} type="button" onClick={()=>router.push(`/estoque/editar?id=${encodeURIComponent(item.id)}&from=estoque`)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-left"><AlertTriangle size={14} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-200">{item.name}</span><span className="block text-[10px] text-zinc-500">{item.detail}</span></span><ChevronRight size={14} className="shrink-0 text-zinc-500"/></button>)}
      {review.issueTotal > review.issues.length && <p className="text-[10px] text-zinc-500">Mais {review.issueTotal - review.issues.length} alertas. Consulte os filtros do estoque.</p>}
      <p className="flex items-center gap-1 text-[10px] text-zinc-500"><PackageSearch size={13}/> Compras abertas não aumentam o saldo até o recebimento/conferência.</p>
    </div>}
  </section>;
}
