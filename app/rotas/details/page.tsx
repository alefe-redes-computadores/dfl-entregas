'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bike, CheckCircle2, Clock3, Edit3, MapPin, Package, Play, RotateCcw, User, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { firstValidTimestamp, type TimestampLike } from '@/lib/reports/time';
import { RouteOperationalMemory } from '@/components/intelligence/EntityOperationalMemory';

const fmt = (...values: TimestampLike[]) => {
  const date = firstValidTimestamp(...values);

  return date
    ? date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Não registrado';
};

export default function RouteDetailsPage() {
  const router = useRouter(); const params = useSearchParams(); const id = params.get('id');
  const route = useAppStore((state) => state.routes.find((item) => item.id === id));
  const deliveries = useAppStore((state) => state.deliveries.filter((item) => item.route_id === id).sort((a,b)=>(a.order_index ?? 9999)-(b.order_index ?? 9999)));
  const startRoute = useAppStore((state) => state.startRoute); const closeRoute = useAppStore((state) => state.closeRoute); const reopenRoute = useAppStore((state) => state.reopenRoute);
  const [busy, setBusy] = useState(false);
  if (!route) return <div className="py-20 text-center"><p className="text-zinc-400">Rota não encontrada.</p><button onClick={()=>router.replace('/rotas')} className="mt-4 text-emerald-400">Voltar às rotas</button></div>;
  const pending = deliveries.filter((item)=>!item.completed).length; const total = deliveries.reduce((sum,item)=>sum+(item.value||0),0);
  const routeStartedAt = firstValidTimestamp(route.started_at, route.departure_time);
  const action = async (kind:'start'|'close'|'reopen') => { if(busy)return; setBusy(true); try { if(kind==='start') await startRoute(route.id); else if(kind==='close') await closeRoute(route.id); else await reopenRoute(route.id); toast.success(kind==='start'?'Rota iniciada.':kind==='close'?'Rota finalizada.':'Rota reaberta.'); } catch(error){ toast.error(error instanceof Error?error.message:'Não foi possível atualizar a rota.'); } finally{setBusy(false);} };
  return <div className="flex flex-col gap-5 pb-28">
    <div className="flex items-center gap-3"><button onClick={()=>router.replace('/rotas')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900"><ArrowLeft size={20}/></button><div className="min-w-0 flex-1"><p className="text-xs text-zinc-500">Detalhes da rota</p><h1 className="truncate font-heading text-xl font-bold">{route.name}</h1></div><button onClick={()=>router.push(`/rotas/editar?id=${route.id}`)} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900"><Edit3 size={17}/></button></div>
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/50 p-5"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400"><Bike/></div><div><p className="font-bold">{route.status==='fechada'?'Finalizada':routeStartedAt?'Na rua':'Montando'}</p><p className="flex items-center gap-1 text-sm text-zinc-400"><User size={13}/>{route.motoboy_name}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-zinc-950/70 p-3"><Package size={15} className="text-emerald-400"/><p className="mt-2 text-lg font-bold">{deliveries.length-pending}/{deliveries.length}</p><p className="text-[10px] text-zinc-500">Concluídas</p></div><div className="rounded-2xl bg-zinc-950/70 p-3"><Wallet size={15} className="text-amber-400"/><p className="mt-2 text-lg font-bold">R$ {total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><p className="text-[10px] text-zinc-500">Valor bruto</p></div></div></div>
    <RouteOperationalMemory routeId={route.id}/>
    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4"><h2 className="font-bold">Linha do tempo</h2><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between"><span className="text-zinc-500">Criada</span><span>{fmt(route.created_at, route.started_at, route.departure_time)}</span></p><p className="flex justify-between"><span className="text-zinc-500">Saída real</span><span>{fmt(route.started_at, route.departure_time)}</span></p><p className="flex justify-between"><span className="text-zinc-500">Encerrada</span><span>{fmt(route.end_time)}</span></p></div></div>
    <div><h2 className="mb-3 font-bold">Paradas</h2><div className="space-y-2">{deliveries.map((delivery,index)=><button key={delivery.id} onClick={()=>router.push(`/entregas/details?id=${delivery.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{delivery.customer_name || `Pedido ${delivery.order_id || ''}`}</p><p className="truncate text-xs text-zinc-500"><MapPin size={11} className="mr-1 inline"/>{delivery.address_string}</p></div>{delivery.completed?<CheckCircle2 size={18} className="text-emerald-400"/>:<Clock3 size={18} className="text-zinc-600"/>}</button>)}{deliveries.length===0&&<p className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">Nenhuma entrega vinculada.</p>}</div></div>
    {route.status==='fechada'?<button disabled={busy} onClick={()=>action('reopen')} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-bold text-zinc-950"><RotateCcw size={18}/>Reabrir rota</button>:!routeStartedAt?<button disabled={busy||deliveries.length===0} onClick={()=>action('start')} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 font-bold text-zinc-950 disabled:opacity-40"><Play size={18}/>Iniciar rota</button>:<button disabled={busy||pending>0} onClick={()=>action('close')} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-zinc-950 disabled:opacity-40"><CheckCircle2 size={18}/>{pending>0?`${pending} entrega(s) pendente(s)`:'Finalizar rota'}</button>}
  </div>;
}
