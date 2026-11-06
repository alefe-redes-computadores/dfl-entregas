'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, ShieldCheck, Smartphone, X } from 'lucide-react';
import type { Delivery } from '@/types';
import { maskedMessagePhone, shortTechnicalReference, siteOrderDisplayReference } from '@/lib/operation/site-order-presentation';

type Props = { deliveries: readonly Delivery[]; selectedId: string; onSelect: (id: string) => void };

/** Local selector only. Selecting never sends a message nor calls a server endpoint. */
export function MessagingOrderPicker({ deliveries, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const recent = useMemo(() => [...deliveries]
    .sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || '')))
    .slice(0, 120), [deliveries]);
  const norm = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = useMemo(() => recent.filter(item => !norm || [item.customer_name, item.order_id, item.external_order_id, item.id, item.phone]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(norm)).slice(0, 15), [recent, norm]);
  const current = recent.find(item => item.id === selectedId);
  return <section aria-label="Escolher pedido para diagnóstico" className="rounded-2xl border border-sky-500/15 bg-sky-500/[.035] p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="text-xs font-black text-zinc-100">Selecionar pedido sincronizado</p>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Escolha pelo cliente ou número. Somente consulta técnica; nenhuma mensagem é enviada.</p></div>
      <ShieldCheck size={17} className="shrink-0 text-sky-300" />
    </div>
    <button type="button" aria-expanded={open} aria-controls="dfl-m289-picker" onClick={() => setOpen(v => !v)}
      className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 text-left text-xs font-bold text-zinc-200">
      <span className="min-w-0 truncate">{current ? `${siteOrderDisplayReference(current)} · ${current.customer_name || 'Cliente'} · ${maskedMessagePhone(current.phone)}` : 'Escolher um pedido recente'}</span>
      <ChevronDown size={16} className={`shrink-0 text-sky-300 transition-transform ${open?'rotate-180':''}`} />
    </button>
    {current && <p className="mt-2 text-[10px] text-zinc-400"><Smartphone size={12} className="mr-1 inline" />Telefone protegido: {maskedMessagePhone(current.phone)} · origem {current.source_system === 'dfl_site' ? 'Site' : current.origin || 'não identificada'} · {shortTechnicalReference(current.id)}</p>}
    {open && <div id="dfl-m289-picker" className="mt-2 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3"><Search size={15} className="text-zinc-500"/><input type="search" autoComplete="off" value={search} onChange={e=>setSearch(e.target.value.slice(0,100))} placeholder="Buscar cliente, pedido ou telefone" aria-label="Buscar pedidos locais" className="min-h-11 min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none"/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Limpar busca"><X size={15}/></button>}</div>
      <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain" role="listbox" aria-label="Pedidos recentes">
        {matches.map(item => <button type="button" role="option" aria-selected={selectedId===item.id} key={item.id} onClick={()=>{onSelect(item.id);setOpen(false);setSearch('');}}
          className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${selectedId===item.id?'border-sky-500/40 bg-sky-500/10':'border-zinc-800 bg-zinc-900/40'}`}>
          <span className="min-w-0"><strong className="block truncate text-xs text-zinc-100">{item.customer_name || 'Cliente'} · {siteOrderDisplayReference(item)}</strong><span className="mt-1 block text-[10px] text-zinc-400">{maskedMessagePhone(item.phone)} · {shortTechnicalReference(item.id)}</span></span>
          {selectedId===item.id&&<Check size={15} className="shrink-0 text-sky-300"/>}
        </button>)}
        {!matches.length && <p className="p-3 text-xs text-zinc-500">Nenhum pedido encontrado nos registros recentes deste aparelho.</p>}
      </div>
      <p className="px-1 text-[10px] text-zinc-500">Busca local nos 120 pedidos recentes. A confirmação de elegibilidade continua sendo feita pelo servidor.</p>
    </div>}
  </section>;
}
