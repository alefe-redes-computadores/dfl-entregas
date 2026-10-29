'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarClock, ChevronDown, CheckCircle2, Inbox, MapPin, Plus, Route as RouteIcon, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';
import { siteInboxProjection, type SiteInboxState } from '@/lib/operation/siteInboxPolicy';
import { searchSiteInboxRows, openRouteWorkload, siteAllocationPreflight } from '@/lib/operation/site-inbox-triage';
import { acknowledgeSiteOrders } from '@/lib/site-order-inbox';
import { toast } from '@/lib/operational-toast';
import { OPERATION_FIRST_BATCH, nextProgressiveCount } from '@/lib/operation/progressiveWindow';
import { siteHistoryRows, siteHistoryLabel, siteHistoryDetail, siteHistoryKind } from '@/lib/operation/site-order-history-r161';
import type { Delivery } from '@/types';

const captions: Record<Extract<SiteInboxState, 'confirmar'|'pronto'|'aguardar_agenda'|'revisar'>,string> = {
  confirmar:'Aguardando aprovação comercial', pronto:'Aceito · escolher rota',
  aguardar_agenda:'Agendado · ainda não liberado', revisar:'Revisar status do Site',
};
const tones = {confirmar:'text-amber-300 border-amber-500/20 bg-amber-500/[.06]', pronto:'text-emerald-300 border-emerald-500/20 bg-emerald-500/[.06]',
  aguardar_agenda:'text-sky-300 border-sky-500/20 bg-sky-500/[.06]', revisar:'text-zinc-300 border-zinc-700 bg-zinc-800/40'} as const;
const amount = (value:number) => (Number.isFinite(value)?Math.max(0,value):0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

// R160_SITE_ACTIONS: orientacao de operacao, nunca autoridade comercial ou de despacho.
const siteStep = (state: Extract<SiteInboxState, 'confirmar'|'pronto'|'aguardar_agenda'|'revisar'>, duplicate?: boolean) => {
  if (duplicate) return { title: 'Revisar duplicidade', hint: 'Existem registros relacionados ao mesmo pedido. Resolva a divergência antes de alocar.', action: 'Conferir no Admin do Site' };
  switch (state) {
    case 'confirmar': return { title: 'Aguardando aprovação comercial', hint: 'A decisão comercial acontece no Site. Nenhuma rota pode sair antes da aprovação.', action: 'Conferir aprovação no Site' };
    case 'aguardar_agenda': return { title: 'Agendado para mais tarde', hint: 'Pedido aprovado, mas ainda protegido pelo horário. Planejamento antecipado não é despacho.', action: 'Consultar agendamento no Site' };
    case 'pronto': return { title: 'Pronto para organizar', hint: 'Pedido liberado para escolher uma rota não iniciada.', action: 'Escolher rota' };
    default: return { title: 'Status requer revisão', hint: 'Estado não reconhecido para alocação. Confira a origem antes de agir.', action: 'Revisar status no Site' };
  }
};


type SiteRow = ReturnType<typeof siteInboxProjection>['rows'][number];
export function SiteInboxPanel({focusedId}:{focusedId?:string|null}) {
  const router = useRouter();
  const deliveries = useAppStore(state=>state.deliveries);
  const routes = useAppStore(state=>state.routes);
  const motoboys = useAppStore(state=>state.motoboys);
  const allocate = useAppStore(state=>state.allocateSiteDelivery);
  const archiveSiteDelivery = useAppStore(state=>state.archiveSiteDelivery);
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
  const [search,setSearch]=useState('');
  const [historyOpen,setHistoryOpen]=useState(false);
  // R166_HISTORY_FILTER: sem consulta extra ao Firestore.
  const [historySearch,setHistorySearch]=useState('');
  const [historyStatus,setHistoryStatus]=useState<'todos'|'cancelado'|'retirado_operacao'|'entregue'|'tentativa'>('todos');
  const [historyLimit,setHistoryLimit]=useState(10);
  const history=useMemo(()=>siteHistoryRows(deliveries, 200),[deliveries]);
  const filteredHistory=useMemo(()=>{
    const needle=historySearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return history.filter(item=>{
      if(historyStatus!=='todos' && siteHistoryKind(item)!==historyStatus)return false;
      if(!needle)return true;
      return [item.customer_name,item.external_order_id,item.order_id,item.id,item.phone,item.operational_dismissal_reason]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle);
    });
  },[history,historySearch,historyStatus]);
  const [saveError,setSaveError]=useState('');
  const focusedOnce=useRef<string|null>(null);
  const [limit,setLimit]=useState(OPERATION_FIRST_BATCH);
  const [editing,setEditing]=useState<string|null>(null);
  const [selection,setSelection]=useState('');
  const [newMode,setNewMode]=useState(false);
  const [routeName,setRouteName]=useState('');
  const [motoboyId,setMotoboyId]=useState('');
  const [saving,setSaving]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [reviewAddress,setReviewAddress]=useState('');
  const [reviewPhone,setReviewPhone]=useState('');
  const [reviewObservation,setReviewObservation]=useState('');
  const [reviewPayment,setReviewPayment]=useState<Delivery['payment_method']>('dinheiro');
  const lock=useRef(false);
  // R165_SITE_ARCHIVE: confirmação explícita; arquivamento não equivale a cancelamento comercial.
  const [archiveId,setArchiveId]=useState<string|null>(null);
  const [archiveReason,setArchiveReason]=useState('');
  const [archiveBusy,setArchiveBusy]=useState(false);
  const archiveLock=useRef(false);
  const requestArchive=(delivery:Delivery)=>{
    if (archiveLock.current || delivery.source_system!=='dfl_site' || delivery.route_id?.trim() || delivery.completed || delivery.operational_dismissed_at) return;
    setArchiveReason('');setArchiveId(delivery.id);
  };
  const confirmArchive=async()=>{
    if(!archiveId || archiveLock.current)return;
    const reason=archiveReason.trim();
    if(reason.length<8){toast.warning('Informe um motivo de pelo menos 8 caracteres.');return;}
    const live=deliveries.find(item=>item.id===archiveId);
    if(!live || live.source_system!=='dfl_site' || live.route_id?.trim() || live.completed || live.operational_dismissed_at){
      toast.warning('O pedido mudou. Sincronize antes de arquivar.');setArchiveId(null);return;
    }
    archiveLock.current=true;setArchiveBusy(true);
    try{
      await archiveSiteDelivery(archiveId,reason);
      setEditing(null);setArchiveId(null);setArchiveReason('');
      toast.success('Pedido arquivado na operação.',{description:'O histórico foi mantido. O status comercial no Site não foi cancelado.'});
    }catch(error){toast.error('Não foi possível arquivar.',{description:error instanceof Error?error.message:'Confira a sincronização.'});}
    finally{archiveLock.current=false;setArchiveBusy(false);}
  };

  const today=dateKey(new Date());
  const availableRoutes=useMemo(()=>routes.filter(route =>
    route.status==='aberta' && !route.started_at && !route.end_time && routeOperationalDateKey(route)===today),[routes,today]);
  const activeMotoboys=useMemo(()=>motoboys.filter(item=>item.active),[motoboys]);
  const routeLoads=useMemo(()=>openRouteWorkload(deliveries,availableRoutes),[deliveries,availableRoutes]);
  const availableRouteIds=useMemo(()=>availableRoutes.map(item=>item.id),[availableRoutes]);
  const activeMotoboyIds=useMemo(()=>activeMotoboys.map(item=>item.id),[activeMotoboys]);
  // R136_SITE_LAUNCH_GATE: busca e foco sao somente apresentacao; nunca alteram a projecao canonica.
  const displayed=useMemo(()=>searchSiteInboxRows(
    projection.rows.filter(row=>filter==='all'||row.state===filter),search,focusedId,
  ),[projection,filter,search,focusedId]);
  const shown=displayed.slice(0,limit);
  useEffect(()=>setLimit(OPERATION_FIRST_BATCH),[filter,search]);
  useEffect(()=>{
    if (!focusedId) { focusedOnce.current=null; return; }
    if (focusedOnce.current===focusedId) return;
    if (projection.rows.some(row=>row.delivery.id===focusedId)) {
      focusedOnce.current=focusedId;
      setSearch('');setFilter('all');setEditing(focusedId);
    }
  },[focusedId,projection.rows]);
  // Revalidacoes de horario nao disparam escritas locais repetidas para os mesmos IDs.
  const acknowledgmentKey=useMemo(()=>projection.rows.map(row=>row.delivery.id).join('\u001f'),[projection.rows]);
  useEffect(()=>{
    // Leitura nao descarta a pendencia: apenas marca o aviso local como visto.
    if (acknowledgmentKey) acknowledgeSiteOrders(projection.rows.map(row=>row.delivery.id));
  },[acknowledgmentKey]);
  const begin=(delivery:Delivery)=>{
    setEditing(current=>current===delivery.id?null:delivery.id);
    setSelection('');setNewMode(false);setRouteName('');setMotoboyId('');
    setReviewOpen(false);setSaveError('');
    setReviewAddress(delivery.address_string || '');setReviewPhone(delivery.phone || '');
    setReviewObservation(delivery.observation || '');setReviewPayment(delivery.payment_method || 'dinheiro');
  };
  const submit=async(delivery:Delivery)=>{
    if(lock.current)return;
    const issue=siteAllocationPreflight({
      row:projection.rows.find(row=>row.delivery.id===delivery.id),
      selectedRouteId:selection,existingRouteIds:availableRouteIds,
      newMode,routeName,motoboyId,activeMotoboyIds,
      address:reviewOpen?reviewAddress:(delivery.address_string || ''),
    });
    if(issue){setSaveError(issue);toast.warning(issue);return;}
    lock.current=true;setSaving(true);setSaveError('');
    try{
      const operational = reviewOpen ? {address_string:reviewAddress,phone:reviewPhone,observation:reviewObservation,payment_method:reviewPayment} : undefined;
      const routeId=await allocate(delivery.id,newMode?{newRoute:{name:routeName.trim(),motoboyId},operational}:{routeId:selection,operational});
      toast.success('Pedido vinculado à rota.',{description:'A saída para entrega só acontece ao iniciar a rota.'});
      setEditing(null);
      router.push(`/rotas/details?id=${encodeURIComponent(routeId)}&date=${encodeURIComponent(today)}`);
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível vincular o pedido.';
      setSaveError(message);
      toast.error('Não foi possível alocar.',{description:message});
    }finally{lock.current=false;setSaving(false);}
  };
  return <section className="space-y-3" aria-label="Pedidos recebidos do Site">
    {archiveId && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Confirmar arquivamento operacional">
      <div className="w-full max-w-md space-y-3 rounded-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <h3 className="text-base font-black text-zinc-100">Arquivar pedido da operação?</h3>
        <p className="text-xs leading-relaxed text-zinc-300">O pedido sairá da Caixa ativa e continuará no histórico operacional. <strong>Isso não cancela o pedido no Site, não avisa o cliente e não registra entrega.</strong> Use somente após conferir a situação comercial.</p>
        <label className="block text-xs font-bold text-zinc-200">Motivo obrigatório
          <textarea value={archiveReason} onChange={event=>setArchiveReason(event.target.value.slice(0,240))} rows={3} maxLength={240} placeholder="Descreva por que este pedido será arquivado..." className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100" disabled={archiveBusy}/>
        </label>
        <p className="text-[10px] text-zinc-500">Mínimo 8 caracteres · {archiveReason.trim().length}/240</p>
        <div className="flex gap-2">
          <button type="button" disabled={archiveBusy} onClick={()=>{setArchiveId(null);setArchiveReason('');}} className="min-h-11 flex-1 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-200">Voltar</button>
          <button type="button" disabled={archiveBusy||archiveReason.trim().length<8} onClick={()=>void confirmArchive()} className="min-h-11 flex-1 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs font-black text-amber-200 disabled:opacity-40">{archiveBusy?'Arquivando...':'Confirmar arquivamento'}</button>
        </div>
      </div>
    </div>}

  {/* R161_SITE_HISTORY: somente leitura, sem restaurar ou alterar documentos. */}
    <section aria-label="Histórico de pedidos do Site" className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2.5">
      <button type="button" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(value=>!value)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-[11px] font-bold text-zinc-200">
        <span>Histórico do Site · {history.length} registro{history.length===1?'':'s'}</span><ChevronDown size={15} className={historyOpen?'rotate-180':''}/>
      </button>
      {historyOpen&&<div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
        <p className="text-[10px] leading-relaxed text-zinc-500">Somente registros ainda presentes neste dispositivo. Uma tentativa não confirma entrega; registros excluídos fisicamente não podem ser reconstruídos aqui.</p>
        <input type="search" value={historySearch} onChange={event=>{setHistorySearch(event.target.value);setHistoryLimit(10);}} placeholder="Buscar número, cliente ou motivo" aria-label="Buscar histórico do Site" className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filtrar histórico do Site">
          {([['todos','Todos'],['cancelado','Cancelados'],['retirado_operacao','Arquivados'],['entregue','Entregues'],['tentativa','Tentativas']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={historyStatus===key} onClick={()=>{setHistoryStatus(key);setHistoryLimit(10);}} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[10px] font-bold ${historyStatus===key?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-zinc-700 text-zinc-400'}`}>{label}</button>)}
        </div>
        <p role="status" className="text-[10px] text-zinc-500">{filteredHistory.length} registro{filteredHistory.length===1?'':'s'} nesta seleção.</p>
        {filteredHistory.slice(0,historyLimit).map(item=><button type="button" key={item.id} onClick={()=>router.push(`/entregas/details?id=${encodeURIComponent(item.id)}`)} className="flex min-h-12 w-full flex-col items-start rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-left">
          <span className="text-[11px] font-bold text-zinc-100">#{item.external_order_id||item.order_id||item.id} · {siteHistoryLabel(item)}</span>
          <span className="mt-1 text-[10px] text-zinc-400">{siteHistoryDetail(item)}</span>
        </button>)}
        {filteredHistory.length>historyLimit&&<button type="button" className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300" onClick={()=>setHistoryLimit(v=>v+10)}>Ver mais registros</button>}
        {!filteredHistory.length&&<p className="p-3 text-[11px] text-zinc-500">Nenhum registro corresponde aos filtros nos dados carregados.</p>}
      </div>}
    </section>

    <div className="flex items-center gap-3 rounded-[20px] border border-emerald-500/15 bg-emerald-500/[.045] px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><Inbox size={18}/></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-black text-zinc-100">Pedidos do Site</h2>
        <p className="mt-0.5 text-[11px] text-zinc-400">Confira e escolha a rota quando o pedido estiver liberado.</p>
      </div>
      <span aria-label={`${projection.total} pedidos aguardando organização`} className="shrink-0 rounded-xl bg-zinc-950/60 px-3 py-1.5 text-lg font-black tabular-nums text-zinc-100">{projection.total}</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filtrar pedidos do Site">
      {([['all','Todos',projection.total],['pronto','Prontos',projection.ready],['confirmar','Comercial',projection.commercial],['aguardar_agenda','Agendados',projection.scheduled],['revisar','Revisar',projection.review]] as const).map(([key,label,count])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[11px] font-bold ${filter===key?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-zinc-800 bg-zinc-900/50 text-zinc-400'}`}>{label} · {count}</button>)}
    </div>
    <section aria-label="Busca dos pedidos do Site" className="space-y-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/35 p-2.5">
      <div className="flex gap-2">
        <input type="search" aria-label="Buscar pedido do Site por nome, telefone, endereco ou numero" value={search}
          onChange={event=>setSearch(event.target.value)} placeholder="Cliente, número, telefone ou endereço"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-[12px] text-zinc-100 outline-none focus:border-emerald-500/50" />
        {search&&<button type="button" className="min-h-11 rounded-xl border border-zinc-700 px-3 text-[11px] font-bold text-zinc-300" onClick={()=>setSearch('')}>Limpar</button>}
      </div>
      <p className="px-1 text-[10px] text-zinc-500" role="status">{displayed.length} pedido{displayed.length===1?'':'s'} nesta seleção. Busca local, sem nova consulta.</p>
    </section>
    {!shown.length?<div className="rounded-2xl border border-dashed border-zinc-800 p-7 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-400"/><p className="mt-2 text-xs font-bold text-zinc-300">Nenhum pedido nesta seleção</p><p className="mt-1 text-[10px] text-zinc-500">Novos pedidos entram automaticamente quando a sincronização chegar.</p></div>:null}
    {shown.map(({delivery,state,duplicate}:SiteRow)=>{
      const expanded=editing===delivery.id;
      const step=siteStep(state,duplicate);
      return <article key={delivery.id} className={`scroll-mt-28 rounded-[20px] border p-3.5 ${tones[state]}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide">{duplicate?'Possível pedido duplicado · revisar origem':captions[state]}</p><h3 className="mt-1 truncate text-sm font-black text-zinc-100">{delivery.customer_name||'Cliente do Site'}</h3><p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400">Pedido #{delivery.external_order_id||delivery.order_id||delivery.id}</p></div>
          <span className="shrink-0 text-sm font-black text-zinc-100">{amount(Number(delivery.customer_charge??delivery.value))}</span>
        </div>
        {duplicate&&<p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">Foram encontrados registros com o mesmo ID externo. Confira e concilie os pedidos antes de alocar uma rota.</p>}
        <p className="mt-2 flex items-start gap-1 text-[11px] text-zinc-400"><MapPin size={13} className="mt-0.5 shrink-0"/>{delivery.address_string||'Endereço não informado'}</p>
        {delivery.scheduled_for&&<p className="mt-1 flex items-center gap-1 text-[10px] text-sky-300"><CalendarClock size={13}/> Agendado: {delivery.scheduled_label||new Date(delivery.scheduled_for).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})}</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400" role="status"><span className="font-bold text-zinc-200">{step.title}.</span> {step.hint}</p>
        {state==='pronto'?<button type="button" onClick={()=>begin(delivery)} aria-expanded={expanded} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-200"><RouteIcon size={16}/>{expanded?'Fechar escolha de rota':'Escolher rota'}<ChevronDown size={15}/></button>:
        <button type="button" onClick={()=>router.push('/loja?site=pending')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 text-xs font-bold text-zinc-200"><ShoppingBag size={15}/>{step.action}</button>}
        {!duplicate && !delivery.route_id?.trim() && !delivery.completed && !delivery.operational_dismissed_at && <button type="button" onClick={()=>requestArchive(delivery)} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-700/70 bg-zinc-950/35 px-3 text-[11px] font-bold text-zinc-400" aria-label={`Arquivar operacionalmente pedido ${delivery.external_order_id||delivery.order_id||delivery.id}`}>
          Arquivar da operação · preservar histórico
        </button>}
        {expanded&&state==='pronto'&&<div className="mt-3 space-y-3 rounded-2xl border border-zinc-700/60 bg-zinc-950/75 p-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.045] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-300">
            <span className="font-bold text-emerald-200">Pedido conferido?</span> Escolha uma rota ainda não iniciada. A confirmação é transacional e não avisa saída ao cliente.
          </div>
          <button type="button" aria-expanded={reviewOpen} onClick={()=>setReviewOpen(v=>!v)} className="w-full rounded-xl border border-sky-500/25 bg-sky-500/[.06] px-3 py-3 text-left text-xs font-bold text-sky-200">{reviewOpen?'Fechar revisão':'Revisar pedido · endereço, contato e cobrança'}</button>
          {reviewOpen&&<div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <p className="text-[10px] leading-relaxed text-zinc-400">Dados operacionais desta entrega. Valores e status comerciais permanecem sob autoridade do Site.</p>
            <label className="text-[11px] font-bold text-zinc-300">Endereço<input value={reviewAddress} onChange={event=>setReviewAddress(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs"/></label>
            <label className="text-[11px] font-bold text-zinc-300">Telefone / WhatsApp<input value={reviewPhone} onChange={event=>setReviewPhone(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs"/></label>
            <label className="text-[11px] font-bold text-zinc-300">Observação<input value={reviewObservation} onChange={event=>setReviewObservation(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs"/></label>
            <p className="text-[11px] font-bold text-zinc-300">Cobrança operacional</p>
            <div className="grid grid-cols-3 gap-2">{([['dinheiro','Dinheiro'],['pix','Pix'],['cartao','Cartão']] as const).map(([method,label])=><button key={method} type="button" onClick={()=>setReviewPayment(method)} className={`min-h-11 rounded-xl border text-[11px] font-bold ${reviewPayment===method?'border-emerald-400/50 bg-emerald-500/10 text-emerald-200':'border-zinc-700 text-zinc-400'}`}>{label}</button>)}</div>
          </div>}
          <div className="flex gap-2"><button type="button" aria-pressed={!newMode} onClick={()=>setNewMode(false)} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${!newMode?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}>Rota existente</button><button type="button" aria-pressed={newMode} onClick={()=>setNewMode(true)} className={`min-h-10 flex-1 rounded-xl border text-[11px] font-bold ${newMode?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}><Plus size={13} className="inline"/> Nova rota</button></div>
          {!newMode?<div className="max-h-48 space-y-1.5 overflow-y-auto">{availableRoutes.length?availableRoutes.map(route=><button type="button" key={route.id} onClick={()=>setSelection(route.id)} aria-pressed={selection===route.id} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-xs ${selection===route.id?'border-emerald-400 bg-emerald-400/10 text-emerald-200':'border-zinc-800 bg-zinc-900/60 text-zinc-300'}`}><RouteIcon size={14}/><span className="min-w-0 flex-1 truncate">{route.name} · {route.motoboy_name} · {routeLoads.get(route.id)||0} pendente{(routeLoads.get(route.id)||0)===1?'':'s'}</span>{selection===route.id&&<CheckCircle2 size={14}/>}</button>):<p className="rounded-xl bg-zinc-900 p-3 text-[11px] text-zinc-400">Nenhuma rota aberta de hoje sem saída. Use Nova rota.</p>}</div>:<div className="space-y-2"><label className="block text-[11px] font-semibold text-zinc-300">Nome da rota<input value={routeName} onChange={event=>setRouteName(event.target.value)} placeholder="Ex.: Centro 2" maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-emerald-500"/></label><p className="text-[11px] font-semibold text-zinc-300">Motoboy responsável</p><div className="grid grid-cols-2 gap-1.5">{activeMotoboys.map(motoboy=><button type="button" key={motoboy.id} onClick={()=>setMotoboyId(motoboy.id)} aria-pressed={motoboyId===motoboy.id} className={`min-h-11 rounded-xl border px-2 text-[11px] font-bold ${motoboyId===motoboy.id?'border-emerald-500/40 bg-emerald-500/10':'border-zinc-800 text-zinc-400'}`}>{motoboy.name}</button>)}</div>{!activeMotoboys.length&&<p className="text-[10px] text-amber-300">Cadastre um motoboy ativo antes de criar uma rota.</p>}</div>}
          {saveError&&<p role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">{saveError}</p>}
          <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-400"><ShieldCheck size={15} className="shrink-0 text-emerald-400"/>O Firestore revalida o pedido e a rota antes de salvar. Nenhuma mensagem de saída será enviada apenas pela alocação.</p>
          <button type="button" disabled={saving||Boolean(siteAllocationPreflight({row:{state,duplicate},selectedRouteId:selection,existingRouteIds:availableRouteIds,newMode,routeName,motoboyId,activeMotoboyIds,address:reviewOpen?reviewAddress:(delivery.address_string||'')}))} onClick={()=>void submit(delivery)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-40">{saving?'Salvando...':'Confirmar vínculo à rota'}<CheckCircle2 size={15}/></button>
        </div>}
      </article>;
    })}
    {displayed.length>shown.length&&<button type="button" onClick={()=>setLimit(v=>nextProgressiveCount(displayed.length,v))} className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 text-xs font-bold text-zinc-300">Mostrar mais · {shown.length} de {displayed.length}</button>}
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/35 p-3 text-[10px] leading-relaxed text-zinc-500"><AlertCircle size={14} className="mr-1 inline"/>Acesso offline: você pode conferir pedidos já sincronizados, mas precisa de conexão para confirmar a alocação. Retiradas, balcão e cancelamentos não entram nesta fila logística.</div>
  </section>;
}
