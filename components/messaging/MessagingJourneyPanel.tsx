'use client';

import { ArrowRight, BellRing, CheckCircle2, CircleHelp, Clock3, Link2, LockKeyhole, MessageSquareText, Route, ShieldCheck, Store } from 'lucide-react';

type Props = {
  loaded: boolean;
  bridgeReady: boolean;
  manualReady: boolean;
  pending: number;
  failures: number;
  onTracking: () => void;
  onReturns: () => void;
};

/** Read-only operational explainer. The provider's real delivery status is intentionally unknown. */
export function MessagingJourneyPanel({loaded,bridgeReady,manualReady,pending,failures,onTracking,onReturns}:Props) {
  const steps = [
    {title:'Pedido autorizado',hint:'Consentimento e regras da origem',Icon:ShieldCheck},
    {title:'Evento registrado',hint:'Cadastro, saída, próxima parada ou conclusão',Icon:Route},
    {title:'Ponte de envio',hint:'Fila e deduplicação verificadas no servidor',Icon:BellRing},
    {title:'Recebimento',hint:'Somente o provedor confirma a entrega',Icon:MessageSquareText},
  ];
  return <section aria-label="Jornada das notificações" className="relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-gradient-to-br from-[#202018] via-[#14191d] to-zinc-950 p-4 shadow-[0_12px_36px_rgba(0,0,0,.2)]">
    <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/[.08] blur-3xl" aria-hidden="true"/>
    <div className="relative flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.17em] text-amber-300">Visão 360</p><h2 className="mt-1 font-heading text-base font-black text-zinc-100">Caminho da mensagem</h2>
        <p className="mt-1 max-w-md text-[11px] leading-relaxed text-zinc-400">Acompanhe cada camada sem confundir evento aceito com mensagem recebida.</p></div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10"><MessageSquareText size={21} className="text-amber-300"/></span>
    </div>
    <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((step,index)=>{const Icon=step.Icon;return <div key={step.title} className="relative min-w-0 rounded-2xl border border-white/[.07] bg-zinc-950/65 p-3">
        <span className="mb-3 flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[.05]"><Icon size={16} className={index===3?'text-sky-300':'text-amber-300'}/></span><span className="text-[10px] font-black tabular-nums text-zinc-600">0{index+1}</span></span>
        <strong className="block text-[11px] leading-snug text-zinc-100">{step.title}</strong><span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">{step.hint}</span>
      </div>})}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-[10px] font-semibold text-zinc-300">{loaded&&bridgeReady?<CheckCircle2 size={13} className="text-emerald-300"/>:<CircleHelp size={13} className="text-amber-300"/>} {loaded?(bridgeReady?'Ponte configurada':'Ponte exige revisão'):'Ainda não consultado'}</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-[10px] font-semibold text-zinc-300">{manualReady?<ShieldCheck size={13} className="text-emerald-300"/>:<LockKeyhole size={13} className="text-zinc-400"/>} {manualReady?'Avisos manuais habilitados':'Avisos manuais sem confirmação'}</span>
      {loaded&&pending>0&&<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-200"><Clock3 size={13}/>{pending} na ponte</span>}
      {loaded&&failures>0&&<span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] font-semibold text-rose-200">{failures} falha(s) da ponte</span>}
    </div>
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" onClick={onTracking} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-500/[.07] px-3 text-left text-xs font-bold text-sky-100 active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"><span className="flex items-center gap-2"><Link2 size={17}/> Central de acompanhamento</span><ArrowRight size={16}/></button>
      <button type="button" onClick={onReturns} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[.06] px-3 text-left text-xs font-bold text-amber-100 active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><span className="flex items-center gap-2"><Store size={17}/> Retornos e reentregas</span><ArrowRight size={16}/></button>
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Nenhum botão desta jornada envia WhatsApp, solicita links privados ou altera pedidos. Marketplace e Site usam autoridades próprias.</p>
  </section>;
}
