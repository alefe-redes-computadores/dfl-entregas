'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, CheckCircle2, CircleAlert, LockKeyhole, RefreshCcw, Send, ShieldCheck, ShieldOff } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';

type Status = {ok:boolean;pilotEnabled:boolean;phoneConfigured:boolean;bridgeConfigured:boolean;
  alreadyUsedToday:boolean;previousOutcome:string|null;note?:string};
type ActionResult={ok:boolean;code:string;mode?:string;stage?:string;queued?:boolean;duplicate?:boolean;
  whatsappSent?:boolean;deliveryUnknown?:boolean;dailyLimitReached?:boolean;workerWake?:string;note?:string};
const descriptions:Record<string,string>={
  BRIDGE_HMAC_VERIFIED:'Site recebeu a assinatura do Entregas e confirmou a autenticidade. Nenhuma mensagem foi criada.',
  TEST_ENQUEUED:'Teste fictício registrado na fila do Supabase. Ainda NÃO significa WhatsApp entregue.',
  ALREADY_ENQUEUED:'A mesma mensagem de teste já estava na fila. Não houve duplicação.',
  PILOT_OFF:'Modo-piloto OFF no Entregas. Configure o teste somente após autorizar o número.',
  PILOT_NOT_CONFIGURED:'Modo-piloto ou fila não configurados no Site.',
  PILOT_ALLOWLIST_MISMATCH:'Os números autorizados no Site e no Entregas não coincidem. Não foi enviada mensagem.',
  SITE_BRIDGE_NOT_CONFIGURED:'Destino Site ou assinatura HMAC ausente/inválida.',
  SITE_BRIDGE_UNAVAILABLE:'A ponte não respondeu. Confira a conexão e os deploys; não repita o envio incerto.',
  INGEST_REJECTED:'O Supabase recusou a fila. Confira o serviço antes de repetir.',
  INGEST_UNAVAILABLE:'Supabase indisponível ou timeout. Resultado incerto: não repetir.',
  DAILY_LIMIT_REACHED:'O teste de hoje já foi reservado. Amanhã haverá nova janela de homologação.',
  AUTH_REQUIRED:'Sessão de proprietário não autorizada.',
};

export default function HomologacaoMensageria(){
  const router=useRouter();const isOwner=isSuperadminUid(useAppStore(s=>s.user?.uid));
  const [status,setStatus]=useState<Status|null>(null);
  const [result,setResult]=useState<ActionResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [confirm,setConfirm]=useState(false);
  const [bridgeVerified,setBridgeVerified]=useState(false);
  const endpoint=()=>{
    const origin=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||'https://dfl-entregas.vercel.app').replace(/\/+$/,'');
    return (Capacitor.isNativePlatform()?origin:'')+'/api/integration/messaging-commission';
  };
  const request=async (payload?:{action:'probe'|'pilot_send';confirmation?:string}):Promise<unknown>=>{
    const user=auth.currentUser;if(!user)throw new Error('Sessão indisponível. Entre novamente.');
    const token=await user.getIdToken();
    const abort=new AbortController();const timer=window.setTimeout(()=>abort.abort(),24000);
    try{
      const response=await fetch(endpoint(),{method:payload?'POST':'GET',cache:'no-store',credentials:'omit',signal:abort.signal,
        headers:{Authorization:`Bearer ${token}`,...(payload?{'content-type':'application/json'}:{})},
        ...(payload?{body:JSON.stringify(payload)}:{})});
      const data=await response.json().catch(()=>null) as (ActionResult&Status)|null;
      if(!data||typeof data!=='object')throw new Error(`Resposta inválida (HTTP ${response.status}).`);
      if(!response.ok||!data.ok)throw new Error(descriptions[data.code]||`A consulta foi recusada (${data.code||response.status}).`);
      return data;
    }finally{window.clearTimeout(timer);}
  };
  const execute=async (type:'status'|'probe'|'send')=>{
    if(loading||!isOwner)return;
    setLoading(true);setError('');setResult(null);
    try{
      if(type==='status'){
        const data=await request() as Status;setStatus(data);setBridgeVerified(false);setConfirm(false);
      }else if(type==='probe'){
        const data=await request({action:'probe'}) as ActionResult;
        setResult(data);setBridgeVerified(data.ok);setConfirm(false);
      }else{
        setConfirm(false);
        const data=await request({action:'pilot_send',confirmation:'ENVIAR TESTE FICTICIO'}) as ActionResult;
        setResult(data);setStatus(prev=>prev?{...prev,alreadyUsedToday:true,previousOutcome:data.code}:prev);
      }
    }catch(cause){
      setError(cause instanceof Error&&cause.name==='AbortError'
        ? 'Tempo esgotado. Se tentou enviar, NÃO repita antes de consultar a fila.'
        : cause instanceof Error?cause.message:'Falha desconhecida.');
      if(type==='send')setStatus(prev=>prev?{...prev,alreadyUsedToday:true}:prev);
    }finally{setLoading(false);}
  };
  const canSend=Boolean(status?.pilotEnabled&&status?.phoneConfigured&&status?.bridgeConfigured&&
    !status.alreadyUsedToday&&bridgeVerified&&!loading);
  return <div className="dfl-page mx-auto max-w-2xl space-y-4 pb-24">
    <header className="space-y-2">
      <button type="button" onClick={()=>router.push('/mais/mensageria')} className="flex min-h-11 items-center gap-2 text-sm text-zinc-300"><ArrowLeft size={17}/> Voltar à mensageria</button>
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-amber-400"><ShieldCheck size={17}/> MSG-M6 · Homologação</p>
      <h1 className="font-heading text-2xl font-black text-white">Teste protegido do bot</h1>
      <p className="text-xs leading-relaxed text-zinc-400">Primeiro testamos a ponte assinada sem enviar nada. Depois, com duas configurações independentes, podemos colocar um pedido fictício na fila do WhatsApp, exclusivamente para o número de teste autorizado.</p>
    </header>
    {!isOwner?<div role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"><LockKeyhole size={18} className="inline"/> Disponível apenas ao proprietário.</div>:<>
      <section className="space-y-3 rounded-[24px] border border-zinc-800 bg-zinc-900/55 p-4 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><RefreshCcw size={17} className="text-amber-400"/> 1. Verificar condições</div>
        <button type="button" disabled={loading} onClick={()=>void execute('status')} className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 text-xs font-black text-white disabled:opacity-50">{loading?'Verificando…':'Consultar travas de homologação'}</button>
        {status&&<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([['Ponte configurada',status.bridgeConfigured],['Número de teste autorizado',status.phoneConfigured],['Modo-piloto ativo no Entregas',status.pilotEnabled],['Limite diário disponível',!status.alreadyUsedToday]] as const).map(([label,yes])=><div key={label} className="flex items-center gap-2 rounded-xl bg-zinc-950/75 p-3 text-xs text-zinc-300">{yes?<CheckCircle2 size={16} className="shrink-0 text-emerald-400"/>:<ShieldOff size={16} className="shrink-0 text-amber-400"/>}{label}</div>)}
        </div>}
      </section>
      <section className="space-y-3 rounded-[24px] border border-zinc-800 bg-zinc-900/55 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck size={17} className="text-emerald-400"/> 2. Conferir assinatura Entregas → Site</div>
        <p className="text-xs text-zinc-400">O servidor envia um desafio HMAC para o Site. Sem Firestore, Supabase, WhatsApp ou atualização de pedidos.</p>
        <button type="button" disabled={loading} onClick={()=>void execute('probe')} className="min-h-12 w-full rounded-xl bg-amber-400 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">Testar ponte sem enviar mensagens</button>
      </section>
      <section className="space-y-3 rounded-[24px] border border-amber-400/20 bg-amber-400/[.035] p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><Send size={17} className="text-amber-300"/> 3. Teste real restrito</div>
        <p className="text-xs text-zinc-300">Envia um <strong>pedido fictício</strong> para a fila do Supabase, usando exclusivamente o telefone de teste configurado nos servidores. Não é um pedido comercial. Um único envio por dia; não há reenvio em caso de dúvida.</p>
        <button type="button" disabled={!canSend} onClick={()=>setConfirm(true)} className="min-h-12 w-full rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-45">Solicitar envio de teste</button>
        {!canSend&&<p className="text-[11px] text-zinc-500">Bloqueado até as travas estarem ativas, a ponte validada e o limite diário livre.</p>}
        {confirm&&<div className="space-y-3 rounded-xl border border-amber-400/30 bg-zinc-950 p-4" role="group" aria-label="Confirmar teste de homologação">
          <p className="text-xs text-zinc-200">Confirma que o número de teste está sob seu controle e pode receber um aviso fictício? Isto NÃO ativa mensagens automáticas de clientes.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={loading} onClick={()=>setConfirm(false)} className="min-h-11 flex-1 rounded-lg border border-zinc-700 px-3 text-xs font-semibold">Cancelar</button>
            <button type="button" disabled={loading} onClick={()=>void execute('send')} className="min-h-11 flex-1 rounded-lg bg-amber-400 px-3 text-xs font-black text-zinc-950">Confirmo: enviar teste fictício</button>
          </div>
        </div>}
      </section>
      {result&&<section role="status" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[.06] p-4"><p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 size={18}/>{result.code}</p><p className="mt-2 text-xs text-zinc-300">{descriptions[result.code]||result.note||'Solicitação concluída.'}</p>{result.workerWake&&result.workerWake!=='not_applicable'&&<p className="mt-2 text-[11px] text-amber-200">{result.workerWake==='acknowledged'?'Fast lane acionada. Verifique o recebimento.':result.workerWake==='not_configured'?'Worker sem configuracao no Site. Fila preservada; revisar servidor.':'Worker ainda nao confirmou processamento. Nao repita o teste; consulte a fila.'}</p>}</section>}
      {error&&<p role="alert" className="flex gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-xs text-red-200"><CircleAlert size={17} className="shrink-0"/>{error}</p>}
      <p className="text-[11px] text-zinc-500">A aprovação do Supabase não prova recebimento do WhatsApp. O número de teste e os segredos nunca são mostrados nesta tela. Sem ações em massa, timers ou listeners.</p>
    </>}
  </div>;
}
