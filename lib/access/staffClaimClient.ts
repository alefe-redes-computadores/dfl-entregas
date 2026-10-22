'use client';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import { isSuperadminUid } from './roles';

type Claim = { uid: string; receivedAt: string };
const DEFAULT_SERVER = 'https://dfl-entregas.vercel.app';
function endpoint() {
  if (!Capacitor.isNativePlatform()) return '/api/access/claim';
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN || DEFAULT_SERVER).trim().replace(/\/+$/,'');
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base)) throw new Error('Servidor não autorizado.');
  return base + '/api/access/claim';
}
async function send(url: string, method: 'GET' | 'POST') {
  const user=auth.currentUser;
  if (!user) throw new Error('Entre com sua conta Google.');
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),12_000);
  try {
    const result=await fetch(url,{ method, cache:'no-store',credentials:'omit',signal:controller.signal,
      headers:{authorization:'Bearer '+await user.getIdToken()} });
    const content=result.headers.get('content-type')||'';
    if (!content.includes('application/json')) throw new Error('Servidor de vínculo indisponível.');
    const body=await result.json();
    if (!result.ok || body.ok!==true) throw new Error(body.error || 'Solicitação não concluída.');
    return body;
  } finally {window.clearTimeout(timeout);}
}
export async function requestOwnStaffLink(): Promise<string> {
  if (isSuperadminUid(auth.currentUser?.uid)) throw new Error('Use uma conta de funcionário.');
  const body=await send(endpoint(),'POST');
  return String(body.message||'Solicitação recebida.');
}
export async function fetchStaffLinkClaims(draftId: string): Promise<Claim[]> {
  if (!isSuperadminUid(auth.currentUser?.uid)) throw new Error('Somente administrador.');
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(draftId)) throw new Error('Cadastro inválido.');
  const body=await send(endpoint()+'?draftId='+encodeURIComponent(draftId),'GET');
  if (!Array.isArray(body.claims)) throw new Error('Resposta de vínculos inválida.');
  return body.claims.filter((x:unknown):x is Claim=>!!x&&typeof x==='object'&&
    typeof (x as Claim).uid==='string'&&/^[A-Za-z0-9_-]{8,120}$/.test((x as Claim).uid)&&
    typeof (x as Claim).receivedAt==='string').slice(0,10);
}
