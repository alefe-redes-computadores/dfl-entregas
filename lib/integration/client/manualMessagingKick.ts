import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
export type ManualKickResult={ok?:boolean;status?:'off'|'skipped'|'queued'|'duplicate'|'failed';reason?:string};
/** Motivos seguros, sem expor número, token, identidade nem configuração sensível. */
export function manualPickupResultDescription(result: ManualKickResult): string {
  const reasons: Record<string,string> = {
    pickup_disabled:'Retirada automática desativada.',
    pickup_kill_switch:'Envio protegido pelo interruptor de segurança.',
    manual_pickup_off:'Avisos de retirada não estão habilitados neste ambiente.',
    manual_messaging_disabled:'Mensageria antiga está desativada; nenhum aviso foi enviado.',
    manual_messaging_kill_switch:'Interruptor geral da mensageria bloqueou o aviso.',
    canary_legacy_scope_mismatch:'Canário não corresponde ao escopo histórico.',
    pilot_not_configured:'Número piloto indisponível para este escopo.',
    not_pilot_phone:'Telefone não autorizado para o canário.',
    not_authorized_phone:'Telefone não pertence à lista de homologação.',
    approved_list_invalid:'Lista de telefones autorizados inválida ou incompleta.',
    rollout_not_approved:'Liberação geral ainda não aprovada.',
    pickup_scope_invalid:'Escopo de retirada não autorizado.',
    internal_or_test:'Pedido interno ou de teste protegido contra mensagens.',
    no_explicit_consent:'Cliente sem consentimento explícito para o aviso.',
    already_ready:'O pedido já está marcado como pronto.',
    stale_event:'Prazo do evento expirou. Não reenviar automaticamente.',
    predates_rollout:'Pedido anterior à ativação. Sem reenvio automático.',
    duplicate:'Este aviso já possui reserva; não repetir a tentativa.',
    stale_or_changed:'Estado do pedido mudou; envio suprimido.',
    network_unknown:'Resposta de envio incerta. Verifique a auditoria, sem reenviar.',
    response_uncertain:'O servidor pode ter recebido o pedido. Não tente novamente sem auditoria.',
    bridge_not_configured:'Ponte segura do Site não disponível.',
    site_not_confirmed:'O Site não confirmou o ingresso na fila.',
    reservation_unconfirmed:'Reserva de envio não confirmada. Verifique a auditoria.',
    state_unconfirmed:'Estado do envio incerto. Verifique a reserva antes de repetir.',
    server_error:'O servidor não confirmou o aviso.',
    invalid_phone:'Telefone inválido para mensagens.',
  };
  if(result.reason && reasons[result.reason]) return reasons[result.reason];
  if(result.status==='queued') return 'Aviso na fila; recebimento no WhatsApp ainda não confirmado.';
  if(result.status==='duplicate') return 'Aviso já reservado. Não solicitar novamente.';
  if(result.status==='off') return 'Aviso desligado; pedido operacional preservado.';
  if(result.status==='skipped') return 'Aviso suprimido pela política de elegibilidade.';
  return 'Envio não confirmado. Consulte a auditoria antes de qualquer nova tentativa.';
}
export async function kickManualCreated(deliveryId:string):Promise<ManualKickResult>{
  const user=auth.currentUser;
  if(!user) return {ok:false,status:'failed',reason:'session_unavailable'};
  const origin=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||'https://dfl-entregas.vercel.app').replace(/\/+$/,'');
  const url=Capacitor.isNativePlatform()?`${origin}/api/integration/manual-messaging`:'/api/integration/manual-messaging';
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const token=await user.getIdToken();
    const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({action:'created',deliveryId}),cache:'no-store',credentials:'omit',keepalive:true,signal:controller.signal});
    const parsed=await response.json().catch(()=>null) as ManualKickResult|null;
    return parsed&&typeof parsed==='object'?{...parsed,ok:response.ok&&parsed.ok===true}:{ok:false,status:'failed',reason:'invalid_response'};
  }catch{return {ok:false,status:'failed',reason:'bridge_unavailable'};}
  finally{clearTimeout(timer);}
}

/** R301: canal dedicado à retirada; não passa pela rota/motoboy ou Site comercial. */
export async function kickManualPickup(deliveryId:string, action:'created'|'ready'):Promise<ManualKickResult>{
  const user=auth.currentUser;
  if(!user) return {ok:false,status:'failed',reason:'session_unavailable'};
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId))return {ok:false,status:'failed',reason:'invalid_delivery_id'};
  const origin=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||'https://dfl-entregas.vercel.app').replace(/\/+$/,'');
  const url=Capacitor.isNativePlatform()?`${origin}/api/integration/manual-pickup`:'/api/integration/manual-pickup';
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const token=await user.getIdToken();
    const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({action,deliveryId}),cache:'no-store',credentials:'omit',keepalive:true,signal:controller.signal});
    const parsed=await response.json().catch(()=>null) as ManualKickResult|null;
    return parsed&&typeof parsed==='object'?{...parsed,ok:response.ok&&parsed.ok===true}:{ok:false,status:'failed',reason:'invalid_response'};
  }catch{return {ok:false,status:'failed',reason:'response_uncertain'};}
  finally{clearTimeout(timer);}
}
