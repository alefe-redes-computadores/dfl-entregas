'use client';
/** Apenas proprietário; sem retry silencioso e sem persistir dados projetados. */
import {Capacitor} from '@capacitor/core';
import {auth} from '@/lib/firebase';
import {isSuperadminUid} from './roles';
import {safeRefreshUid} from './staffRefreshPolicy';
export interface RefreshPreview {
 ok:true;operation:'preview';targetUid:string;accountUpdatedAt:string;digest:string;refreshEnabled:boolean;
 sampleOnly:true;projectionsRemainSuspended:true;
 areas:{area:string;previous:number;next:number;added:number;removed:number;changed:number}[];
 totalNew:number;totalChanges:number;
}
export interface RefreshCompleted {ok:true;operation:'refresh';targetUid:string;suspended:true;syncedAt:string;applied:boolean;summary:{totalNew:number;totalChanges:number}}
function endpoint(){if(!Capacitor.isNativePlatform())return '/api/access/refresh';
 const origin=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN||'https://dfl-entregas.vercel.app').trim().replace(/\/+$/,'');
 if(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin))throw new Error('Servidor administrativo inválido.');return origin+'/api/access/refresh';}
export async function requestStaffRefresh(uid:string,operation:'preview'|'refresh',previous?:RefreshPreview):Promise<RefreshPreview|RefreshCompleted>{
 const user=auth.currentUser;
 if(!user||!isSuperadminUid(user.uid)||!safeRefreshUid(uid)||isSuperadminUid(uid))throw new Error('Conta inválida para sincronização.');
 if(operation==='refresh'&&(!previous||previous.targetUid!==uid||!previous.refreshEnabled))throw new Error('A prévia precisa ser refeita ou o servidor está bloqueado.');
 const token=await user.getIdToken(true);
 const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),30000);
 try{const response=await fetch(endpoint(),{method:'POST',cache:'no-store',credentials:'omit',signal:controller.signal,
  headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
  body:JSON.stringify({operation,targetUid:uid,...(operation==='refresh'?{expectedDigest:previous!.digest,expectedUpdatedAt:previous!.accountUpdatedAt,confirmation:'SINCRONIZAR SUSPENSO'}:{})})});
  if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error(`Servidor respondeu conteúdo inválido (HTTP ${response.status}).`);
  const body=await response.json() as (RefreshPreview|RefreshCompleted)&{error?:string};
  if(!response.ok||body.ok!==true||body.targetUid!==uid||body.operation!==operation)throw new Error(body.error||`Sincronização indisponível (HTTP ${response.status}).`);
  return body;
 }finally{window.clearTimeout(timeout);}
}
