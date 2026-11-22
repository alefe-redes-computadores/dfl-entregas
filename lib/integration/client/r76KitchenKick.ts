/** R76 P2: acionamento pós-escrita, sem acesso direto a Supabase/Evolution. */
import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
import type { KitchenStage } from '@/lib/integration/r76KitchenPolicy';
export type KitchenKick={ok?:boolean;status?:'off'|'skipped'|'queued'|'duplicate'|'review_required';reason?:string};
export async function kickR76KitchenStage(deliveryId:string,stage:KitchenStage):Promise<KitchenKick>{
  const user=auth.currentUser;
  if(!user)return {status:'off',reason:'session_unavailable'};
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId))return {status:'skipped',reason:'invalid_id'};
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||'https://dfl-entregas.vercel.app').replace(/\/+$/,'');
  const url=Capacitor.isNativePlatform()?`${base}/api/integration/kitchen-stage`:'/api/integration/kitchen-stage';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{const token=await user.getIdToken();const res=await fetch(url,{method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({deliveryId,stage}),credentials:'omit',cache:'no-store',keepalive:true,signal:controller.signal});
    const data=await res.json().catch(()=>null) as KitchenKick|null;
    return data&&typeof data==='object'?data:{status:'review_required',reason:'response_unknown'};
  }catch{return {status:'review_required',reason:'transport_unknown'};}
  finally{clearTimeout(timer);}
}

/** R82: so o Site registra a transicao comercial e autoriza avisos para seus pedidos. */
export async function kickSiteKitchenStage(deliveryId:string,stage:KitchenStage):Promise<KitchenKick>{
  const user=auth.currentUser;
  if(!user)return {status:'review_required',reason:'session_unavailable'};
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId))return {status:'skipped',reason:'invalid_id'};
  const base=(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||'https://dfl-entregas.vercel.app').replace(/\/+$/,'');
  const url=Capacitor.isNativePlatform()?`${base}/api/integration/site-kitchen-sync`:'/api/integration/site-kitchen-sync';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
    const token=await user.getIdToken();
    const res=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({deliveryId,stage}),credentials:'omit',cache:'no-store',keepalive:true,signal:controller.signal});
    const data=await res.json().catch(()=>null) as KitchenKick|null;
    return data&&typeof data==='object'?data:{status:'review_required',reason:'response_unknown'};
  }catch{return {status:'review_required',reason:'transport_unknown'};}
  finally{clearTimeout(timer);}
}
