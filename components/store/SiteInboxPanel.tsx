'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarClock, ChevronDown, CheckCircle2, Inbox, MapPin, Plus, Route as RouteIcon, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';
import { siteInboxProjection, type SiteInboxState } from '@/lib/operation/siteInboxPolicy';
import { acknowledgeSiteOrders } from '@/lib/site-order-inbox';
import { toast } from '@/lib/operational-toast';
import { OPERATION_FIRST_BATCH, nextProgressiveCount } from '@/lib/operation/progressiveWindow';
import type { Delivery } from '@/types';

const captions: Record<Extract<SiteInboxState, 'confirmar'|'pronto'|'aguardar_agenda'|'revisar'>,string> = {
  confirmar:'Aguardando aprovação comercial', pronto:'Pronto para organizar',
  aguardar_agenda:'Agendado · ainda não liberado', revisar:'Revisar status do Site',
};
const tones = {confirmar:'text-amber-300 border-amber-500/20 bg-amber-500/[.06]', pronto:'text-emerald-300 border-emerald-500/20 bg-emerald-500/[.06]',
  aguardar_agenda:'text-sky-300 border-sky-500/20 bg-sky-500/[.06]', revisar:'text-zinc-300 border-zinc-700 bg-zinc-800/40'} as const;
const amount = (value:number) => (Number.isFinite(value)?Math.max(0,value):0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

type SiteRow = ReturnType<typeof siteInboxProjection>['rows'][number];
export function SiteInboxPanel({focusedId}:{focusedId?:string|null}) {
  const router = useRouter();
  const deliveries = useAppStore(state=>state.deliveries);
  const routes = useAppStore(state=>state.routes);
  const motoboys = useAppStore(state=>state.motoboys);
  const allocate = useAppStore(state=>state.allocateSiteDelivery);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{
    const refresh=()=>setClock(Date.now());
    window.addEventListener('focus',refresh);
    window.addEventListener('dfl:app-foreground',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.removeEventListener('focus',refresh);window.removeEventListener('dfl:app-foreground',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const projection = useMemo(()=>siteInboxProjection(deliveries,clock),[deliveries,clock]);
  const [filter,setFilter]=useState<'all'|'pronto'|'confirmar'|'aguardar_agenda'|'revisar'>('all');
  const [limit,setLimit]=useState(OPERATION_FIRST_BATCH);
  const [editing,setEditing]=useState<string|null>(null);
  const [selection,setSelection]=useState('');
  const [newMode,setNewMode]=useState(false);
  const [routeName,setRouteName]=useState('');
  const [motoboyId,setMotoboyId]=useState('');
  const [saving,setSaving]=useState(false);
  const lock=useRef(false);
  const today=dateKey(new Date());
  const availableRoutes=useMemo(()=>routes.filter(route =>
    route.status==='aberta' && !route.started_at && !route.end_time && routeOperationalDateKey(route)===today),[routes,today]);
  const activeMotoboys=useMemo(()=>motoboys.filter(item=>item.active),[motoboys]);
  const displayed=useMemo(()=>{
    const filtered=projection.rows.filter(row=>filter==='all'||row.state===filter);
    if(!focusedId)return filtered;
    // Deep link from Android: focused request first; do not hide other actionable orders.
    return [...filtered].sort((a,b)=>Number(b.delivery.id===focusedId)-Number(a.delivery.id===focusedId));
  },[projection,filter,focusedId]);
  const shown=displayed.slice(0,limit);
  useEffect(()=>setLimit(OPERATION_FIRST_BATCH),[filter]);
  useEffect(()=>{if(focusedId && projection.rows.some(row=>row.delivery.id===focusedId)){
    setFilter('all');setEditing(focusedId);
  }},[focusedId,projection.rows]);
  useEffect(()=>{
    // Leitura nao descarta a pendencia: apenas marca o aviso local como visto.
    acknowledgeSiteOrders(projection.rows.map(row=>row.delivery.id));
  },[projection.rows]);
  const begin=(delivery:Delivery)=>{
    setEditing(current=>current===delivery.id?null:delivery.id);
    setSelection('');setNewMode(false);setRouteName('');setMotoboyId('');
  };
  const submit=async(delivery:Delivery)=>{
    if(lock.current)return;
    if(!newMode&&!selection){toast.warning('Escolha uma rota aberta.');return;}
    if(newMode&&(!routeName.trim()||!motoboyId)){toast.warning('Informe nome da nova rota e motoboy.');return;}
    lock.current=true;setSaving(true);
    try{
      const routeId=await allocate(delivery.id,newMode?{newRoute:{name:routeName.trim(),motoboyId}}:{routeId:selection});
      toast.success('Pedido vinculado à rota.',{description:'A saída para entrega só acontece ao iniciar a rota.'});
      setEditing(null);
      router.push(`/rotas/details?id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(today)}`);
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível vincular o pedido.';
      toast.error('Não foi possível alocar.',{description:message});
    }finally{lock.current=false;setSaving(false);}
  };
  return <section className="space-y-3" aria-label="Pedidos recebidos do Site">
    <div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.045] p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><Inbox size={20}/></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-zinc-100">Pedidos do Site · sem rota</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Os pedidos já existem na sincronização. Aqui você confere e escolhe o destino, sem duplicar a entrega ou confirmar a venda automaticamente.</p>
        </div>
        <span className="rounded-xl bg-zinc-950/60 px-2.5 py-1.5 text-lg font-black tabular-nums text-zinc-100">{projection.total}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
        <div className="rounded-xl bg-zinc-950/50 p-2"><b className="block text-base text-emerald-300">{projection.ready}</b><span className="text-zinc-500">Prontos</span></div>
        <div className="rounded-xl bg-zinc-950/50 p-2"><b className="block text-base text-amber-300">{projection.commercial}</b><span className="text-zinc-500">Confirmar</span></div>
        <div className="rounded-xl bg-zinc-950/50 p-2"><b className="block text-base text-sky-300">{projection.scheduled+projection.review}</b><span className="text-zinc-500">Aguardar/revisar</span></div>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar pedidos do Site">
      {([['all','Todos',projection.total],['pronto','Prontos',projection.ready],['confirmar','Comercial',projection.commercial],['aguardar_agenda','Agendados',projection.scheduled],['revisar','Revisar',projection.review]] as const).map(([key,label,count])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-bold ${filter===key?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label} · {count}</button>)}
    </div>
    {!shown.length?<div className="rounded-2xl border border-dashed border-zinc-800 p-7 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-400"/><p className="mt-2 text-xs font-bold text-zinc-300">Nenhum pedido nesta seleção</p><p className="mt-1 text-[10px] text-zinc-500">Novos pedidos entram automaticamente quando a sincronização chegar.</p></div>:null}
    {shown.map(({delivery,state,duplicate}:SiteRow)=>{
      const expanded=editing===delivery.id;
      return <article key={delivery.id} className={`scroll-mt-28 rounded-[20px] border p-3.5 ${tones[state]}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide">{duplicate?'Possível pedido duplicado · revisar origem':captions[state]}</p><h3 className="mt-1 truncate text-sm font-black text-zinc-100">{delivery.customer_name||'Cliente do Site'} · #{delivery.external_order_id||delivery.order_id||delivery.id}</h3></div>
          <span className="shrink-0 text-sm font-black text-zinc-100">{amount(Number(delivery.customer_charge??delivery.value))}</span>
        </div>
        {duplicate&&<p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">Foram encontrados registros com o mesmo ID externo. Confira e concilie os pedidos antes de alocar uma rota.</p>}
        <p className="mt-2 flex items-start gap-1 text-[11px] text-zinc-400"><MapPin size={13} className="mt-0.5 shrink-0"/>{delivery.address_string||'Endereço não informado'}</p>
        {delivery.scheduled_for&&<p className="mt-1 flex items-center gap-1 text-[10px] text-sky-300"><CalendarClock size={13}/> Agendado: {delivery.scheduled_label||delivery.scheduled_for}</p>}
        {state==='pronto'?<button type="button" onClick={()=>begin(delivery)} aria-expanded={expanded} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-200"><RouteIcon size={16}/>{expanded?'Fechar escolha de rota':'Escolher rota'}<ChevronDown size={15}/></button>:
        <button type="button" onClick={()=>router.push('/loja?site=pending')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 text-xs font-bold text-zinc-200"><ShoppingBag size={15}/>Conferir no Admin do Site</button>}
        {expanded&&state==='pronto'&&<div className="mt-3 space-y-3 rounded-2xl border border-zinc-700/60 bg-zinc-950/75 p-3">
          <div className="flex gap-2"><button type="button" aria-pressed={!newMode} onClick={()=>setNewMode(false)} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${!newMode?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}>Rota existente</button><button type="button" aria-pressed={newMode} onClick={()=>setNewMode(true)} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${newMode?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}><Plus size={13} className="inline"/> Nova rota</button></div>
          {!newMode?<div className="max-h-48 space-y-1.5 overflow-y-auto">{availableRoutes.length?availableRoutes.map(route=><button type="button" key={route.id} onClick={()=>setSelection(route.id)} aria-pressed={selection===route.id} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-xs ${selection===route.id?'border-emerald-400 bg-emerald-400/10 text-emerald-200':'border-zinc-800 bg-zinc-900/60 text-zinc-300'}`}><RouteIcon size={14}/><span className="min-w-0 flex-1 truncate">{route.name} · {route.motoboy_name}</span>{selection===route.id&&<CheckCircle2 size={14}/>}</button>):<p className="rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-400">Nenhuma rota aberta de hoje sem saída. Use Nova rota.</p>}</div>:<div className="space-y-2"><label className="block text-[11px] font-semibold text-zinc-300">Nome da rota<input value={routeName} onChange={event=>setRouteName(event.target.value)} placeholder="Ex.: Centro 2" maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-emerald-500"/></label><p className="text-[11px] font-semibold text-zinc-300">Motoboy responsável</p><div className="grid grid-cols-2 gap-1.5">{activeMotoboys.map(motoboy=><button type="button" key={motoboy.id} onClick={()=>setMotoboyId(motoboy.id)} aria-pressed={motoboyId===motoboy.id} className={`min-h-11 rounded-xl border px-2 text-[11px] font-bold ${motoboyId===motoboy.id?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}>{motoboy.name}</button>)}</div>{!activeMotoboys.length&&<p className="text-[10px] text-amber-300">Cadastre um motoboy ativo antes de criar uma rota.</p>}</div>}
          <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-400"><ShieldCheck size={15} className="shrink-0 text-emerald-400"/>O Firestore revalida o pedido e a rota antes de salvar. Nenhuma mensagem de saída será enviada apenas pela alocação.</p>
          <button type="button" disabled={saving||(!newMode&&!selection)||(newMode&&(!routeName.trim()||!motoboyId))} onClick={()=>void submit(delivery)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-40">{saving?'Salvando...':'Confirmar vínculo à rota'}<CheckCircle2 size={15}/></button>
        </div>}
      </article>;
    })}
    {displayed.length>shown.length&&<button type="button" onClick={()=>setLimit(v=>nextProgressiveCount(displayed.length,v))} className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 text-xs font-bold text-zinc-300">Mostrar mais · {shown.length} de {displayed.length}</button>}
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-3 text-[10px] leading-relaxed text-zinc-500"><AlertCircle size={14} className="mr-1 inline"/>Acesso offline: você pode conferir pedidos já sincronizados, mas precisa de conexão para confirmar a alocação. Retiradas, balcão e cancelamentos não entram nesta fila logística.</div>
  </section>;
}
