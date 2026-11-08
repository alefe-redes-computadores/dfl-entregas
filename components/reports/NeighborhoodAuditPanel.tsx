'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronRight, MapPin, Search } from 'lucide-react';
import type { Customer } from '@/types';
import { auditNeighborhoods, resolveNeighborhood } from '@/lib/operation/neighborhood-intelligence';

/** Auditoria nao destrutiva. Somente sugere e abre ficha humana. */
export function NeighborhoodAuditPanel({customers}:{customers:readonly Customer[]}){
  const router=useRouter();
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [limit,setLimit]=useState(8);
  const groups=useMemo(()=>auditNeighborhoods(customers),[customers]);
  const filtered=useMemo(()=>groups.filter(group=>(group.label+' '+group.variants.join(' '))
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())),[groups,search]);
  const aliasGroups=groups.filter(group=>group.kind==='aliases');
  const needsReview=groups.filter(group=>group.kind==='review');
  return <section className="min-w-0 space-y-3 overflow-hidden rounded-[24px] border border-sky-500/20 bg-sky-500/[.035] p-3.5 sm:p-5" aria-label="Auditoria de bairros">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><MapPin size={19}/></span>
      <div className="min-w-0"><h2 className="break-words text-sm font-black text-zinc-100">Bairros · aliases e conferência</h2><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Agrupamento conservador para gráficos. Os nomes originais nos cadastros continuam intactos. Etapas como Ipanema 2 e Quebec 2 não são mescladas automaticamente.</p></div></div>
    <div className="grid grid-cols-2 gap-2"><div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"><b className="block text-lg font-black text-sky-200">{aliasGroups.length}</b><span className="text-[10px] text-zinc-400">Grupos de aliases</span></div><div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"><b className="block text-lg font-black text-amber-200">{needsReview.length}</b><span className="text-[10px] text-zinc-400">Sugestões para revisão</span></div></div>
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-zinc-400"><Search size={15}/><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(8);}} placeholder="Buscar Quebec, Fátima, Esperança..." className="w-full min-w-0 bg-transparent text-xs text-zinc-100 outline-none"/></label>
    <div className="space-y-2">{filtered.slice(0,limit).map(group=><article key={group.label} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <button type="button" aria-expanded={expanded===group.label} onClick={()=>setExpanded(cur=>cur===group.label?null:group.label)} className="flex min-h-11 w-full items-center gap-2 text-left"><span className="min-w-0 flex-1"><strong className="block break-words text-xs text-zinc-100">{group.label}</strong><small className="mt-1 block text-[10px] text-zinc-400">{group.customers} cadastro(s) · {group.variants.length} escrita(s)</small></span>{group.kind==='review'?<AlertCircle size={17} className="shrink-0 text-amber-300"/>:<CheckCircle2 size={17} className="shrink-0 text-emerald-300"/>}<ChevronRight size={15} className={`shrink-0 text-zinc-500 transition ${expanded===group.label?'rotate-90':''}`}/></button>
      {expanded===group.label&&<div className="space-y-2 border-t border-zinc-800 pt-3 text-xs"><div className="flex flex-wrap gap-1.5">{group.variants.map(name=><span key={name} className="max-w-full break-words rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300">{name}</span>)}</div><p className="text-[11px] leading-relaxed text-zinc-400">{group.kind==='aliases'?'Equivalência de análise revisável. Nenhum cadastro foi modificado.':'Sugestão ortográfica apenas. Precisa de CEP, logradouro ou confirmação humana antes de unificar.'}</p><div className="space-y-1">{customers.filter(c=>group.customerIds.includes(c.id)).slice(0,12).map(c=><button type="button" key={c.id} onClick={()=>router.push(`/clientes/details?id=${encodeURIComponent(c.id)}`)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-zinc-900 px-2.5 text-left text-[11px] text-sky-200"><span className="min-w-0 flex-1 truncate">{c.name} · {resolveNeighborhood(c.neighborhood).input}</span><ChevronRight size={13}/></button>)}</div>{group.customerIds.length>12&&<p className="text-[10px] text-zinc-500">Mais cadastros disponíveis na lista de clientes.</p>}</div>}
    </article>)}{filtered.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+8)} className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs font-bold text-zinc-200">Mostrar mais · {limit} de {filtered.length}</button>}{!filtered.length&&<p className="rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">Sem grupos correspondentes. Bairros desconhecidos permanecem com seus nomes originais.</p>}</div>
    <p className="text-[10px] leading-relaxed text-zinc-500">Catálogo inicial de aliases não é uma lista oficial completa. Nenhuma correção de rua, CEP ou bairro é aplicada automaticamente.</p>
  </section>;
}
