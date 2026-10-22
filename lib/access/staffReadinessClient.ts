'use client';
/** Consulta explícita do owner. Sem polling, listeners ou persistência local. */
import {Capacitor} from '@capacitor/core';
import {auth} from '@/lib/firebase';
import {isSuperadminUid} from '@/lib/access/roles';
import type {ReadinessSummary} from '@/lib/access/staffReadinessPolicy';
function endpoint(){
  if(!Capacitor.isNativePlatform())return '/api/access/readiness';
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN||'https://dfl-entregas.vercel.app').trim().replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(base))throw new Error('Servidor administrativo inválido.');
  return `${base}/api/access/readiness`;
}
let activeRead:{uid:string;promise:Promise<ReadinessSummary>}|null=null;
/** Mesma UID, mesma requisicao simultanea. Nunca cacheia depois de concluida. */
export function inspectStaffReadiness():Promise<ReadinessSummary>{
  try{return inspectStaffReadinessImpl();}catch(e){return Promise.reject(e);}
}
function inspectStaffReadinessImpl():Promise<ReadinessSummary>{
  const owner=auth.currentUser;
  if(!owner||!isSuperadminUid(owner.uid))throw new Error('Somente a conta proprietária pode conferir a equipe.');
  if(activeRead?.uid===owner.uid)return activeRead.promise;
  const promise=readFromServer(owner);
  activeRead={uid:owner.uid,promise};
  void promise.then(()=>{if(activeRead?.promise===promise)activeRead=null;},()=>{if(activeRead?.promise===promise)activeRead=null;});
  return promise;
}
async function readFromServer(owner:NonNullable<typeof auth.currentUser>):Promise<ReadinessSummary>{
  const token=await owner.getIdToken(true);
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),25000);
  try{
    const res=await fetch(endpoint(),{method:'GET',headers:{authorization:`Bearer ${token}`},
      cache:'no-store',credentials:'omit',signal:controller.signal});
    if(!(res.headers.get('content-type')||'').includes('application/json'))throw new Error(`Resposta inesperada do servidor (HTTP ${res.status}).`);
    const response=await res.json() as ReadinessSummary&{error?:string};
    if(!res.ok||response.ok!==true||!Array.isArray(response.accounts))throw new Error(response.error||`Diagnóstico indisponível (HTTP ${res.status}).`);
    return response;
  }finally{window.clearTimeout(timer);}
}
