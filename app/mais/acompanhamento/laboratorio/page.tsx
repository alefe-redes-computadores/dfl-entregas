'use client';
/** R251: offline-first synthetic customer tracking lab. No tokens or real user data. */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardCopy, Clock3, FlaskConical, LockKeyhole, Route, ShieldCheck } from 'lucide-react';
import { isSuperadminUid } from '@/lib/access/roles';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/lib/operational-toast';
import { TRACKING_LAB_CASES, laboratoryReport } from '@/lib/tracking/gate2/laboratory';
const fmt=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
export default function TrackingLaboratoryPage(){
  const router=useRouter();
  const uid=useAppStore(s=>s.user?.uid);
  const [chosen,setChosen]=useState('received');
  const selected=useMemo(()=>TRACKING_LAB_CASES.find(c=>c.id===chosen)||TRACKING_LAB_CASES[0],[chosen]);
  const valid=laboratoryReport();
  const p=selected.projection;
  const copy=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({simulation:{scenario:selected.id,description:selected.description},public_projection:p},null,2));toast.success('Exemplo fictício copiado.');}catch{toast.error('Cópia indisponível neste aparelho.');}};
  if(!isSuperadminUid(uid))return <div className="dfl-page p-5"><LockKeyhole size={24} className="text-zinc-500"/><h1 className="mt-2 text-lg font-black text-zinc-200">Acesso restrito</h1><p className="mt-2 text-xs text-zinc-500">Laboratório exclusivo do administrador.</p></div>;
  return <div className="dfl-page space-y-4 pb-28">
    <header className="flex items-start gap-3"><button type="button" onClick={()=>router.push('/mais/acompanhamento')} aria-label="Voltar à Central" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Gate 2 · Certificação sem rede</p><h1 className="font-heading text-xl font-black text-zinc-100">Laboratório de Acompanhamento</h1><p className="mt-1 text-xs leading-relaxed text-zinc-500">{valid.scenario_count} cenários inteiramente fictícios · nenhum link ou mensagem enviado.</p></div></header>
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.045] p-3 text-xs text-emerald-100"><div className="flex items-center gap-2 font-black"><ShieldCheck size={16}/> Simulação isolada</div><p className="mt-1 leading-relaxed text-zinc-400">Não consulta Firestore, não modifica pedidos nem representa uma sessão de cliente. Os dados reais continuam protegidos.</p></div>
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"><div className="flex items-center gap-2 text-sm font-black text-zinc-100"><FlaskConical size={17}/> Selecionar cenário</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{TRACKING_LAB_CASES.map(c=><button type="button" key={c.id} onClick={()=>setChosen(c.id)} aria-pressed={chosen===c.id} className={`min-h-12 rounded-xl border px-2 text-left text-xs font-semibold transition-colors ${chosen===c.id?'border-cyan-500/50 bg-cyan-500/10 text-cyan-100':'border-zinc-800 bg-zinc-950/40 text-zinc-400'}`}>{c.title}</button>)}</div></section>
    <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/55 p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Prévia pública simulada</p><h2 className="mt-1 text-lg font-black text-zinc-100">{p.order.label}</h2></div><span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-black text-zinc-400">FICTÍCIO</span></div>
      <p className="mt-3 text-sm font-black text-zinc-100">{selected.title}</p><p className="mt-1 text-xs leading-relaxed text-zinc-400">{selected.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-zinc-950 p-3"><span className="text-zinc-500">Estado validado</span><p className="mt-1 font-bold text-zinc-100">{p.status}</p></div><div className="rounded-xl bg-zinc-950 p-3"><span className="text-zinc-500">Atualização</span><p className="mt-1 font-bold text-zinc-100">{p.freshness}</p></div></div>
      <div className="mt-3 rounded-xl border border-zinc-800/70 p-3"><div className="flex items-center gap-2 text-xs font-black text-zinc-200"><Route size={15}/> Progresso</div><p className="mt-2 text-xs text-zinc-400">{p.progress?`Posição planejada: ${p.progress.planned_customer_stop_number}/${p.progress.total_physical_stops} · ${p.progress.stops_ahead} parada(s) antes`: 'Indisponível: sem evidência suficiente para publicar posição'}</p>{p.progress&&<p className="mt-1 text-[11px] text-zinc-500">Parada atual comprovada: {p.progress.current_stop_number??'não comprovada'} · Nenhuma localização GPS inventada</p>}</div>
      <div className="mt-3 space-y-2"><p className="text-xs font-black text-zinc-200">Linha do tempo</p>{p.timeline.map(t=><div key={t.id} className="flex items-start justify-between gap-2 border-l-2 border-zinc-700 pl-3 text-xs"><span className="text-zinc-200">{t.title}</span><span className="shrink-0 text-[11px] text-zinc-500">{fmt(t.at)}</span></div>)}</div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-950 p-3 text-xs text-zinc-400">{p.terminal?<CheckCircle2 size={17} className="text-emerald-400"/>:<Clock3 size={17}/>} {p.terminal?'Pedido terminal, sem rastreio ativo':'Sem prometer GPS ou previsão de chegada'}</div>
      <button type="button" onClick={()=>void copy()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-bold text-zinc-200"><ClipboardCopy size={15}/> Copiar JSON fictício para testes do Site</button>
    </section>
    <div className="rounded-xl border border-zinc-800 p-3 text-xs leading-relaxed text-zinc-500">Todos os exemplos usam <strong className="text-zinc-300">dfl.tracking.public.v1</strong>. O navegador do cliente ainda dependerá de token, sessão HttpOnly e consulta servidor-servidor após homologação conjunta.</div>
  </div>;
}
