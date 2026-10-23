'use client';

import { useState } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';

type ChannelRow = { origin: string; count: number; total: number };
interface OriginChartProps { data: ChannelRow[] }
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:2 }).format(value);
const channels = {
  ifood: { name:'iFood', color:'bg-red-500', text:'text-red-300' },
  food99: { name:'99Food', color:'bg-amber-400', text:'text-amber-300' },
  loja: { name:'Loja', color:'bg-emerald-500', text:'text-emerald-300' },
} as const;

/** Compact commercial channel breakdown — no extra chart resize listeners. */
export function OriginChart({ data }: OriginChartProps) {
  const [showValues, setShowValues] = useState(false);
  if (!data.length) return null;
  const totalOrders = data.reduce((sum,item)=>sum+Math.max(0,item.count||0),0);
  const leading = [...data].sort((a,b)=>b.count-a.count)[0];
  const leadingPercent = totalOrders ? Math.round(Math.max(0,leading.count) / totalOrders * 100) : 0;
  return <section className="min-w-0 rounded-[22px] border border-zinc-800/80 bg-zinc-900/45 p-3.5 sm:p-4" aria-label="Participação dos canais de vendas">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-sm font-black text-zinc-100">Participação por canal</p><p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">Pedidos comerciais, independentemente de quem entregou</p></div>
      <button type="button" aria-expanded={showValues} onClick={()=>setShowValues(value=>!value)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 text-[10px] font-bold text-zinc-300">{showValues?'Ocultar R$':'Ver R$'}<ChevronDown size={13} className={showValues?'rotate-180':''}/></button>
    </div>
    <div className="mt-3 space-y-3">{data.map(row=>{
      const style=channels[row.origin as keyof typeof channels] || {name:'Canal',color:'bg-zinc-500',text:'text-zinc-300'};
      const pct=totalOrders?Math.round(Math.max(0,row.count)/totalOrders*100):0;
      return <div key={row.origin} className="min-w-0" aria-label={`${style.name}: ${row.count} pedidos, ${pct}%`}>
        <div className="flex min-w-0 items-center gap-2 text-[11px]"><span className={`w-[56px] shrink-0 font-black ${style.text}`}>{style.name}</span><span className="min-w-0 flex-1 truncate text-zinc-500">{row.count} pedido{row.count===1?'':'s'}</span><span className="shrink-0 font-black tabular-nums text-zinc-200">{pct}%</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Participação ${style.name}`}><div className={`h-full rounded-full ${style.color}`} style={{width:`${Math.min(100,Math.max(0,pct))}%`}}/></div>
        {showValues && <p className="mt-1 break-words text-right text-[11px] font-bold tabular-nums text-emerald-300">{currency(Math.max(0,row.total))}</p>}
      </div>;
    })}</div>
    {leadingPercent>0&&<p className="mt-3 flex items-start gap-2 border-t border-zinc-800/70 pt-3 text-[11px] leading-relaxed text-zinc-400"><TrendingUp size={14} className="mt-0.5 shrink-0 text-sky-400"/>Maior canal: <strong className="text-zinc-200">{channels[leading.origin as keyof typeof channels]?.name||'Canal'}</strong> · {leadingPercent}% dos pedidos</p>}
  </section>;
}
