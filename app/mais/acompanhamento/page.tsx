'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { AlertTriangle, ArrowLeft, BookOpenCheck, ChevronDown, ClipboardCheck, Copy, Link2, LockKeyhole, RefreshCw, Share2, Search, ShieldCheck, SlidersHorizontal, XCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { toast } from '@/lib/operational-toast';
import { OwnerTrackingCard } from '@/components/tracking/OwnerTrackingCard';
import { OwnerTrackingInspection } from '@/components/tracking/OwnerTrackingInspection';
import type { TrackingInspection } from '@/lib/tracking/gate1/readiness';
import type { Gate2Certificate } from '@/lib/tracking/gate2/certification';
import { TrackingGate2Certificate } from '@/components/tracking/TrackingGate2Certificate';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { OperationalDatePicker } from '@/components/home/OperationalDatePicker';
import { trackingTodayKey, trackingShiftKey, trackingDeliveryDayKey, matchingTrackingDate, type TrackingDateScope } from '@/lib/tracking/gate1/tracking-date-filter';
import { maskedMessagePhone, siteOrderDisplayReference, shortTechnicalReference } from '@/lib/operation/site-order-presentation';

const ORIGIN = 'https://dfl-entregas.vercel.app';
const baseUrl=()=>Capacitor.isNativePlatform()?(process.env.NEXT_PUBLIC_DFL_SERVER_ORIGIN?.trim()||ORIGIN).replace(/\/+$/,''):'';
const BASE = '/api/integration/tracking/v1';
// Pinned public host; never accept operator-supplied URLs or forwarded host headers.
const CUSTOMER_TRACKING_ORIGIN = 'https://dafamilialanches.com.br';
type Filter = 'todas'|'site'|'manual'|'ifood'|'food99';
type ProtectedAction = 'issue'|'share'|'revoke'|'confirm'|'sync';
const confirmCopy: Record<ProtectedAction, {title:string;description:string;confirmLabel:string;tone:'safe'|'caution'|'danger'}> = {
  issue:{title:'Emitir link privado',description:'Gerar um acesso de uso único, válido por até 90 minutos. Confira o pedido e envie somente ao cliente correto. Esta ação NÃO dispara WhatsApp.',confirmLabel:'Emitir link',tone:'caution'},
  share:{title:'Compartilhar acompanhamento',description:'O link será entregue pelo compartilhamento do aparelho. Confira o número e o destinatário antes de enviar. Nenhum envio é automático.',confirmLabel:'Escolher destinatário',tone:'caution'},
  revoke:{title:'Revogar acesso',description:'O link emitido e a sessão ativa do cliente serão invalidados. Esta ação não pode ser desfeita.',confirmLabel:'Revogar link',tone:'danger'},
  confirm:{title:'Confirmar aceite operacional',description:'Registrar o aceite deste pedido no servidor. Não cria link nem envia WhatsApp. Confira a identidade e a origem antes de prosseguir.',confirmLabel:'Confirmar aceite',tone:'caution'},
  sync:{title:'Reconferir eventos',description:'Reconciliar eventos persistidos do pedido no servidor. Não gera link nem envia WhatsApp.',confirmLabel:'Reconferir eventos',tone:'safe'},
};
const norm=(value:unknown)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const filterVisual:Record<Filter,string>={
  todas:'border-zinc-500/50 bg-zinc-800/80 text-zinc-100',
  site:'border-sky-500/45 bg-sky-500/10 text-sky-300',
  manual:'border-emerald-500/45 bg-emerald-500/10 text-emerald-300',
  ifood:'border-red-500/45 bg-red-500/10 text-red-300',
  food99:'border-amber-500/45 bg-amber-500/10 text-amber-300',
};
const deliveryOrigin=(d:{source_system?:string;origin?:string})=>d.source_system==='dfl_site'||d.origin==='site'?'site':d.origin==='ifood'?'ifood':d.origin==='food99'?'food99':'manual';
function ControlPanel(){
  const router=useRouter();
  const params=useSearchParams();
  const user=useAppStore(s=>s.user);
  const deliveries=useAppStore(s=>s.deliveries);
  const [filter,setFilter]=useState<Filter>('todas');
  const [dayScope,setDayScope]=useState<TrackingDateScope>('day');
  const [selectedDay,setSelectedDay]=useState(()=>trackingTodayKey());
  const [pendingAction,setPendingAction]=useState<ProtectedAction|null>(null);
  const [query,setQuery]=useState('');
  const initialId=params.get('id')||'';
  const [selectedId,setSelectedId]=useState(initialId);
  const [inspection,setInspection]=useState<TrackingInspection|null>(null);
  const [certificate,setCertificate]=useState<Gate2Certificate|null>(null);
  const [certifying,setCertifying]=useState(false);
  const [loading,setLoading]=useState(false);
  const [working,setWorking]=useState(false);
  const [failure,setFailure]=useState('');
  const errorAreaRef=useRef<HTMLDivElement>(null);
  const actionAreaRef=useRef<HTMLElement>(null);
  const [actionError,setActionError]=useState('');
  const [listOpen,setListOpen]=useState(!initialId);
  // Secret is kept only in transient React memory until the owner copies it.
  // NEVER persist in local/session storage, logs, history or render its value.
  const [issuedLink,setIssuedLink]=useState<{url:string;grantId:string;deliveryId:string;expiresAt:string}|null>(null);
  const [lastGrant,setLastGrant]=useState<{grantId:string;deliveryId:string}|null>(null);
  useEffect(()=>{
    const onHidden=()=>{if(document.visibilityState!=='visible')setIssuedLink(null);};
    document.addEventListener('visibilitychange',onHidden);
    return()=>document.removeEventListener('visibilitychange',onHidden);
  },[]);
  useEffect(()=>{
    if(!failure)return;
    toast.error(failure);
    if(Capacitor.isNativePlatform())void Haptics.notification({type:NotificationType.Error}).catch(()=>{});
    const handle=window.setTimeout(()=>errorAreaRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}),80);
    return()=>window.clearTimeout(handle);
  },[failure]);
  useEffect(()=>{
    if(!actionError)return;
    toast.error(actionError);
    if(Capacitor.isNativePlatform())void Haptics.notification({type:NotificationType.Error}).catch(()=>{});
    const handle=window.setTimeout(()=>actionAreaRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}),80);
    return()=>window.clearTimeout(handle);
  },[actionError]);
  const lastRequest=useRef(0);
  const lastCertificateRequest=useRef(0);
  const allowed=Boolean(isSuperadminUid(user?.uid));
  const datesWithOperation=useMemo(()=>new Set(deliveries.map(trackingDeliveryDayKey).filter(Boolean)),[deliveries]);
  const listed=useMemo(()=>{
    const needle=norm(query.trim());
    return deliveries.filter(d=>{
      if(!matchingTrackingDate(d,dayScope,selectedDay))return false;
      if(filter!=='todas'){
        const o=deliveryOrigin(d);
        if(o!==filter)return false;
      }
      return !needle||norm([d.order_id,d.external_order_id,d.id,d.customer_name].join(' ')).includes(needle);
    }).sort((a,b)=>Date.parse(b.created_at||b.createdAt||'')-Date.parse(a.created_at||a.createdAt||'')).slice(0,80);
  },[deliveries,filter,query,dayScope,selectedDay]);
  const selected=deliveries.find(d=>d.id===selectedId);
  const api=useCallback(async(path:string,body?:Record<string,unknown>)=>{
    const active=auth.currentUser;
    if(!active||!isSuperadminUid(active.uid))throw new Error('Acesso restrito ao proprietário.');
    const token=await active.getIdToken();
    const url=baseUrl()+BASE+path;
    const response=await fetch(url,{
      method:body?'POST':'GET',
      headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',
    });
    if(auth.currentUser?.uid!==active.uid)throw new Error('A conta mudou durante a consulta.');
    if(!response.ok){
      if(path==='/issue'){
        if(response.status===403)throw new Error('Acesso por link não habilitado: verifique as flags de acompanhamento, o modo manual e a chave de emissão no diagnóstico abaixo.');
        if(response.status===404)throw new Error('O pedido não atende às exigências do servidor (origem, aceite ou estado). Confira os bloqueios e reconfira o pedido.');
        if(response.status===409)throw new Error('Este pedido já possui uma emissão ativa ou processada. Revogue o acesso anterior antes de solicitar outro.');
        if(response.status===422)throw new Error('Dados de emissão rejeitados pelo servidor. Revise a identidade do pedido.');
        throw new Error(`Servidor de acompanhamento indisponível (HTTP ${response.status}). Não repita a emissão sem conferir o diagnóstico.`);
      }
      if(response.status===404)return {missing:true} as const;
      if(response.status===403)return {off:true} as const;
      throw new Error(`Consulta protegida indisponível (HTTP ${response.status}).`);
    }
    return response.json() as Promise<{ok?:boolean;inspection?:TrackingInspection;certificate?:Gate2Certificate;result?:string;
      opaque_token?:string;grant_id?:string;expires_at?:string;status?:string;revoked?:boolean}>;
  },[]);
  const inspect=useCallback(async(id:string)=>{
    if(!allowed || !id)return;
    const request=++lastRequest.current;
    lastCertificateRequest.current++;setCertifying(false);setLoading(true);setFailure('');setInspection(null);setCertificate(null);
    try{
      const result=await api(`/admin/inspect?delivery_id=${encodeURIComponent(id)}`);
      if(request!==lastRequest.current)return;
      if('inspection' in result && result.inspection){setInspection(result.inspection);}
      else if('off' in result)setFailure('Acesso administrativo indisponível. Verifique autenticação e permissões.');
      else setFailure('Nenhum diagnóstico autorizado. O ambiente pode estar sem tenant de acompanhamento configurado.');
    }catch(e){if(request===lastRequest.current)setFailure(e instanceof Error?e.message:'Não foi possível conferir o pedido.');}
    finally{if(request===lastRequest.current)setLoading(false);}
  },[allowed,api]);
  useEffect(()=>{if(initialId&&allowed&&selectedId===initialId)void inspect(initialId);},[initialId,allowed,inspect,selectedId]);
  const choose=(id:string)=>{setSelectedId(id);setListOpen(false);setInspection(null);setCertificate(null);setFailure('');
    setIssuedLink(null);setLastGrant(null);setPendingAction(null);void inspect(id);};
  const certify=async()=>{
    if(!allowed||!selectedId||!inspection||certifying)return;
    const certificateRequest=++lastCertificateRequest.current;
    setCertifying(true);setCertificate(null);
    try{
      const result=await api(`/admin/certify?delivery_id=${encodeURIComponent(selectedId)}`);
      if(certificateRequest!==lastCertificateRequest.current)return;
      if('certificate' in result && result.certificate)setCertificate(result.certificate);
      else toast.error('Certificação indisponível. Revise a autenticação e a origem.');
    }catch(e){if(certificateRequest===lastCertificateRequest.current)toast.error(e instanceof Error?e.message:'Não foi possível certificar o pedido.');}
    finally{if(certificateRequest===lastCertificateRequest.current)setCertifying(false);}
  };
  const copy=(text:string)=>{void navigator.clipboard.writeText(text).then(()=>toast.success('Prévia copiada, sem dados privados.')).catch(()=>toast.error('Cópia não disponível neste aparelho.'));};
  const canIssueLink=Boolean(inspection && ['site','manual'].includes(inspection.delivery.origin) &&
    inspection.delivery.state!=='delivered' && inspection.delivery.state!=='cancelled' &&
    inspection.gate.code_enabled && inspection.gate.customer_access_certified && !inspection.gate.kill_switch &&
    inspection.gate.public_tracking && inspection.gate.origin_eligible && inspection.gate.issue_tracking_link === true &&
    ['MANUAL','AUTOMATIC_CERTIFIED'].includes(inspection.gate.mode) &&
    !inspection.readiness.signals.some(s=>s.severity==='blocker'));
  const issueBlockReasons=useMemo(()=>{
    if(!inspection)return [] as string[];
    const reasons:string[]=[];
    if(!['site','manual'].includes(inspection.delivery.origin))reasons.push('Origem não permitida para link nesta fase.');
    if(['delivered','cancelled'].includes(inspection.delivery.state))reasons.push('Pedido concluído ou cancelado: não é possível criar um link novo.');
    if(!inspection.gate.code_enabled)reasons.push('Código de acompanhamento desativado no servidor.');
    if(!inspection.gate.customer_access_certified)reasons.push('Acesso público a links desativado no servidor; o piloto WhatsApp é independente.');
    if(inspection.gate.kill_switch)reasons.push('Bloqueio geral de acompanhamento ativo.');
    if(!['MANUAL','AUTOMATIC_CERTIFIED'].includes(inspection.gate.mode))reasons.push('Modo de emissão manual não habilitado para esta empresa.');
    if(!inspection.gate.public_tracking)reasons.push('Visão pública do pedido desativada.');
    if(!inspection.gate.issue_tracking_link)reasons.push('Permissão de emitir link privado está OFF.');
    if(!inspection.gate.origin_eligible)reasons.push('Esta origem de pedido não foi liberada para acompanhamento.');
    for(const signal of inspection.readiness.signals){if(signal.severity==='blocker')reasons.push(signal.label);}
    return [...new Set(reasons)];
  },[inspection]);
  // Aceite operacional confirmado pelo servidor, sem autorizar iFood/99Food.
  // A origem manual continua dependente de capability e de comando explicito do owner.
  const needsManualAcceptance=Boolean(inspection && inspection.delivery.origin==='manual' &&
    !['delivered','cancelled'].includes(inspection.delivery.state) &&
    inspection.readiness.signals.some(signal=>signal.code==='NOT_ACCEPTED'));
  const issuePrivateLink=async(confirmed=false)=>{
    if(!allowed||!inspection||!selectedId||!canIssueLink||working||issuedLink)return;
    if(!confirmed){setPendingAction('issue');return;}
    const currentSelection=selectedId, currentInspection=inspection;
    const currentRequest=lastRequest.current;
    const currentAccount=auth.currentUser?.uid;
    setActionError('');setWorking(true);
    try{
      const answer=await api('/issue',{
        contract:'dfl.tracking.access',version:1,action:'issue',
        order:{canonical_order_key:currentInspection.delivery.canonical_order_key,origin:currentInspection.delivery.origin},
        idempotency_key:crypto.randomUUID().replace(/-/g,''),requested_ttl_minutes:90,
      });
      if(currentRequest!==lastRequest.current||auth.currentUser?.uid!==currentAccount)throw new Error('A tela ou a conta mudou. Não compartilhe este link; solicite a revogação.');
      if(!('opaque_token' in answer)||!/^[-_A-Za-z0-9]{43}$/.test(answer.opaque_token||'')||
        !('grant_id' in answer)||!/^[a-f0-9]{64}$/.test(answer.grant_id||'')||
        typeof answer.expires_at!=='string'||!Number.isFinite(Date.parse(answer.expires_at)))
        throw new Error('Emissão não confirmada. Confira o grant no servidor antes de tentar novamente.');
      const grantId=answer.grant_id as string;
      setLastGrant({grantId,deliveryId:currentSelection});
      setIssuedLink({url:`${CUSTOMER_TRACKING_ORIGIN}/acompanhar#t=${answer.opaque_token}`,grantId,deliveryId:currentSelection,
        expiresAt:answer.expires_at});
      toast.success('Link privado emitido. Toque em copiar para compartilhá-lo com o cliente.');
    }catch(e){setActionError(e instanceof Error?e.message:'Não foi possível emitir acesso.');}
    finally{setWorking(false);}
  };
  const copyPrivateLink=()=>{
    if(!issuedLink||issuedLink.deliveryId!==selectedId)return;
    const url=issuedLink.url;
    // Clipboard call occurs directly in a user gesture; no token appears in rendered text.
    void navigator.clipboard.writeText(url).then(()=>{
      setIssuedLink(null);
      toast.success('Link copiado. Envie somente ao cliente autorizado.');
    }).catch(()=>setActionError('Cópia indisponível. Tente novamente ou revogue o acesso.'));
  };
  const sharePrivateLink=async(confirmed=false)=>{
    if(!allowed||!issuedLink||issuedLink.deliveryId!==selectedId||working)return;
    if(Date.parse(issuedLink.expiresAt)<=Date.now()){
      setIssuedLink(null);
      toast.error('Este link expirou. Revogue o acesso anterior antes de emitir outro.');
      return;
    }
    if(!confirmed){setPendingAction('share');return;}
    if(typeof navigator.share!=='function'){
      toast.error('Compartilhamento indisponível neste aparelho. Use Copiar link.');
      return;
    }
    const url=issuedLink.url;
    try{
      await navigator.share({title:'Da Família Lanches — acompanhar pedido',text:`Acompanhe seu pedido da Da Família Lanches: ${url}`});
      setIssuedLink(null);
      toast.success('Compartilhamento concluído no aparelho. Confirme o destinatário no WhatsApp.');
    }catch(e){
      if(e instanceof Error&&e.name==='AbortError')return;
      toast.error('Não foi possível compartilhar. Use Copiar link.');
    }
  };
  const revokePrivateLink=async(confirmed=false)=>{
    if(!lastGrant||working||!allowed||lastGrant.deliveryId!==selectedId)return;
    if(!confirmed){setPendingAction('revoke');return;}
    const {grantId}=lastGrant;
    setActionError('');setWorking(true);
    try{
      const response=await api('/revoke',{
        contract:'dfl.tracking.access',version:1,action:'revoke',grant_id:grantId,
        reason:'admin_action',idempotency_key:crypto.randomUUID().replace(/-/g,''),
      });
      if(!('revoked' in response)||response.revoked!==true)throw new Error('Revogação não confirmada; confira o servidor.');
      setIssuedLink(null);setLastGrant(null);
      toast.success('Acesso revogado no servidor.');
    }catch(e){setActionError(e instanceof Error?e.message:'Não foi possível confirmar a revogação.');}
    finally{setWorking(false);}
  };
  const submit=async(action:'confirm'|'sync',confirmed=false)=>{
    if(!allowed||!selectedId||working)return;
    if(!confirmed){setPendingAction(action);return;}
    setWorking(true);
    try{
      const payload=action==='confirm'
        ?{contract:'dfl.tracking.confirm',version:1,delivery_id:selectedId,idempotency_key:crypto.randomUUID().replace(/-/g,'')}
        :{contract:'dfl.tracking.sync',version:1,delivery_id:selectedId};
      const outcome=await api(`/${action}`,payload);
      if(!('ok' in outcome)||outcome.ok!==true)throw new Error('Ação não habilitada no backend ou sem permissão.');
      toast.success(action==='confirm'?'Aceite registrado no servidor.':'Reconciliação concluída.');
      await inspect(selectedId);
    }catch(e){toast.error(e instanceof Error?e.message:'Ação indisponível.');}finally{setWorking(false);}
  };
  if(!allowed)return <div className="dfl-page"><LockKeyhole className="text-zinc-500"/><h1 className="mt-3 font-black text-zinc-100">Área administrativa restrita</h1><p className="mt-2 text-xs text-zinc-500">O acesso exige autenticação do proprietário.</p></div>;
  return <div className="dfl-page space-y-4 pb-28">
    {pendingAction&&<StaffConfirmDialog {...confirmCopy[pendingAction]} busy={working}
      onCancel={()=>setPendingAction(null)}
      onConfirm={()=>{const action=pendingAction;setPendingAction(null);
        if(action==='issue')void issuePrivateLink(true);
        else if(action==='share')void sharePrivateLink(true);
        else if(action==='revoke')void revokePrivateLink(true);
        else if(action==='confirm'||action==='sync')void submit(action,true);
      }}/>}
    <header className="flex items-start gap-3 pb-1">
      <button type="button" onClick={()=>router.push('/mais')} aria-label="Voltar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-900/70"><ArrowLeft size={18}/></button>
      <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.13em] text-emerald-300"><ShieldCheck size={13}/> Acesso privado · Modo manual</p><h1 className="mt-0.5 font-heading text-xl font-black text-zinc-100">Acompanhamento</h1><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Confira pedidos e gerencie links de acesso, um de cada vez.</p></div>
    </header>
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"><button type="button" onClick={()=>setListOpen(v=>!v)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-sm font-black text-zinc-100"><Search size={17}/> Selecionar pedido</span><ChevronDown className={`text-zinc-500 transition-transform ${listOpen?'rotate-180':''}`} size={17}/></button>
      {listOpen&&<>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Período dos pedidos">
        <button type="button" aria-pressed={dayScope==='day'&&selectedDay===trackingTodayKey()} onClick={()=>{setSelectedDay(trackingTodayKey());setDayScope('day');}} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${dayScope==='day'&&selectedDay===trackingTodayKey()?'border-emerald-400 bg-emerald-500/15 text-emerald-200':'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>Hoje</button>
        <button type="button" aria-pressed={dayScope==='day'&&selectedDay===trackingShiftKey(trackingTodayKey(),-1)} onClick={()=>{setSelectedDay(trackingShiftKey(trackingTodayKey(),-1));setDayScope('day');}} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${dayScope==='day'&&selectedDay===trackingShiftKey(trackingTodayKey(),-1)?'border-emerald-400 bg-emerald-500/15 text-emerald-200':'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>Ontem</button>
        <button type="button" aria-pressed={dayScope==='week'} onClick={()=>{setSelectedDay(trackingTodayKey());setDayScope('week');}} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${dayScope==='week'?'border-emerald-400 bg-emerald-500/15 text-emerald-200':'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>7 dias</button>
        <button type="button" aria-pressed={dayScope==='all'} onClick={()=>setDayScope('all')} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${dayScope==='all'?'border-emerald-400 bg-emerald-500/15 text-emerald-200':'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>Todos</button>
      </div>
      {dayScope==='day'&&<OperationalDatePicker selectedDate={new Date(`${selectedDay}T12:00:00-03:00`)} selectedDateKey={selectedDay} datesWithOperation={datesWithOperation}
        onPrevious={()=>setSelectedDay(key=>trackingShiftKey(key,-1))} onNext={()=>setSelectedDay(key=>trackingShiftKey(key,1))}
        onSelect={date=>setSelectedDay(trackingTodayKey(date))}/>}
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 focus-within:border-emerald-500/40"><Search size={16} className="text-zinc-500"/><input aria-label="Buscar pedido" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} placeholder="ID ou cliente" className="min-h-11 w-full min-w-0 appearance-none border-0 bg-transparent text-sm text-zinc-100 outline-none ring-0 focus:outline-none focus:ring-0 placeholder:text-zinc-600"/></div><div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar origem">{([['todas','Todos'],['site','Site'],['manual','Loja'],['ifood','iFood'],['food99','99Food']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)} className={`min-h-9 shrink-0 rounded-xl border px-3 text-[11px] font-bold transition-colors ${filter===key?filterVisual[key]:'border-zinc-800 bg-zinc-950/40 text-zinc-500'}`}>{label}</button>)}</div><p className="text-[10px] text-zinc-400" role="status">{listed.length} pedidos neste filtro · horário de Brasília. Sem data registrada: visível em Todos.</p><div className="max-h-[360px] space-y-2 overflow-y-auto overscroll-contain">{listed.map(d=><OwnerTrackingCard key={d.id} delivery={d} active={selectedId===d.id} onClick={()=>choose(d.id)}/>)}{listed.length===0&&<p className="p-4 text-center text-xs text-zinc-500">Nenhum pedido neste período. Escolha outra data ou toque em Todos.</p>}</div><p className="text-[10px] text-zinc-600">Até 80 pedidos sincronizados no período escolhido. Nenhuma consulta extra ou envio de mensagens.</p></>}
    </section>
    {selected&&<section aria-label="Pedido selecionado" className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-zinc-900/55 p-3">
      <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.13em] text-emerald-400">Pedido selecionado</p><p className="mt-1 truncate text-sm font-black text-zinc-100">{siteOrderDisplayReference(selected)} · {shortTechnicalReference(selected.id)}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400"><span className="truncate">{selected.customer_name||'Cliente'}</span><span className={`rounded-md border px-1.5 py-0.5 font-bold ${filterVisual[deliveryOrigin(selected)]}`}>{deliveryOrigin(selected)==='site'?'Site':deliveryOrigin(selected)==='ifood'?'iFood':deliveryOrigin(selected)==='food99'?'99Food':'Loja'}</span><span>{selected.completed?'Finalizado':selected.route_id?'Em rota':'Aguardando'}</span><span>{maskedMessagePhone(selected.phone)}</span></div></div>
      <button type="button" disabled={loading} onClick={()=>void inspect(selectedId)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-bold text-emerald-200 disabled:opacity-50"><RefreshCw size={14} className={loading?'animate-spin':''}/> Conferir</button>
    </section>}
    {loading&&<div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400"><RefreshCw size={15} className="animate-spin text-emerald-400"/> Conferindo dados confirmados no servidor...</div>}
    {failure&&<div ref={errorAreaRef} role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/[.07] p-4 text-xs text-red-200 ring-1 ring-red-500/15"><div className="flex items-center gap-2 font-bold"><AlertTriangle size={17}/> Não foi possível conferir</div><p className="mt-2 leading-relaxed">{failure}</p><p className="mt-2 text-zinc-400">As operações do aplicativo continuam disponíveis.</p></div>}
    {inspection&&<section ref={actionAreaRef} className={`space-y-2 rounded-2xl border bg-amber-500/[.045] p-4 ${actionError?'border-red-500/50 ring-1 ring-red-500/20':'border-amber-500/25'}`}>
      <div className="flex items-center gap-2 text-sm font-black text-amber-100"><LockKeyhole size={16}/> Acesso privado do cliente</div>
      <p className="text-[11px] leading-relaxed text-zinc-400">Exclusivo do proprietário. Link de uso único, sem WhatsApp automático. Só copie após conferir o pedido correto.</p>
      {needsManualAcceptance&&<div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[.055] p-3">
        <p className="mb-2 text-[11px] font-bold text-emerald-200">Pedido da Loja: aceite ainda não confirmado no servidor.</p>
        <button type="button" disabled={working||loading} onClick={()=>void submit('confirm')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-xs font-black text-emerald-200 transition active:scale-[.99] disabled:opacity-40">
          <ClipboardCheck size={16}/>{working?'Confirmando no servidor...':'Confirmar aceite manual deste pedido'}
        </button>
        <p className="mt-2 text-[10px] text-zinc-500">Apenas o proprietário pode registrar o aceite. Não envia WhatsApp nem cria link automaticamente.</p>
      </div>}{actionError&&<p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[.08] p-2 text-[11px] font-bold text-red-200"><AlertTriangle size={13} className="mr-1 inline"/>{actionError}</p>}
      <button type="button" disabled={!canIssueLink||working||Boolean(issuedLink)} onClick={()=>void issuePrivateLink()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-bold text-amber-100 disabled:opacity-35"><Link2 size={16}/> {working?'Conferindo servidor...':'Emitir link privado (90 min)'}</button>
      {issuedLink&&issuedLink.deliveryId===selectedId&&<div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[.045] p-3">
        <p className="text-xs font-bold text-emerald-100">Link emitido — token oculto</p>
        <p className="text-[11px] text-zinc-400">Copie diretamente para o cliente certo. Vence em {new Date(issuedLink.expiresAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})}. Se sair da página antes de copiar, revogue o acesso.</p>
        <button type="button" onClick={copyPrivateLink} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-xs font-black text-emerald-100"><Copy size={15}/> Copiar link para o cliente</button>
        <button type="button" onClick={()=>void sharePrivateLink()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[.08] px-3 text-xs font-black text-emerald-100"><Share2 size={15}/> Compartilhar link (escolher WhatsApp)</button>
      </div>}
      {lastGrant&&lastGrant.deliveryId===selectedId&&<button type="button" disabled={working} onClick={()=>void revokePrivateLink()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 px-3 text-xs font-bold text-red-200 disabled:opacity-40"><XCircle size={16}/> Revogar último acesso emitido</button>}
      {!canIssueLink&&<div className="rounded-xl border border-amber-500/20 bg-amber-500/[.055] p-3" role="status"><strong className="block text-xs text-amber-200">Por que não posso emitir?</strong><ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-zinc-300">{issueBlockReasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p className="mt-2 text-[10px] text-zinc-500">Telefone cadastrado não libera acesso por si só. Nenhuma mensagem é enviada automaticamente.</p></div>}
    </section>}
    {inspection&&<details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/35"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-xs font-black text-zinc-200"><span className="flex items-center gap-2"><ClipboardCheck size={16} className="text-cyan-300"/> Diagnóstico e evidências do pedido</span><ChevronDown size={16} className="text-zinc-500 transition group-open:rotate-180"/></summary><div className="border-t border-zinc-800 p-2"><OwnerTrackingInspection value={inspection} busy={working} onCopy={copy} onConfirm={()=>void submit('confirm')} onSync={()=>void submit('sync')}/></div></details>}
    {inspection&&<button type="button" disabled={certifying||loading} onClick={()=>void certify()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/[.06] px-3 text-xs font-black text-cyan-100 disabled:opacity-40"><ShieldCheck size={16}/>{certifying?'Certificando evidências...':'Certificar contratos A–E neste pedido'}</button>}
    {certificate&&<TrackingGate2Certificate certificate={certificate}/>}
    <details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-xs font-bold text-zinc-400"><span className="flex items-center gap-2"><SlidersHorizontal size={16}/> Ferramentas avançadas e contratos</span><ChevronDown size={16} className="transition group-open:rotate-180"/></summary>
      <div className="space-y-2 border-t border-zinc-800 p-3">
        <button type="button" onClick={()=>router.push('/mais/acompanhamento/ponte')} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/[.04] px-3 text-left text-[11px] font-bold text-sky-200"><span className="flex items-center gap-2"><ShieldCheck size={16}/> Ponte com Site · Verificação segura</span><ArrowLeft size={14} className="rotate-180"/></button>
        <button type="button" onClick={()=>router.push('/mais/acompanhamento/auditoria')} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[.04] px-3 text-left text-[11px] font-bold text-emerald-200"><span className="flex items-center gap-2"><ShieldCheck size={16}/> Auditoria de acompanhamento · até 20 pedidos</span><ArrowLeft size={14} className="rotate-180"/></button>
        <button type="button" onClick={()=>router.push('/mais/acompanhamento/laboratorio')} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 text-left text-[11px] font-bold text-zinc-300"><span className="flex items-center gap-2"><BookOpenCheck size={16}/> Laboratório visual · 14 cenários fictícios</span><ArrowLeft size={14} className="rotate-180"/></button>
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[.035] p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-amber-200"><LockKeyhole size={14}/> Acesso protegido e emissão manual</div><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">A certificação do piloto WhatsApp é separada da liberação de links. Consulte as flags deste pedido. A emissão exige confirmação do proprietário e não envia mensagens automaticamente.</p></div>
        <p className="px-1 text-[10px] text-zinc-500"><BookOpenCheck size={13} className="mr-1 inline"/> Contrato do Site preservado. Ferramentas de diagnóstico não emitem links por conta própria.</p>
      </div>
    </details>
  </div>;
}
export default function AcompanhamentoAdminPage(){return <Suspense fallback={<div className="dfl-page p-4 text-xs text-zinc-400">Carregando controles...</div>}><ControlPanel/></Suspense>;}
