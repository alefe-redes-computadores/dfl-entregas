import { Capacitor } from '@capacitor/core';
import { auth } from '@/lib/firebase';
export type ManualKickResult={ok?:boolean;status?:'off'|'skipped'|'queued'|'duplicate'|'failed';reason?:string};
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
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const token=await user.getIdToken();
    const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({action,deliveryId}),cache:'no-store',credentials:'omit',keepalive:true,signal:controller.signal});
    const parsed=await response.json().catch(()=>null) as ManualKickResult|null;
    return parsed&&typeof parsed==='object'?{...parsed,ok:response.ok&&parsed.ok===true}:{ok:false,status:'failed',reason:'invalid_response'};
  }catch{return {ok:false,status:'failed',reason:'bridge_unavailable'};}
  finally{clearTimeout(timer);}
}
