'use client';

import { Bike, CheckCircle2, ChevronDown, MessageCircleMore, ShieldCheck, Sparkles, Store } from 'lucide-react';

type Props = { mode:'new'|'edit'; origin:string; fulfillmentMode:string; notifyWhatsapp:boolean };

/** Contextual visual guide, never grants consent, changes data, or sends messages. */
export function DeliveryFormPremiumGuide({mode,origin,fulfillmentMode,notifyWhatsapp}:Props) {
  const loja=origin==='loja';
  const authorized=loja&&notifyWhatsapp;
  return <details className="group overflow-hidden rounded-[22px] border border-amber-400/20 bg-gradient-to-br from-amber-500/[.08] via-zinc-900/70 to-zinc-950 shadow-sm">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2.5 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 [&::-webkit-details-marker]:hidden">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-400/10"><Sparkles size={16} className="text-amber-300"/></span>
      <span className="min-w-0 flex-1"><strong className="block text-xs font-black text-zinc-100">{mode==='new'?'Novo pedido · conferência inteligente':'Edição · alteração segura'}</strong>
        <small className="mt-1 block text-[10px] leading-relaxed text-zinc-400">{mode==='new'?'Orientações opcionais e conferência':'Preserve o histórico e revise o que será atualizado.'}</small>
      </span><ChevronDown size={17} className="shrink-0 text-amber-300 transition-transform group-open:rotate-180"/>
    </summary>
    <div className="space-y-2 border-t border-amber-500/10 px-4 pb-4 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400"><Store size={14}/> Origem</span><b className="mt-1 block text-xs text-zinc-100">{origin==='loja'?'Loja':origin==='ifood'?'iFood':origin==='food99'?'99Food':origin==='keeta'?'Keeta':'Outra origem'}</b></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400"><Bike size={14}/> Modalidade</span><b className="mt-1 block text-xs text-zinc-100">{fulfillmentMode==='delivery'?'Entrega DFL':fulfillmentMode==='pickup'?'Retirada':fulfillmentMode==='counter'?'Balcão':'Entrega parceira'}</b></div>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-300"><MessageCircleMore size={17} className="mt-0.5 shrink-0 text-emerald-300"/><span>{!loja?'Avisos desta plataforma são regidos pela integração de origem. Não herdam automaticamente o WhatsApp da loja.':authorized?'WhatsApp solicitado para este pedido. Confirme a autorização e o número no formulário; colocar na fila não comprova recebimento.':'WhatsApp sem autorização confirmada. O pedido pode ser salvo sem mensagem; confira a preferência na seção de contato.'}</span></p>
      <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-500"><ShieldCheck size={15} className="shrink-0 text-sky-300"/>{mode==='edit'?'Alterações operacionais não apagam eventos anteriores nem reenviam mensagens por esta interface.':'O registro comercial é independente do resultado da ponte de mensagens.'}</p>
    </div>
  </details>;
}
