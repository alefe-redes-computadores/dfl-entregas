'use client';
/** Cliente OWNER: a mutação de entrega usa SOMENTE updateDelivery do aplicativo. */
import {Capacitor} from '@capacitor/core';
import {doc, getDocFromServer} from 'firebase/firestore';
import {auth,db} from '@/lib/firebase';
import {useAppStore} from '@/store/useAppStore';
import {isSuperadminUid} from '@/lib/access/roles';
import type {OperationRequestRow} from '@/lib/access/staffOperationsClient';

function url(){
  if(!Capacitor.isNativePlatform())return '/api/access/canonical';
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN||'https://dfl-entregas.vercel.app').trim().replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base))throw new Error('Servidor administrativo inválido.');
  return base+'/api/access/canonical';
}
async function post(body:Record<string,unknown>):Promise<Record<string,unknown>>{
  const user=auth.currentUser;
  if(!isSuperadminUid(user?.uid))throw new Error('Ação permitida somente ao proprietário.');
  const token=await user!.getIdToken(true);
  const abort=new AbortController();
  const timer=window.setTimeout(()=>abort.abort(),25000);
  try{
    const response=await fetch(url(),{method:'POST',cache:'no-store',credentials:'omit',signal:abort.signal,
      headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
    if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error(`Resposta inesperada da API (HTTP ${response.status}).`);
    const result=await response.json() as Record<string,unknown>;
    if(!response.ok||result.ok!==true)throw new Error(typeof result.error==='string'?result.error:`Falha HTTP ${response.status}`);
    return result;
  }finally{window.clearTimeout(timer);}
}
/**
 * Duas fases: reservar solicitação -> usar a autoridade atual (cliente OWNER)
 * -> confirmar no servidor que a gravação ocorreu. Se confirmação falhar, não
 * inventar sucesso: a fila permanece pendente para conferência posterior.
 */
export async function applyCanonicalDelivery(row:OperationRequestRow):Promise<void>{
  if(row.kind!=='delivery_confirmation')throw new Error('Solicitação não é de entrega.');
  const claim=await post({action:'claim_delivery',id:row.id});
  const routeId=claim.routeId, token=claim.token;
  if(typeof routeId!=='string'||typeof token!=='string'||claim.targetId!==row.targetId)throw new Error('Resposta de reserva inconsistente.');
  try{
    // Nunca aplicar baixa com estado remoto obsoleto (nem operar em cache offline).
    const [remoteDelivery,remoteRoute]=await Promise.all([
      getDocFromServer(doc(db,'deliveries',row.targetId)),
      getDocFromServer(doc(db,'routes',routeId)),
    ]);
    if(!remoteDelivery.exists()||!remoteRoute.exists())throw new Error('Entrega ou rota não encontrada no servidor.');
    const delivery=remoteDelivery.data();
    const route=remoteRoute.data();
    if(delivery.completed===true||delivery.route_id!==routeId||route.status!=='aberta'||
      !(route.started_at||route.departure_time)||
      (delivery.fulfillment_mode!==undefined&&delivery.fulfillment_mode!=='delivery')||
      (delivery.source_system==='dfl_site'&&['pendente','agendado','cancelado','cancelada','cancelled','canceled'].includes(String(delivery.site_order_status||'').toLowerCase())))
      throw new Error('Estado remoto mudou. Não foi aplicada nenhuma baixa; confira a entrega.');
    const store=useAppStore.getState();
    const local=store.deliveries.find(item=>item.id===row.targetId);
    const localRoute=store.routes.find(item=>item.id===routeId);
    if(!local||!localRoute||local.completed===true||local.route_id!==routeId||localRoute.status!=='aberta'||
      !(localRoute.started_at||localRoute.departure_time)||local.updated_at!==delivery.updated_at||localRoute.updated_at!==route.updated_at)
      throw new Error('Dados locais desatualizados. Sincronize a loja antes de confirmar; nenhuma baixa foi iniciada.');
    await store.updateDelivery(row.targetId,{completed:true});
  }catch(error){
    // Pode ter havido falha depois de persistir. Não repetir automaticamente.
    throw new Error((error instanceof Error?error.message:'Não foi possível executar a baixa.')+
      ' A reserva expira em até 3 minutos; verifique o status real antes de tentar outra vez.');
  }
  try{
    const confirmed=await post({action:'complete_delivery',id:row.id,token});
    if(confirmed.applied!==true)throw new Error('Confirmação sem comprovante.');
  }catch(error){
    throw new Error('A baixa pode já ter sido salva, mas o vínculo com a solicitação não foi confirmado. Confira Entregas e a fila; não repita a baixa automaticamente. '+
      (error instanceof Error?error.message:''));
  }
}
export async function verifyCanonicalPurchase(requestId:string,supplyId:string):Promise<void>{
  const result=await post({action:'verify_purchase',id:requestId,supplyId});
  if(result.linked!==true)throw new Error('Compra não conciliada.');
}
