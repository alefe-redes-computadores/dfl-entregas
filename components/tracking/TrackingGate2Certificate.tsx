'use client';
import { ShieldCheck, AlertTriangle, LockKeyhole, Copy } from 'lucide-react';
import type { Gate2Certificate } from '@/lib/tracking/gate2/certification';
import { toast } from '@/lib/operational-toast';

export function TrackingGate2Certificate({certificate}:{certificate:Gate2Certificate}){
  const copy=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(certificate,null,2));toast.success('Certificação interna copiada.');}catch{toast.error('Não foi possível copiar neste aparelho.');}};
  return <section className="space-y-3 rounded-[24px] border border-cyan-500/25 bg-cyan-500/[.045] p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black text-zinc-100"><ShieldCheck size={18} className="text-cyan-300"/> Conferência técnica A–E</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Avalia os contratos deste pedido. O piloto WhatsApp e a habilitação de links são verificados em controles distintos.</p></div><LockKeyhole size={19} className="shrink-0 text-zinc-500"/></div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{certificate.checks.map(c=><div key={c.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-black text-zinc-200">{c.id}</span><span className="min-w-0 flex-1 text-xs font-bold text-zinc-200">{c.title}</span>{c.status==='ok'?<ShieldCheck size={15} className="text-emerald-400"/>:c.status==='attention'?<AlertTriangle size={15} className="text-amber-400"/>:<LockKeyhole size={15} className="text-zinc-500"/>}</div><p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{c.detail}</p></div>)}</div>
    <div className="rounded-xl bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-400">Evidências: <strong className="text-zinc-200">{certificate.evidence_count}</strong> · Projeção: <strong className="text-zinc-200">{certificate.public_projection_valid?'válida':'pendente'}</strong> · Acesso ao cliente: <strong className="text-zinc-200">verificar flags</strong></div>
    <button type="button" onClick={()=>void copy()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-bold text-zinc-200"><Copy size={15}/> Copiar certificação (sem dados privados)</button>
  </section>;
}
