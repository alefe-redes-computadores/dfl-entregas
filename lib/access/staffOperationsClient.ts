'use client';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { isSuperadminUid } from './roles';
import { StaffRequestRetry } from './staffRequestRetry';

const requestIds = new StaffRequestRetry();

export type OperationRequestRow = {
  id:string;kind:'delivery_confirmation'|'purchase_intent';targetId:string;status:string;
  actorUid:string;actorName:string;createdAt:string;quantity?:number;unit?:string;note?:string;
};
const endpoint=()=>{
  if (!Capacitor.isNativePlatform()) return '/api/access/operations';
  const origin=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN || 'https://dfl-entregas.vercel.app').trim().replace(/\/+$/,'');
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)) throw new Error('Servidor inválido.');
  return `${origin}/api/access/operations`;
};
async function request(method:'GET'|'POST',body?:unknown):Promise<Record<string,unknown>>{
  const user=auth.currentUser;
  if (!user) throw new Error('A conta não está autenticada.');
  const token=await user.getIdToken(true);
  if (auth.currentUser?.uid !== user.uid) throw new Error('A conta foi alterada durante a autenticação.');
  const abort=new AbortController();
  const timeout=window.setTimeout(()=>abort.abort(),20000);
  try {
    const response=await fetch(endpoint(),{
      method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',signal:abort.signal,
    });
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error(`Resposta inválida (HTTP ${response.status}).`);
    const payload=await response.json() as Record<string,unknown>;
    if (!response.ok || payload.ok !== true) throw new Error(typeof payload.error==='string'?payload.error:`Falha HTTP ${response.status}`);
    return payload;
  } finally {window.clearTimeout(timeout);}
}
export async function submitStaffOperation(kind:'delivery_confirmation'|'purchase_intent',targetId:string,quantity?:number){
  if (isSuperadminUid(auth.currentUser?.uid)) throw new Error('Use os fluxos administrativos da loja.');
  // Repetir apos timeout usa o MESMO ID: o backend responde duplicate, sem nova proposta.
  const uid=auth.currentUser?.uid;
  if(!uid)throw new Error('Sessão encerrada.');
  const requestId=requestIds.reserve(uid,kind,targetId,quantity,Date.now(),()=>crypto.randomUUID());
  return request('POST',{kind,targetId,requestId,...(kind==='purchase_intent'?{quantity}:{})});
}
export async function readStaffOperations():Promise<OperationRequestRow[]>{
  if (!isSuperadminUid(auth.currentUser?.uid)) throw new Error('Acesso administrativo restrito.');
  const result=await request('GET');
  return Array.isArray(result.rows)?result.rows as OperationRequestRow[]:[];
}
export async function reviewStaffOperation(id:string,decision:'reviewed'|'dismissed'){
  if (!isSuperadminUid(auth.currentUser?.uid)) throw new Error('Acesso administrativo restrito.');
  return request('POST',{operation:'review',id,decision,confirmation:'CONFERI MANUALMENTE'});
}
