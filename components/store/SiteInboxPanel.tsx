'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarClock, ChevronDown, CheckCircle2, Inbox, MapPin, Plus, Route as RouteIcon, ShieldCheck, ShoppingBag, X, History, Link2, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, routeOperationalDateKey } from '@/lib/operational-time';
import { siteInboxProjection, type SiteInboxState } from '@/lib/operation/siteInboxPolicy';
import { searchSiteInboxRows, openRouteWorkload, siteAllocationPreflight } from '@/lib/operation/site-inbox-triage';
import { acknowledgeSiteOrders } from '@/lib/site-order-inbox';
import { toast } from '@/lib/operational-toast';
import { OPERATION_FIRST_BATCH, nextProgressiveCount } from '@/lib/operation/progressiveWindow';
import { siteHistoryRows, siteHistoryLabel, siteHistoryDetail, siteHistoryKind, siteHistoryCompactId, siteHistoryTime } from '@/lib/operation/site-order-history-r161';
import { siteManualReviewCandidates, siteManualArchiveReason } from '@/lib/operation/site-manual-review-r280';
import { siteOrderDisplayReference } from '@/lib/operation/site-order-presentation';
import { siteReviewHints, sitePreparationReminder } from '@/lib/operation/site-review-hints';
import { SiteFutureRoutePlanner } from '@/components/store/SiteFutureRoutePlanner';
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
export function SiteInboxPanel({focusedId,openHistoryOnLoad=false}:{focusedId?:string|null;openHistoryOnLoad?:boolean}) {
  const router = useRouter();
  const deliveries = useAppStore(state=>state.deliveries);
  const routes = useAppStore(state=>state.routes);
  const motoboys = useAppStore(state=>state.motoboys);
  const sitePreparationLeadMinutes = useAppStore(state=>state.storeSettings.sitePreparationLeadMinutes || 30);
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
  // Relógio puramente visual: sem Firestore, sem WhatsApp, sem notificações de fundo.
  useEffect(()=>{
    let clockTimer: number | undefined;
    const tick=()=>{
      if(document.visibilityState==='visible')setClock(Date.now());
      clockTimer=window.setTimeout(tick,60_000);
    };
    clockTimer=window.setTimeout(tick,60_000);
    return ()=>{if(clockTimer!==undefined)window.clearTimeout(clockTimer);};
  },[]);
  const projection = useMemo(()=>siteInboxProjection(deliveries,clock),[deliveries,clock]);
  const [filter,setFilter]=useState<'all'|'pronto'|'confirmar'|'aguardar_agenda'|'revisar'>('all');
  const [search,setSearch]=useState('');
  const deferredSearch = useDeferredValue(search);
  const [historyOpen,setHistoryOpen]=useState(openHistoryOnLoad);
  // R166_HISTORY_FILTER: sem consulta extra ao Firestore.
  const [historySearch,setHistorySearch]=useState('');
  const deferredHistorySearch = useDeferredValue(historySearch);
  const [historyStatus,setHistoryStatus]=useState<'todos'|'cancelado'|'retirado_operacao'|'entregue'|'tentativa'>('todos');
  const [historyLimit,setHistoryLimit]=useState(10);
  const history=useMemo(()=>siteHistoryRows(deliveries, 200),[deliveries]);
  const historyCounts=useMemo(()=>({
    cancelado:history.filter(item=>siteHistoryKind(item)==='cancelado').length,
    retirado_operacao:history.filter(item=>siteHistoryKind(item)==='retirado_operacao').length,
    entregue:history.filter(item=>siteHistoryKind(item)==='entregue').length,
    tentativa:history.filter(item=>siteHistoryKind(item)==='tentativa').length,
  }),[history]);
  // A comparação é apenas visual. Sem arquivar automaticamente pedidos reais.
  const manualRows=useMemo(()=>deliveries.filter(item=>item.origin==='loja' && item.source_system!=='dfl_site')
    .filter(item=>{const t=Date.parse(item.created_at||item.createdAt||'');return Number.isFinite(t)&&Math.abs(clock-t)<7*86400_000;})
    .sort((a,b)=>String(b.created_at||b.createdAt||'').localeCompare(String(a.created_at||a.createdAt||''))).slice(0,36),[deliveries,clock]);
  const matchesBySite=useMemo(()=>new Map(projection.rows.map(row=>[
    row.delivery.id,siteManualReviewCandidates(row.delivery,manualRows,clock)
  ])),[projection.rows,manualRows,clock]);
  const [independentOrders,setIndependentOrders]=useState<string[]>([]);
  const [reconciliationMode,setReconciliationMode]=useState(false);
  const [manualReferenceId,setManualReferenceId]=useState('');
  const [manualReferenceConfirmed,setManualReferenceConfirmed]=useState(false);
  const filteredHistory=useMemo(()=>{
    const needle=deferredHistorySearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return history.filter(item=>{
      if(historyStatus!=='todos' && siteHistoryKind(item)!==historyStatus)return false;
      if(!needle)return true;
      return [item.customer_name,item.external_order_id,item.order_id,item.id,item.phone,item.operational_dismissal_reason]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(needle);
    });
  },[history,deferredHistorySearch,historyStatus]);
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
  const clearArchive=()=>{setArchiveId(null);setArchiveReason('');setReconciliationMode(false);setManualReferenceId('');setManualReferenceConfirmed(false);};
  const requestArchive=(delivery:Delivery,mode:'archive'|'manual'='archive')=>{
    if (archiveLock.current || delivery.source_system!=='dfl_site' || delivery.route_id?.trim() || delivery.completed || delivery.operational_dismissed_at) return;
    clearArchive();setReconciliationMode(mode==='manual');setArchiveId(delivery.id);
  };
  const confirmArchive=async()=>{
    if(!archiveId || archiveLock.current)return;
    const linked=manualRows.find(item=>item.id===manualReferenceId);
    if(reconciliationMode && (!linked || !manualReferenceConfirmed)){
      toast.warning('Escolha a entrega manual correta e confirme a comparação.');return;
    }
    if(reconciliationMode && deliveries.some(item=>item.id!==archiveId && item.source_system==='dfl_site' &&
      item.operational_dismissal_reason?.includes(`ref-manual=${manualReferenceId};`))){
      toast.warning('Esta entrega manual já foi referenciada por outro pedido do Site.');return;
    }
    const reason=reconciliationMode ? siteManualArchiveReason(manualReferenceId) : archiveReason.trim();
    if(reason.length<8){toast.warning('Informe um motivo de pelo menos 8 caracteres.');return;}
    const live=deliveries.find(item=>item.id===archiveId);
    if(!live || live.source_system!=='dfl_site' || live.route_id?.trim() || live.completed || live.operational_dismissed_at){
      toast.warning('O pedido mudou. Sincronize antes de arquivar.');setArchiveId(null);return;
    }
    archiveLock.current=true;setArchiveBusy(true);
    try{
      await archiveSiteDelivery(archiveId,reason);
      setEditing(null);clearArchive();
      toast.success('Pedido preservado no histórico.',{description:'Sem nova rota, sem cancelar no Site e sem informar entrega ao cliente.'});
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
    projection.rows.filter(row=>filter==='all'||row.state===filter),deferredSearch,focusedId,
  ),[projection,filter,deferredSearch,focusedId]);
  const shown=displayed.slice(0,limit);
  useEffect(()=>setLimit(OPERATION_FIRST_BATCH),[filter,search]);
  useEffect(()=>{
    if (!focusedId) { focusedOnce.current=null; return; }
    if (focusedOnce.current===focusedId) return;
    const focusedRow=projection.rows.find(row=>row.delivery.id===focusedId||row.delivery.external_order_id===focusedId);
    if (focusedRow) {
      focusedOnce.current=focusedId;
      setSearch('');setFilter('all');setEditing(focusedRow.delivery.id);
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
    setSelection(delivery.planned_route_id?.trim() || '');setNewMode(false);setRouteName('');setMotoboyId('');
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
    const reservedRoute = delivery.planned_route_id?.trim();
    if (reservedRoute && (newMode || selection !== reservedRoute)) {
      const message = 'Este pedido tem uma rota reservada. Use a rota reservada ou cancele primeiro o planejamento antecipado.';
      setSaveError(message); toast.warning(message); return;
    }
    lock.current=true;setSaving(true);setSaveError('');
    try{
      const operational = reviewOpen ? {address_string:reviewAddress,phone:reviewPhone,observation:reviewObservation,payment_method:reviewPayment} : undefined;
      const routeId=await allocate(delivery.id,newMode?{newRoute:{name:routeName.trim(),motoboyId},operational}:{routeId:selection,operational,...(reservedRoute?{expectedPlannedRouteId:reservedRoute}:{})});
      toast.success('Pedido vinculado à rota.',{description:'A saída para entrega só acontece ao iniciar a rota.'});
      setEditing(null);
      // R175: permanecer na Caixa para processar outros pedidos; a rota segue acessível pelo feedback.
      const remaining=siteInboxProjection(useAppStore.getState().deliveries).rows.length;
      toast.info(remaining>0?`${remaining} pedido(s) ainda na Caixa.`:'Caixa organizada.',{description:'Abra a rota quando terminar a triagem.'});
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível vincular o pedido.';
      setSaveError(message);
      toast.error('Não foi possível alocar.',{description:message});
    }finally{lock.current=false;setSaving(false);}
  };
  return <section className="space-y-3" aria-label="Pedidos recebidos do Site">
    {archiveId && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[340] flex items-center justify-center overflow-hidden bg-black/80 px-3 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-label="Confirmar arquivamento operacional">
      <div className="max-h-[calc(100dvh-24px)] w-full max-w-md space-y-3 overflow-y-auto overscroll-contain rounded-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <h3 className="text-base font-black text-zinc-100">{reconciliationMode?'Já lancei este pedido manualmente':'Arquivar pedido da operação?'}</h3>
        <p className="text-xs leading-relaxed text-zinc-300">{reconciliationMode?'Compare com a entrega manual real. Isto só arquiva a cópia do Site na operação; não mexe na rota existente, no pagamento nem no cliente.':'O pedido sairá da Caixa ativa e continuará no histórico operacional.'} <strong>Não cancela o Site, não envia mensagens e não registra entrega.</strong></p>
        {reconciliationMode?<div className="space-y-2">
          <p className="text-[11px] font-bold text-zinc-200">Escolha a entrega manual correspondente</p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-800 p-2">
            {manualRows.map(item=>{
              const match=siteManualReviewCandidates(deliveries.find(row=>row.id===archiveId)!,[item],clock)[0];
              const chosen=manualReferenceId===item.id;
              return <button key={item.id} type="button" disabled={archiveBusy} onClick={()=>{setManualReferenceId(item.id);setManualReferenceConfirmed(false);}}
                aria-pressed={chosen} className={`min-h-12 w-full rounded-xl border px-3 py-2 text-left ${chosen?'border-emerald-400/50 bg-emerald-500/10':'border-zinc-800 bg-zinc-950/70'}`}>
                <span className="block truncate text-[11px] font-bold text-zinc-100">{item.customer_name||'Lançamento manual'} · {amount(Number(item.customer_charge??item.value))}</span>
                <span className="mt-0.5 block truncate text-[10px] text-zinc-400">#{item.id.slice(-8).toUpperCase()}{match?' · Dados semelhantes':''} · {item.route_id?.trim()?'Com rota':'Sem rota'}</span>
              </button>;
            })}
            {!manualRows.length&&<p className="p-3 text-[11px] text-amber-300">Nenhum lançamento manual recente encontrado. Não é possível conciliar sem escolher um registro real.</p>}
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-3 text-[11px] leading-relaxed text-zinc-200">
            <input type="checkbox" className="mt-0.5 accent-emerald-500" checked={manualReferenceConfirmed} onChange={event=>setManualReferenceConfirmed(event.target.checked)} disabled={!manualReferenceId||archiveBusy}/>
            Conferi o pedido, o valor e o cliente. É o mesmo pedido que já lancei manualmente; não quero outra rota.
          </label>
        </div>:<label className="block text-xs font-bold text-zinc-200">Motivo obrigatório
          <textarea value={archiveReason} onChange={event=>setArchiveReason(event.target.value.slice(0,240))} rows={3} maxLength={240} placeholder="Descreva por que este pedido será arquivado..." className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100" disabled={archiveBusy}/>
          <span className="mt-1 block text-[10px] font-normal text-zinc-500">Mínimo 8 caracteres · {archiveReason.trim().length}/240</span>
        </label>}
        <div className="flex gap-2">
          <button type="button" disabled={archiveBusy} onClick={clearArchive} className="min-h-11 flex-1 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-200">Voltar</button>
          <button type="button" disabled={archiveBusy||(reconciliationMode?!(manualReferenceId&&manualReferenceConfirmed):archiveReason.trim().length<8)} onClick={()=>void confirmArchive()} className="min-h-11 flex-1 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs font-black text-amber-200 disabled:opacity-40">{archiveBusy?'Registrando...':reconciliationMode?'Preservar no histórico':'Confirmar arquivamento'}</button>
        </div>
      </div>
    </div>, document.body)}
    <div className="flex items-center gap-3 rounded-[20px] border border-emerald-500/15 bg-emerald-500/[.045] px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><Inbox size={18}/></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-black text-zinc-100">Pedidos do Site</h2>
        <p className="mt-0.5 text-[11px] text-zinc-400">Confira e escolha a rota quando o pedido estiver liberado.</p>
      </div>
      <span aria-label={`${projection.total} pedidos aguardando organização`} className="shrink-0 rounded-xl bg-zinc-950/60 px-3 py-1.5 text-lg font-black tabular-nums text-zinc-100">{projection.total}</span>
    </div>
    <SiteFutureRoutePlanner now={clock}/>
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
  {/* R281: histórico não compete com a fila ativa; IDs integrais ficam na tela de detalhes. */}
    <section aria-label="Histórico de pedidos do Site" className="rounded-[20px] border border-zinc-800 bg-zinc-900/30 p-2.5">
      <button type="button" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(value=>!value)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left">
        <History size={17} className="shrink-0 text-zinc-400"/>
        <span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Histórico do Site</strong><small className="block text-[10px] font-normal text-zinc-500">{history.length} registros · cancelamentos, arquivamentos e entregas</small></span>
        <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition-transform ${historyOpen?'rotate-180':''}`}/>
      </button>
      {historyOpen&&<div className="mt-2 space-y-2 border-t border-zinc-800 pt-3">
        <p className="px-1 text-[10px] leading-relaxed text-zinc-500">Registros disponíveis no Entregas. O histórico comercial completo continua no Admin do Site.</p>
        <input type="search" value={historySearch} onChange={event=>{setHistorySearch(event.target.value);setHistoryLimit(10);}} placeholder="Buscar número, cliente ou motivo" aria-label="Buscar histórico do Site" className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Filtrar histórico do Site">
          {([['todos','Todos'],['cancelado','Cancelados'],['retirado_operacao','Arquivados'],['entregue','Entregues'],['tentativa','Tentativas']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={historyStatus===key} onClick={()=>{setHistoryStatus(key);setHistoryLimit(10);}} className={`min-h-10 shrink-0 rounded-xl border px-3 text-[10px] font-bold ${historyStatus===key?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-zinc-800 text-zinc-400'}`}>{label} · {key==='todos'?history.length:historyCounts[key]}</button>)}
        </div>
        <p role="status" className="px-1 text-[10px] text-zinc-500">{filteredHistory.length} registro{filteredHistory.length===1?'':'s'} nesta seleção</p>
        {filteredHistory.slice(0,historyLimit).map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><p className="text-[11px] font-black text-sky-300">{siteOrderDisplayReference(item)}</p><p className="mt-0.5 text-[9px] text-zinc-600">Referência operacional · {siteHistoryCompactId(item)}</p><p className="mt-1 truncate text-[13px] font-bold text-zinc-100">{item.customer_name||'Cliente do Site'}</p></div>
            <div className="shrink-0 text-right"><p className="text-xs font-black text-zinc-100 tabular-nums">{amount(Number(item.customer_charge??item.value))}</p><p className="mt-1 text-[10px] text-zinc-500">{siteHistoryTime(item)}</p></div>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-zinc-300">{siteHistoryLabel(item)}</p>
          <details className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-2 text-[10px] text-zinc-400"><summary className="cursor-pointer font-semibold text-zinc-300">Ver ocorrência e motivo</summary><p className="mt-2 break-words leading-relaxed">{siteHistoryDetail(item)}</p></details>
          <details className="mt-2 text-[10px] text-zinc-400"><summary className="w-fit cursor-pointer font-semibold text-sky-300">Mostrar ID completo</summary><code className="mt-1 block break-all select-text font-mono text-zinc-300">{item.external_order_id||item.order_id||item.id}</code></details>
          <button type="button" onClick={()=>router.push(`/entregas/details?id=${encodeURIComponent(item.id)}`)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/50 text-[11px] font-bold text-zinc-200"><ArrowUpRight size={14}/> Ver detalhes do pedido</button>
        </article>)}
        {filteredHistory.length>historyLimit&&<button type="button" className="min-h-11 w-full rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300" onClick={()=>setHistoryLimit(v=>v+10)}>Ver mais registros</button>}
        {!filteredHistory.length&&<p className="p-3 text-[11px] text-zinc-500">Nenhum registro corresponde aos filtros.</p>}
      </div>}
    </section>
    {!shown.length?<div className="rounded-2xl border border-dashed border-zinc-800 p-7 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-400"/><p className="mt-2 text-xs font-bold text-zinc-300">Nenhum pedido nesta seleção</p><p className="mt-1 text-[10px] text-zinc-500">Novos pedidos entram automaticamente quando a sincronização chegar.</p></div>:null}
    {shown.map(({delivery,state,duplicate}:SiteRow)=>{
      const expanded=editing===delivery.id;
      const step=siteStep(state,duplicate);
      const possibleManual=matchesBySite.get(delivery.id)||[];
      const requiresManualReview=!duplicate&&possibleManual.length>0&&!independentOrders.includes(delivery.id);
      const reviewHints=siteReviewHints(delivery);
      const scheduleNotice=sitePreparationReminder(delivery,clock,sitePreparationLeadMinutes);
      return <article key={delivery.id} className={`scroll-mt-28 rounded-[20px] border p-3.5 ${tones[state]}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide">{duplicate?'Possível pedido duplicado · revisar origem':captions[state]}</p><h3 className="mt-1 truncate text-sm font-black text-zinc-100">{delivery.customer_name||'Cliente do Site'}</h3><p className="mt-0.5 text-[11px] font-semibold text-sky-300">{siteOrderDisplayReference(delivery)}</p><details className="mt-1 text-[10px] text-zinc-400"><summary className="w-fit cursor-pointer font-semibold text-sky-300">Detalhes técnicos do Site</summary><p className="mt-1">Site · #{siteHistoryCompactId(delivery)}</p></details><details className="mt-1 text-[10px] text-zinc-400"><summary className="w-fit cursor-pointer font-semibold text-sky-300">Mostrar ID completo</summary><code className="mt-1 block break-all select-text font-mono text-zinc-300">{delivery.external_order_id||delivery.order_id||delivery.id}</code></details></div>
          <span className="shrink-0 text-sm font-black text-zinc-100">{amount(Number(delivery.customer_charge??delivery.value))}</span>
        </div>
        {duplicate&&<p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">Foram encontrados registros com o mesmo ID externo. Confira e concilie os pedidos antes de alocar uma rota.</p>}
        {requiresManualReview&&<div className="mt-2 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-3">
          <p className="text-[11px] font-bold text-amber-200">Possível lançamento manual encontrado</p>
          <p className="text-[10px] leading-relaxed text-zinc-300">{possibleManual.length} registro(s) com valor e cliente/telefone semelhantes. Confirme antes de criar outra rota; isso não é uma duplicidade comprovada.</p>
          <button type="button" onClick={()=>requestArchive(delivery,'manual')} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-zinc-950/45 text-[11px] font-bold text-amber-200"><Link2 size={14}/> Já cadastrei este pedido</button>
          <button type="button" onClick={()=>setIndependentOrders(items=>items.includes(delivery.id)?items:[...items,delivery.id])} className="min-h-10 w-full rounded-xl border border-zinc-700 text-[11px] font-bold text-zinc-300">Conferi: é outro pedido · liberar rota</button>
        </div>}
        <p className="mt-2 flex items-start gap-1 text-[11px] text-zinc-400"><MapPin size={13} className="mt-0.5 shrink-0"/>{delivery.address_string||'Endereço não informado'}</p>
        {delivery.is_urgent === true && <p className="mt-1 inline-flex rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-200">Urgente · priorizado na triagem, sujeito à aprovação comercial</p>}
        {delivery.scheduled_for&&<p className="mt-1 flex items-center gap-1 text-[10px] text-sky-300"><CalendarClock size={13}/> Agendado: {delivery.scheduled_label||new Date(delivery.scheduled_for).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})}</p>}
        {scheduleNotice&&<div role="status" className="mt-2 rounded-xl border border-sky-500/25 bg-sky-500/[.065] px-3 py-2 text-[11px] font-bold text-sky-200"><CalendarClock size={13} className="mr-1 inline"/>{scheduleNotice.label}. Sem liberação automática.</div>}
        {delivery.planned_route_id?.trim() && <p role="status" className="mt-2 rounded-xl border border-sky-500/20 bg-sky-500/[.06] px-3 py-2 text-[10px] font-bold text-sky-200">Planejamento registrado: {routes.find(route=>route.id===delivery.planned_route_id)?.name||'rota indisponível'}. A reserva não despacha o pedido nem altera o preparo. Quando liberado, confirme a alocação na rota reservada.</p>}
        {reviewHints.length>0&&<details className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[.045] px-3 py-2 text-xs text-amber-200"><summary className="cursor-pointer font-bold">Conferir dados · {reviewHints.length} ponto{reviewHints.length===1?'':'s'}</summary><ul className="mt-2 space-y-1 text-[11px] font-normal leading-relaxed text-amber-100/80">{reviewHints.map(hint=><li key={hint.key}>• {hint.label}</li>)}</ul><p className="mt-2 text-[10px] text-zinc-400">Sugestão de revisão humana, não é acusação nem bloqueio automático.</p></details>}
        {Boolean(delivery.site_order_timeline?.length)&&<details className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/25 px-3 py-2"><summary className="cursor-pointer text-[10px] font-bold text-zinc-400">Histórico do status do Site · {delivery.site_order_timeline?.length} evento(s)</summary><div className="mt-2 space-y-1">{(delivery.site_order_timeline||[]).slice(-8).map(event=><p key={event.event_id} className="text-[10px] text-zinc-500">{event.status} · {(Number.isFinite(Date.parse(event.occurred_at)) ? new Date(event.occurred_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'Sem data confiável')}</p>)}</div></details>}
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400" role="status"><span className="font-bold text-zinc-200">{step.title}.</span> {step.hint}</p>
        {state==='pronto'?<button type="button" disabled={requiresManualReview} onClick={()=>begin(delivery)} aria-expanded={expanded} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-200 disabled:opacity-35"><RouteIcon size={16}/>{expanded?'Fechar escolha de rota':'Escolher rota'}<ChevronDown size={15}/></button>:
        <button type="button" onClick={()=>router.push('/loja?site=pending')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 text-xs font-bold text-zinc-200"><ShoppingBag size={15}/>{step.action}</button>}
        {!duplicate && !delivery.route_id?.trim() && !delivery.completed && !delivery.operational_dismissed_at && <details className="group mt-2 rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-2"><summary className="min-h-10 cursor-pointer px-2 py-2 text-[11px] font-semibold text-zinc-400">Outras ações · conciliar ou arquivar</summary>
        {!duplicate && !requiresManualReview && manualRows.length>0 && !delivery.route_id?.trim() && !delivery.completed && !delivery.operational_dismissed_at && <button type="button" onClick={()=>requestArchive(delivery,'manual')} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.05] px-3 text-[11px] font-bold text-amber-200"><Link2 size={14}/> Já cadastrei manualmente · conciliar</button>}
        {!duplicate && !delivery.route_id?.trim() && !delivery.completed && !delivery.operational_dismissed_at && <button type="button" onClick={()=>requestArchive(delivery)} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-700/70 bg-zinc-950/35 px-3 text-[11px] font-bold text-zinc-400" aria-label={`Arquivar operacionalmente pedido ${delivery.external_order_id||delivery.order_id||delivery.id}`}>
          Arquivar da operação · preservar histórico
        </button>}
        </details>}
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
