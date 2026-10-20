// components/store/PerformanceModals.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Bike, CalendarDays, CheckCircle2, Image as ImageIcon, ChevronLeft, ChevronRight, Clock3, CreditCard, Eye, EyeOff, Filter, MapPin, Package, QrCode, Receipt, ShoppingBag, Store, UserRound, Wallet, X } from 'lucide-react';
import type { StoreDashboardData } from '@/hooks/useStoreDashboard';
import { deliveryDate, OPERATION_TIME_ZONE, routeDate, routeStartedAt } from '@/lib/operational-time';
import type { Delivery } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { calculateMotoboyFee, getMotoboyDayData, normalizeName } from '@/lib/motoboy-analytics';
import { groupDeliveriesByStop } from '@/lib/route-stops';
import { fulfillmentLabel, getFulfillmentMode } from '@/lib/delivery-mode';
import { deriveDeliveryPaymentState, deliveryEconomicValue } from '@/lib/delivery-finance';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { firstValidTimestamp } from '@/lib/reports/time';
import { toast } from '@/lib/operational-toast';
import { summarizeRoutePerformance, routePerformanceText } from '@/lib/route-performance';
import { buildRouteEarningsCard } from '@/lib/route-earnings-card';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface Props { isLogisticsOpen:boolean;closeLogistics:()=>void;isRevenueOpen:boolean;closeRevenue:()=>void;isPrivacyMode:boolean;togglePrivacyMode:()=>void;dashboardData:StoreDashboardData; }
type PaymentFilter='all'|'pix'|'dinheiro'|'cartao';
type ReceiptFilter = 'all' | 'paid' | 'open';
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const time=(value?:string)=>value?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:OPERATION_TIME_ZONE}):'--:--';
const payment=(delivery:Delivery)=>{const state=deriveDeliveryPaymentState(delivery);if(state==='paid')return 'Pago';if(state==='pending')return delivery.payment_method==='pix'?'Pix pendente':'Pagamento pendente';return delivery.payment_method==='dinheiro'?'Cobrar em dinheiro':delivery.payment_method?.startsWith('cartao')?'Cobrar no cartão':'Cobrar na entrega';};
const elapsed=(route:{started_at?:string;departure_time?:string;start_time?:string;end_time?:string})=>{const start=firstValidTimestamp(route.started_at||route.departure_time||route.start_time);const end=firstValidTimestamp(route.end_time);if(!start||!end)return null;const minutes=Math.floor((end.getTime()-start.getTime())/60000);if(minutes<0)return null;return minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}min`:`${minutes}min`;};
const FulfillmentIcon=({delivery}:{delivery:Delivery})=>{const mode=getFulfillmentMode(delivery);const Icon=mode==='pickup'?ShoppingBag:mode==='counter'?Store:Bike;return <Icon size={18}/>;};

export function PerformanceModals(props:Props){
  useEffect(() => {
    if (!props.isLogisticsOpen && !props.isRevenueOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (props.isRevenueOpen) props.closeRevenue();
      else props.closeLogistics();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [props.isLogisticsOpen, props.isRevenueOpen, props.closeRevenue, props.closeLogistics]);
  return <>{props.isLogisticsOpen&&<Logistics {...props}/>} {props.isRevenueOpen&&<Revenue {...props}/>}</>;
}

function DateBar({data,tone}:{data:StoreDashboardData;tone:'sky'|'green'}){const color=tone==='sky'?'text-sky-400 bg-sky-500/10 border-sky-500/20':'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';return <div className="flex items-center gap-2"><button type="button" aria-label="Dia anterior" onClick={data.goToPreviousDay} className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ChevronLeft size={18}/></button><div className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border text-xs font-black ${color}`}><CalendarDays size={15}/>{data.formattedDateLabel}</div><button type="button" aria-label="Próximo dia" onClick={data.goToNextDay} className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><ChevronRight size={18}/></button></div>;}
function Header({title,subtitle,icon:Icon,onClose,tone}:{title:string;subtitle:string;icon:typeof Bike;onClose:()=>void;tone:'sky'|'green'}){return <header className="flex items-center gap-3"><button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95" aria-label="Voltar para Loja"><ChevronLeft size={20}/></button><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone==='sky'?'bg-sky-500/10 text-sky-400':'bg-emerald-500/10 text-emerald-400'}`}><Icon size={20}/></div><div className="min-w-0 flex-1"><h2 className="truncate font-heading text-xl font-black">{title}</h2><p className="truncate text-xs text-zinc-500">{subtitle}</p></div><button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 active:scale-95" aria-label="Fechar"><X size={18}/></button></header>;}

function Logistics(props:Props){
  const router=useRouter();const data=props.dashboardData;const [motoboy,setMotoboy]=useState('all');
  const team = useAppStore(state => state.motoboys);
  const [sharingRoute,setSharingRoute]=useState<string|null>(null);
  const shareLock=useRef(false);
  const [expandedSettlement,setExpandedSettlement]=useState<string|null>(null);
  const names=useMemo(()=>Array.from(new Set(data.selectedDateRoutes.map(route=>route.motoboy_name))).sort((a,b)=>a.localeCompare(b,'pt-BR')),[data.selectedDateRoutes]);
  const routes=useMemo(()=>data.selectedDateRoutes.filter(route=>motoboy==='all'||route.motoboy_name===motoboy).sort((a,b)=>new Date(routeDate(a)||0).getTime()-new Date(routeDate(b)||0).getTime()),[data.selectedDateRoutes,motoboy]);
  const deliveriesByRoute=useMemo(()=>{
    const index=new Map<string,Delivery[]>();
    data.selectedDateDeliveries.forEach(delivery=>{
      const bucket=index.get(delivery.route_id);
      if(bucket) bucket.push(delivery);
      else index.set(delivery.route_id,[delivery]);
    });
    return index;
  },[data.selectedDateDeliveries]);
  // Agrupa por parada uma única vez por versão do dia. Reaproveita no card, texto e imagem.
  const routeReports=useMemo(()=>{
    const byPerson=new Map(team.map(person=>[person.id,person]));
    return new Map(routes.map(route=>{
      const member=byPerson.get(route.motoboy_id||'') || team.find(person=>normalizeName(person.name)===normalizeName(route.motoboy_name));
      return [route.id,summarizeRoutePerformance(route,deliveriesByRoute.get(route.id)||[],member)] as const;
    }));
  },[routes,deliveriesByRoute,team]);
  const deliveryCount=useMemo(()=>routes.reduce((sum,route)=>sum+(routeReports.get(route.id)?.orders||0),0),[routes,routeReports]);
  // A regra de remuneração é apurada UMA vez por entregador no dia.
  // Não somar bases fixas/híbridas por rota: isso duplicaria a diária.
  const daySummaries=useMemo(()=>team.filter(member=>
    data.selectedDateRoutes.some(route=>
      route.motoboy_id ? route.motoboy_id===member.id : normalizeName(route.motoboy_name)===normalizeName(member.name)
    ) && (motoboy==='all'||normalizeName(motoboy)===normalizeName(member.name))
  ).map(member=>{
    const day=getMotoboyDayData(member,data.selectedDateKey,data.selectedDateRoutes,data.selectedDateDeliveries);
    return {member,day};
  }),[team,data.selectedDateRoutes,data.selectedDateDeliveries,data.selectedDateKey,motoboy]);
  const configuredDayTotal=daySummaries.filter(item=>item.member.payment_rule).reduce((sum,item)=>sum+item.day.fee.amount,0);
  const incompleteDayRules=daySummaries.filter(item=>!item.member.payment_rule).length;

  const exportRouteImage=async(routeId:string)=>{
    if(shareLock.current)return;
    if(props.isPrivacyMode){toast.warning('Desative o modo privacidade para exportar valores.');return;}
    const report=routeReports.get(routeId);
    if(!report){toast.error('Resumo não encontrado.');return;}
    shareLock.current=true;setSharingRoute(routeId);
    try {
      const png=await buildRouteEarningsCard(report);
      const filename=`resumo-rota-${routeId.replace(/[^a-z0-9_-]/gi,'-').slice(0,35)}-${data.selectedDateKey}.png`;
      if(Capacitor.isNativePlatform()){
        const saved=await Filesystem.writeFile({path:`dfl-resumos/${filename}`,data:png.split(',')[1],directory:Directory.Cache,recursive:true});
        await Share.share({title:`${report.routeName} · ${report.motoboyName}`,text:routePerformanceText(report),files:[saved.uri],dialogTitle:'Compartilhar resumo do motoboy'});
        toast.info('Imagem preparada. Confirme o envio no aplicativo escolhido.');
      } else {
        const link=document.createElement('a');link.href=png;link.download=filename;document.body.appendChild(link);link.click();link.remove();
        toast.success('Imagem salva. Compartilhe com o motoboy.');
      }
    } catch(error){
      const detail=error instanceof Error?error.message:String(error);
      if(/cancel|canceled|cancelled|dismiss/i.test(detail))toast.info('Compartilhamento cancelado. Nenhuma mensagem foi enviada.');
      else toast.error('Não foi possível gerar ou compartilhar a imagem.');
    } finally {shareLock.current=false;setSharingRoute(null);}
  };
  return <div className="fixed inset-0 z-[110] overflow-y-auto bg-zinc-950"><div className="sticky top-0 z-10 space-y-4 border-b border-zinc-800 bg-zinc-950/95 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl"><Header title="Resumo de rotas" subtitle="O caminho da operação neste dia" icon={Bike} onClose={props.closeLogistics} tone="sky"/><DateBar data={data} tone="sky"/></div><main className="space-y-5 p-4 pb-32">
    <div className="grid grid-cols-3 gap-2"><Stat value={routes.length} label="Rotas"/><Stat value={deliveryCount} label="Entregas"/><Stat value={routes.filter(route=>route.status==='fechada').length} label="Finalizadas" tone="green"/></div>
    <section className="rounded-[22px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.09] to-zinc-900/70 p-3.5" aria-label="Prévia do acerto diário dos motoboys">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Acerto diário · prévia</p><p className="mt-1 text-xl font-black text-zinc-100">{props.isPrivacyMode?'R$ •••':money(configuredDayTotal)}</p></div><div className="text-right text-[10px] font-semibold text-zinc-400">{daySummaries.length} motoboy(s)<p className="mt-1 text-emerald-300">Base calculada uma vez por pessoa</p></div></div>
      <p className="mt-2 text-[11px] text-zinc-400">Projeção bruta pelas paradas concluídas; não é pagamento liquidado. Vales, adiantamentos, caixa recebido e saldos anteriores são conferidos no acerto definitivo.</p>
      {incompleteDayRules>0&&<p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-bold text-amber-300">{incompleteDayRules} motoboy(s) sem regra configurada: valores fora do total.</p>}
      <div className="mt-3 space-y-2">{daySummaries.map(({member,day})=><div key={member.id} className="rounded-xl border border-zinc-800 bg-zinc-950/55">
        <button type="button" aria-expanded={expandedSettlement===member.id} onClick={()=>setExpandedSettlement(v=>v===member.id?null:member.id)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"><UserRound size={15} className="text-emerald-400"/><span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-100">{member.name}</span><span className="text-[11px] text-zinc-500">{day.physicalDeliveryCount} paradas</span><span className="min-w-[76px] text-right text-xs font-black text-emerald-300">{!member.payment_rule?'Sem regra':props.isPrivacyMode?'R$ •••':money(day.fee.amount)}</span><ChevronRight size={14} className={`text-zinc-500 transition-transform ${expandedSettlement===member.id?'rotate-90':''}`}/></button>
        {expandedSettlement===member.id&&<div className="space-y-2 border-t border-zinc-800 px-3 py-3 text-[11px] text-zinc-400"><p>{day.routes.length} rota(s) · {day.orderCount} pedido(s) · {day.physicalDeliveryCount} parada(s) física(s)</p><p>{member.payment_rule?day.fee.description:'Configure a regra de remuneração da pessoa na equipe.'}</p>{day.routeBreakdown.map(item=><div key={item.routeId} className="flex justify-between gap-2"><span className="truncate">{item.label}</span><span className="shrink-0">{item.physicalDeliveryCount} paradas · {item.orderCount} pedidos</span></div>)}<p className="font-semibold text-emerald-300">Diária fixa ou base híbrida incluída uma única vez neste total.</p></div>}
      </div>)}</div>
    </section>
    {names.length>1&&<div className="flex flex-wrap gap-2">{['all',...names].map(name=><button key={name} onClick={()=>setMotoboy(name)} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold ${motoboy===name?'bg-zinc-100 text-zinc-950':'border border-zinc-800 bg-zinc-900 text-zinc-400'}`}><UserRound size={12} className="mr-1 inline"/>{name==='all'?'Equipe toda':name}</button>)}</div>}
    <div className="space-y-3">{routes.map((route,index)=>{
      const report=routeReports.get(route.id)!;
      const completed=report.completedOrders;
      const stops=report.stops;
      const completedStops=report.completedStops;
      const fee=report.fee;
      const routeDuration=report.durationMinutes===null?null:report.durationLabel;
      const summary=routePerformanceText(report);
      return <article key={route.id} className="rounded-[22px] border border-zinc-800 bg-zinc-900/50 p-3.5">
        <button type="button" onClick={()=>router.push(`/rotas/details?id=${route.id}&date=${encodeURIComponent(data.selectedDateKey)}`)} className="flex w-full items-center gap-3 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sm font-black text-sky-300">{index+1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-heading text-sm font-black text-zinc-100">{route.name} · {route.motoboy_name}</span><span className="mt-1 block text-[11px] text-zinc-400">{completed}/{report.orders} pedidos · {completedStops}/{stops} paradas concluídas</span></span>
          <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${route.status==='fechada'?'bg-emerald-500/10 text-emerald-300':routeStartedAt(route)?'bg-sky-500/10 text-sky-300':'bg-zinc-800 text-zinc-300'}`}>{route.status==='fechada'?'Finalizada':routeStartedAt(route)?'Na rua':'Montando'}</span>
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3">
          <div className="rounded-xl bg-zinc-950/45 px-3 py-2"><p className="text-[9px] font-bold uppercase text-zinc-500">Duração da rota</p><p className="mt-1 text-sm font-black text-zinc-100">{routeDuration|| (routeStartedAt(route)?'Em andamento':'Não iniciada')}</p></div>
          <div className="rounded-xl bg-emerald-500/[.06] px-3 py-2"><p className="text-[9px] font-bold uppercase text-emerald-400">{fee===null?'Acerto por dia':'Ganho variável da rota'}</p><p className="mt-1 text-sm font-black text-emerald-300">{fee===null?'Ver acerto diário':props.isPrivacyMode?'R$ •••':money(fee)}</p></div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" onClick={()=>router.push(`/rotas/details?id=${route.id}&date=${encodeURIComponent(data.selectedDateKey)}`)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950/55 px-2 text-[11px] font-bold text-zinc-200">Ver rota</button>
          <button type="button" onClick={async()=>{if(props.isPrivacyMode){toast.warning('Desative o modo privacidade para copiar valores.');return;}try{await navigator.clipboard.writeText(summary);toast.success('Resumo da rota copiado.')}catch{toast.error('Não foi possível copiar o resumo.')}}} className="min-h-11 rounded-xl border border-emerald-500/20 bg-emerald-500/[.08] px-2 text-[11px] font-bold text-emerald-300">Copiar resumo</button>
          <button type="button" disabled={sharingRoute!==null} onClick={()=>void exportRouteImage(route.id)} aria-label={`Compartilhar imagem da ${route.name}`} className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-sky-500/25 bg-sky-500/[.08] px-1 text-[11px] font-bold text-sky-300 disabled:opacity-50"><ImageIcon size={14}/>{sharingRoute===route.id?'Preparando':'Imagem'}</button>
        </div>
      </article>;
    })}{!routes.length&&<Empty icon={Bike} text="Nenhuma rota nesta data."/>}</div>
  </main></div>;
}

function Revenue(props:Props){
  const router=useRouter();const data=props.dashboardData;const [filter,setFilter]=useState<PaymentFilter>('all');
  const [receiptFilter,setReceiptFilter]=useState<ReceiptFilter>('all');
  const [search,setSearch]=useState('');
  const [visibleLimit,setVisibleLimit]=useState(40);
  useEffect(()=>setVisibleLimit(40),[filter,receiptFilter,search,data.selectedDateKey]);
  const rows=useMemo(()=>{
    const q=search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return data.selectedDateOrders.filter(item=>{
      if(isCancelledSiteDelivery(item))return false;
      if(filter!=='all'&&(filter==='cartao'?!item.payment_method?.startsWith('cartao'):item.payment_method!==filter))return false;
      const paid=deriveDeliveryPaymentState(item)==='paid';
      if(receiptFilter==='paid'&&!paid)return false;
      if(receiptFilter==='open'&&paid)return false;
      if(!q)return true;
      const text=[item.customer_name,item.order_id,item.address_string].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      return q.split(/\s+/).every(token=>text.includes(token));
    }).sort((a,b)=>new Date(deliveryDate(b)||0).getTime()-new Date(deliveryDate(a)||0).getTime());
  },[data.selectedDateOrders,filter,receiptFilter,search]);
  const filteredTotals=useMemo(()=>rows.reduce((totals,item)=>{
    const value=deliveryEconomicValue(item);
    totals.total+=value;
    if(deriveDeliveryPaymentState(item)==='paid')totals.confirmed+=value;
    else totals.open+=value;
    return totals;
  },{total:0,confirmed:0,open:0}),[rows]);
  // Não renderizar centenas de lançamentos fora da tela; os filtros mantêm o total correto.
  const visibleRows=rows.slice(0,visibleLimit);
  const dayRows = useMemo(() => data.selectedDateOrders.filter(item => !isCancelledSiteDelivery(item)), [data.selectedDateOrders]);
  const methodTotals = useMemo(() => dayRows.reduce((acc, item) => {
    const method = item.payment_method?.startsWith('cartao') ? 'cartao' : item.payment_method;
    if (method === 'pix' || method === 'dinheiro' || method === 'cartao') acc[method] += deliveryEconomicValue(item);
    return acc;
  }, { pix: 0, dinheiro: 0, cartao: 0 }), [dayRows]);
  const hidden=(value:number)=>props.isPrivacyMode?'••••':money(value);
  const methods=[{key:'pix' as const,label:'Pix',icon:QrCode,value:methodTotals.pix},{key:'dinheiro' as const,label:'Dinheiro',icon:Banknote,value:methodTotals.dinheiro},{key:'cartao' as const,label:'Cartão',icon:CreditCard,value:methodTotals.cartao}];
  return <div className="fixed inset-0 z-[110] overflow-y-auto bg-zinc-950"><div className="sticky top-0 z-10 space-y-4 border-b border-zinc-800 bg-zinc-950/95 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl"><Header title="Extrato do dia" subtitle="Valores dos pedidos registrados" icon={Wallet} onClose={props.closeRevenue} tone="green"/><DateBar data={data} tone="green"/></div><main className="space-y-5 p-4 pb-32">
    <section className="relative overflow-hidden rounded-[28px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.12] to-zinc-900 p-5"><button type="button" onClick={props.togglePrivacyMode} aria-label={props.isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'} className="absolute right-4 top-4 text-emerald-400">{props.isPrivacyMode?<EyeOff size={19}/>:<Eye size={19}/>}</button><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Valor dos pedidos registrados</p><p className="mt-2 font-heading text-3xl font-black text-emerald-300">{hidden(data.faturamentoTotal)}</p><div className="mt-5 grid grid-cols-3 gap-2"><Small value={hidden(data.receivedTotal)} label="Confirmado"/><Small value={hidden(data.pendingTotal)} label="A receber"/><Small value={hidden(data.ticketMedio)} label="Ticket médio"/></div></section>
    <p className="px-1 text-[11px] leading-relaxed text-zinc-500">Formas de pagamento previstas nos pedidos. Valores aqui não significam confirmação de recebimento.</p>
    <div className="grid grid-cols-3 gap-2">{methods.map(({key,label,icon:Icon,value})=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(current=>current===key?'all':key)} className={`rounded-2xl border p-3 text-center ${filter===key?'border-emerald-500 bg-emerald-500/10':'border-zinc-800 bg-zinc-900/50'}`}><Icon size={18} className="mx-auto text-zinc-400"/><p className="mt-2 text-[10px] font-bold text-zinc-500">{label}</p><p className="mt-1 truncate text-xs font-black">{hidden(value)}</p></button>)}</div>
    <section>
      <div className="mb-3 grid grid-cols-3 gap-2" aria-label="Filtrar por confirmação de pagamento">
        {([{id:'all',label:'Todos'},{id:'paid',label:'Confirmados'},{id:'open',label:'A receber'}] as const).map(item=><button type="button" key={item.id} aria-pressed={receiptFilter===item.id} onClick={()=>setReceiptFilter(item.id)} className={`min-h-10 rounded-xl border px-2 text-[11px] font-bold ${receiptFilter===item.id?'border-emerald-500/45 bg-emerald-500/10 text-emerald-300':'border-zinc-800 bg-zinc-900/40 text-zinc-400'}`}>{item.label}</button>)}
      </div>
      <input type="search" aria-label="Buscar lançamento por cliente, pedido ou endereço" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, pedido ou endereço" className="mb-4 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"/>
      <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3" aria-live="polite"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-black text-zinc-300">Resultado dos filtros · {rows.length} pedido{rows.length===1?'':'s'}</p><span className="text-sm font-black text-zinc-100">{hidden(filteredTotals.total)}</span></div><div className="mt-2 flex justify-between gap-2 text-[10px]"><span className="text-emerald-400">Confirmados: {hidden(filteredTotals.confirmed)}</span><span className="text-amber-300">A receber: {hidden(filteredTotals.open)}</span></div></div>
      <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-400"><Receipt size={15}/>Lançamentos</p><span className="text-xs text-zinc-600">{Math.min(visibleLimit,rows.length)} de {rows.length}</span></div><div className="space-y-2">{visibleRows.map(item=><button key={item.id} onClick={()=>router.push(`/entregas/details?id=${item.id}&date=${encodeURIComponent(data.selectedDateKey)}`)} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3 text-left"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getFulfillmentMode(item)==='pickup'?'bg-violet-500/10 text-violet-400':getFulfillmentMode(item)==='counter'?'bg-amber-500/10 text-amber-400':item.origin==='loja'?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}`}><FulfillmentIcon delivery={item}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{item.customer_name||`Pedido #${item.order_id||'sem número'}`}</p><span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[8px] font-black uppercase text-zinc-400">{fulfillmentLabel(item)}</span></div><p className="mt-1 truncate text-[11px] text-zinc-500"><Clock3 size={10} className="mr-1 inline"/>{time(deliveryDate(item))} • {payment(item)}</p>{item.address_string&&<p className="mt-1 truncate text-[10px] text-zinc-600"><MapPin size={9} className="mr-1 inline"/>{item.address_string}</p>}</div><div className="text-right"><p className={`text-sm font-black ${deriveDeliveryPaymentState(item)==='paid'?'text-emerald-400':'text-amber-300'}`}>{hidden(deliveryEconomicValue(item))}</p><span className={`mt-1 inline-flex items-center gap-1 text-[9px] font-bold ${deriveDeliveryPaymentState(item)==='paid'?'text-emerald-400':'text-amber-300'}`}>{deriveDeliveryPaymentState(item)==='paid'?<CheckCircle2 size={12}/>:<Clock3 size={12}/>} {deriveDeliveryPaymentState(item)==='paid'?'Recebido':'Pendente'}</span></div></button>)}{!rows.length&&<Empty icon={Receipt} text="Nenhum lançamento neste filtro."/>}</div>
      {rows.length>visibleLimit&&<button type="button" onClick={()=>setVisibleLimit(current=>current+40)} className="mt-3 min-h-11 w-full rounded-xl border border-emerald-500/25 bg-emerald-500/[.07] text-xs font-black text-emerald-300">Mostrar mais lançamentos · {rows.length-visibleLimit} restantes</button>}
    </section>
  </main></div>;
}

function Stat({value,label,tone}:{value:number;label:string;tone?:'green'}){return <div className={`rounded-2xl border p-3 ${tone==='green'?'border-emerald-500/20 bg-emerald-500/[.06]':'border-zinc-800 bg-zinc-900/50'}`}><p className="text-xl font-black">{value}</p><p className="text-[10px] text-zinc-500">{label}</p></div>;}
function Small({value,label}:{value:string;label:string}){return <div><p className="truncate text-xs font-black">{value}</p><p className="mt-1 text-[9px] uppercase text-zinc-500">{label}</p></div>;}
function Empty({icon:Icon,text}:{icon:typeof Receipt;text:string}){return <div className="rounded-3xl border border-dashed border-zinc-800 py-14 text-center"><Icon className="mx-auto text-zinc-700"/><p className="mt-3 text-sm text-zinc-500">{text}</p></div>;}
