'use client';
/** R299 P4 — Recortes clicáveis, sem consultas, sem inferir dinheiro recebido. */
import { useState } from 'react';
import { ChevronDown, PackageCheck, Layers3 } from 'lucide-react';
import type { ReportBucket } from '@/lib/reports/types';

type Props = {
  statuses: ReportBucket[];
  origins: ReportBucket[];
  onStatus: (label: string) => void;
  onOrigin: (label: string) => void;
};
const tint: Record<string, string> = {
  Concluído: 'border-emerald-500/20 bg-emerald-500/[.07] text-emerald-300',
  Pendente: 'border-amber-500/20 bg-amber-500/[.07] text-amber-300',
  Cancelado: 'border-red-500/20 bg-red-500/[.07] text-red-300',
  iFood: 'border-red-500/20 bg-red-500/[.07] text-red-300',
  '99Food': 'border-amber-500/20 bg-amber-500/[.07] text-amber-300',
  Keeta: 'border-violet-500/20 bg-violet-500/[.07] text-violet-300',
  Site: 'border-sky-500/20 bg-sky-500/[.07] text-sky-300',
  Loja: 'border-emerald-500/20 bg-emerald-500/[.07] text-emerald-300',
};

export function ReportOrderPulse({statuses, origins, onStatus, onOrigin}: Props) {
  const [showOrigins, setShowOrigins] = useState(false);
  const order = ['Pendente','Concluído','Cancelado'];
  const byStatus = new Map(statuses.map((item): [string, ReportBucket] => [item.key, item]));
  const total = statuses.reduce((sum, b) => sum + b.count, 0);
  return <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-3.5" aria-label="Resumo navegável dos pedidos">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-sm font-black text-zinc-100"><PackageCheck size={16} className="text-amber-300"/>Situação dos pedidos</h2>
        <p className="mt-0.5 text-[10px] text-zinc-500">{total} pedido{total===1?'':'s'} reais no período · toque para ver quais são</p></div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {order.map(key => {
        const value = byStatus.get(key)?.count || 0;
        return <button key={key} type="button" disabled={!value} onClick={()=>onStatus(key)} aria-label={`Ver ${value} pedidos ${key.toLowerCase()}`} className={`min-w-0 rounded-xl border px-2 py-3 text-center disabled:opacity-35 ${tint[key]}`}>
          <b className="block text-lg font-black tabular-nums">{value}</b><span className="mt-1 block truncate text-[10px] font-bold">{key}</span>
        </button>;
      })}
    </div>
    <button type="button" aria-expanded={showOrigins} onClick={()=>setShowOrigins(value=>!value)} className="mt-3 flex min-h-10 w-full items-center justify-between border-t border-zinc-800/70 pt-2 text-left text-xs font-bold text-zinc-300">
      <span className="flex items-center gap-2"><Layers3 size={15} className="text-sky-400"/>Filtrar por plataforma / Site / Loja</span><ChevronDown size={15} className={showOrigins?'rotate-180':''}/>
    </button>
    {showOrigins && <div className="grid grid-cols-2 gap-1.5 pt-2 sm:grid-cols-3">
      {origins.map(item => <button key={item.key} type="button" onClick={()=>onOrigin(item.key)} className={`min-h-11 rounded-xl border px-3 text-left text-[11px] font-black ${tint[item.key] || 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
        <span className="block truncate">{item.label}</span><span className="block text-[10px] font-medium opacity-75">{item.count} pedido{item.count===1?'':'s'}</span>
      </button>)}
    </div>}
  </section>;
}
