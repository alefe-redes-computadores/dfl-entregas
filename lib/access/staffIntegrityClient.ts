'use client';
/** Requisicao explicita, sem persistencia, polling nem uso da store administrativa. */
import {Capacitor} from '@capacitor/core';
import {auth} from '@/lib/firebase';
import {isSuperadminUid} from './roles';
import {safeUid} from './staffReadinessPolicy';
import type {IntegritySummary} from './staffIntegrityPolicy';
function endpoint(uid:string){
  const relative=`/api/access/integrity?uid=${encodeURIComponent(uid)}`;
  if(!Capacitor.isNativePlatform())return relative;
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN||'https://dfl-entregas.vercel.app').trim().replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base))throw new Error('Servidor administrativo inválido.');
  return base+relative;
}
export async function inspectStaffIntegrity(uid:string):Promise<IntegritySummary>{
  const user=auth.currentUser;
  if(!user||!isSuperadminUid(user.uid)||!safeUid(uid)||isSuperadminUid(uid))throw new Error('Auditoria disponível somente ao proprietário para uma conta válida.');
  const token=await user.getIdToken(true);
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),30000);
  try{
    const res=await fetch(endpoint(uid),{method:'GET',headers:{authorization:`Bearer ${token}`},cache:'no-store',credentials:'omit',signal:controller.signal});
    if(!(res.headers.get('content-type')||'').includes('application/json'))throw new Error(`Resposta inesperada do servidor (HTTP ${res.status}).`);
    const data=await res.json() as IntegritySummary&{error?:string};
    if(!res.ok||data.ok!==true||data.uid!==uid||data.verification!=='sample_only'||!Array.isArray(data.areas))throw new Error(data.error||`Auditoria indisponível (HTTP ${res.status}).`);
    return data;
  }finally{window.clearTimeout(timer);}
}
