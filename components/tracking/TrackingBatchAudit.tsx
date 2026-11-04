'use client';
/** Administrative results. Never passes raw data to the public Site. */
import { AlertTriangle, CheckCircle2, ClipboardCopy, LockKeyhole, SearchCheck } from 'lucide-react';
import type { AuditSummary } from '@/lib/tracking/gate3/batch-audit';
const label:Record<string,string>={site:'Site',manual:'Loja',ifood:'iFood',food99:'99Food',unknown:'Não identificado'};
const levelName:Record<string,string>={ready_for_internal_review:'Revisão interna',needs_attention:'Atenção',blocked:'Bloqueado',not_found:'Não encontrado',inspection_failed:'Indisponível'};
export function TrackingBatchAudit({value,onCopy,onInspect}:{
  value:AuditSummary;onCopy:()=>void;onInspect:(id:string)=>void;
}){
  return <section className="space-y-3" aria-label="Resultado da auditoria de acompanhamento">
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/65 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-400">Gate 3 · Leitura confirmada</p><h2 className="mt-1 text-base font-black text-zinc-100">Qualidade do acompanhamento</h2><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Amostra de {value.sample_size} pedido(s). Não representa o histórico total nem libera clientes.</p></div><SearchCheck size={20} className="shrink-0 text-cyan-300"/></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          ['Revisão interna',value.internal_reviewable,'text-emerald-300'],
          ['Precisam atenção',value.needs_attention,'text-amber-300'],
          ['Bloqueados',value.blocked,'text-rose-300'],
          ['Indisponíveis',value.unavailable,'text-zinc-300'],
        ] as const).map(([name,count,color])=><div key={name} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><p className={`text-xl font-black tabular-nums ${color}`}>{count}</p><p className="mt-1 text-[10px] text-zinc-500">{name}</p></div>)}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">{value.valid_public_projections} projeções públicas estruturalmente válidas nesta amostra.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(value.by_origin).filter(([,n])=>n>0).map(([key,n])=><span key={key} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-400">{label[key]||key}: {n}</span>)}</div>
      <button type="button" onClick={onCopy} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-200"><ClipboardCopy size={15}/> Copiar resumo anônimo para o Site</button>
    </div>
    {value.top_signals.length>0&&<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"><h3 className="flex items-center gap-2 text-xs font-black text-zinc-200"><AlertTriangle size={15} className="text-amber-300"/> Principais motivos para revisão</h3><div className="mt-2 space-y-2">{value.top_signals.map(s=><div key={s.code} className="flex items-center justify-between gap-2 text-[11px] text-zinc-400"><span className="break-all font-mono">{s.code}</span><span className="shrink-0 font-bold tabular-nums">{s.count}</span></div>)}</div></div>}
    <div className="space-y-2"><h3 className="flex items-center gap-2 text-xs font-black text-zinc-200"><LockKeyhole size={15}/> Pedidos consultados — somente proprietário</h3>
      {value.rows.map(row=><button key={row.delivery_id} type="button" onClick={()=>onInspect(row.delivery_id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-left active:bg-zinc-800/80"><div className="min-w-0"><p className="truncate text-xs font-bold text-zinc-200">Registro · {row.delivery_id}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{label[row.origin]} · {row.state} · {row.event_count} eventos</p></div><div className="flex shrink-0 items-center gap-2">{row.level==='ready_for_internal_review'?<CheckCircle2 size={14} className="text-emerald-400"/>:<AlertTriangle size={14} className="text-amber-400"/>}<span className="max-w-[85px] text-right text-[10px] font-semibold text-zinc-400">{levelName[row.level]||'Revisar'}</span></div></button>)}
    </div>
    <p className="text-[10px] leading-relaxed text-zinc-600">Resultados obtidos por ação manual. Dados comerciais, clientes e valores não são incluídos no resumo copiado. Nenhuma sessão, link ou mensagem foi emitida.</p>
  </section>;
}
