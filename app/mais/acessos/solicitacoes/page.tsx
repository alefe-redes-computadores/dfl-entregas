'use client';
/** R30: fila premium de conferência; ações reais continuam com autorização no servidor. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, CheckCircle2, ChevronDown, ClipboardList, Clock3, DatabaseZap, LockKeyhole, Package, ShieldAlert, ShoppingBasket, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from '@/lib/operational-toast';
import { isSuperadminUid } from '@/lib/access/roles';
import { readStaffOperations, reviewStaffOperation, type OperationRequestRow } from '@/lib/access/staffOperationsClient';
import { applyCanonicalDelivery, verifyCanonicalPurchase } from '@/lib/access/staffCanonicalClient';
import { StaffConfirmDialog } from '@/components/access/StaffConfirmDialog';
import { StaffEmpty, StaffMetric, StaffNavRow, StaffPageHeader, StaffPanel } from '@/components/access/StaffPremium';
import { staffTouch } from '@/lib/access/staffTouch';

type Decision = 'apply' | 'link' | 'reviewed' | 'dismissed';
type Pending = {row:OperationRequestRow; decision:Decision; supplyId?:string};
const confirmation:Record<Decision,{title:string;description:string;confirmLabel:string}> = {
  apply:{title:'Confirmar baixa REAL?',description:'A operação usará o fluxo existente do aplicativo. Ela pode atualizar histórico do cliente, sincronização com o Site e fechamento da rota. Confira os detalhes antes de prosseguir.',confirmLabel:'Concluir entrega'},
  link:{title:'Conciliar entrada existente?',description:'O servidor irá verificar os movimentos da compra já integrada. Esta ação NÃO adicionará quantidade novamente ao estoque.',confirmLabel:'Conciliar compra'},
  reviewed:{title:'Encerrar sem executar?',description:'Esta solicitação será marcada como revisada. Nenhuma entrega ou movimentação de estoque será alterada.',confirmLabel:'Revisado (sem aplicar)'},
  dismissed:{title:'Dispensar solicitação?',description:'A solicitação será dispensada sem alterar dados operacionais. Essa decisão será registrada para auditoria.',confirmLabel:'Dispensar'},
};
const validTime=(value:string)=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('pt-BR'):'Horário indisponível';};
export default function StaffOperationRequestsPage(){
  const router=useRouter();
  const uid=useAppStore(s=>s.user?.uid);
  const owner=isSuperadminUid(uid);
  const supplies=useAppStore(s=>s.stockSupplies);
  const [rows,setRows]=useState<OperationRequestRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [selectedSupplies,setSelectedSupplies]=useState<Record<string,string>>({});
  const [expandedSupply,setExpandedSupply]=useState<string|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const refresh=useCallback(async(showFeedback=false)=>{
    if(!owner)return;
    setLoading(true);setError('');
    try{const data=await readStaffOperations();setRows(data);if(showFeedback)toast.success('Solicitações atualizadas.');}
    catch(e){const message=e instanceof Error?e.message:'Não foi possível consultar a fila.';setError(message);if(showFeedback)toast.error(message);}
    finally{setLoading(false);}
  },[owner]);
  useEffect(()=>{void refresh(false);},[refresh]);
  const deliveryCount=useMemo(()=>rows.filter(r=>r.kind==='delivery_confirmation').length,[rows]);
  const purchaseCount=rows.length-deliveryCount;
  const start=(row:OperationRequestRow,decision:Decision,supplyId?:string)=>{
    if(busy)return;staffTouch();
    if(decision==='link'&&!supplyId){toast.warning('Selecione uma compra integrada antes de conciliar.');return;}
    setExpandedSupply(null);setPending({row,decision,supplyId});
  };
  const execute=async()=>{
    const action=pending;
    if(!action||busy)return;
    setPending(null);setBusy(action.row.id);
    try{
      switch(action.decision){
        case 'apply':await applyCanonicalDelivery(action.row);toast.success('Entrega concluída pelo fluxo real.',{description:'Solicitação conciliada no servidor.'});break;
        case 'link':await verifyCanonicalPurchase(action.row.id,action.supplyId!);toast.success('Compra conciliada com o ledger.',{description:'Nenhum saldo foi duplicado.'});break;
        case 'reviewed':await reviewStaffOperation(action.row.id,'reviewed');toast.success('Solicitação revisada sem aplicar alterações.');break;
        case 'dismissed':await reviewStaffOperation(action.row.id,'dismissed');toast.success('Solicitação dispensada sem efeitos operacionais.');break;
      }
      await refresh(false);
    }catch(e){toast.error('Não foi possível concluir a ação.',{description:e instanceof Error?e.message:'Confira o servidor antes de tentar novamente.'});}
    finally{setBusy('');}
  };
  if(!owner)return <div className="dfl-page p-6"><StaffEmpty icon={LockKeyhole} title="Acesso restrito" subtitle="Somente o administrador pode consultar solicitações da equipe."/></div>;
  return <div className="dfl-page space-y-4 pb-28 text-zinc-100">
    <StaffPageHeader eyebrow="Equipe · Operação" title="Solicitações da equipe" icon={ClipboardList}
      onBack={()=>router.push('/mais/acessos')} onRefresh={()=>void refresh(true)} loading={loading}/>
    <StaffPanel title="Conferência antes da baixa" subtitle="A entrega usa o fluxo operacional existente. Compras são conciliadas somente após integração real; não existe lançamento duplicado." icon={ShieldAlert} tone="amber"/>
    <div className="grid grid-cols-3 gap-2">
      <StaffMetric value={rows.length} label="Solicitações" icon={ClipboardList} tone="neutral"/>
      <StaffMetric value={deliveryCount} label="Entregas" icon={Bike} tone="sky"/>
      <StaffMetric value={purchaseCount} label="Compras" icon={ShoppingBasket} tone="amber"/>
    </div>
    {loading&&!rows.length&&<div aria-live="polite" className="space-y-2"><div className="h-28 animate-pulse rounded-2xl bg-zinc-900"/><div className="h-28 animate-pulse rounded-2xl bg-zinc-900"/><p className="text-center text-xs text-zinc-500">Buscando solicitações autorizadas...</p></div>}
    {error&&<p role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/[.055] p-4 text-xs text-rose-300">{error}</p>}
    {!loading&&!rows.length&&!error&&<StaffEmpty icon={CheckCircle2} title="Fila em dia" subtitle="Nenhuma solicitação aguardando conferência. Quando a equipe enviar novos pedidos autorizados, eles aparecerão aqui."/>}
    <div className="space-y-3">{rows.map(row=>{
      const delivery=row.kind==='delivery_confirmation';
      const Icon=delivery?Bike:ShoppingBasket;
      const matched=delivery?[]:supplies.filter(s=>s.status==='conferido'&&!!s.stock_integrated_at&&!s.stock_reversed_at&&
        Date.parse(s.stock_integrated_at)>=Date.parse(row.createdAt)&&s.items.filter(item=>item.stock_product_id===row.targetId&&item.unit===row.unit).reduce((sum,item)=>sum+item.quantity,0)+0.0005>=(row.quantity||0)).slice(0,12);
      const selected=matched.find(item=>item.id===selectedSupplies[row.id]);
      const disabled=Boolean(busy)||loading;
      return <article key={row.id} className="space-y-3 rounded-[23px] border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[16px] ${delivery?'bg-sky-500/10 text-sky-300':'bg-amber-500/10 text-amber-300'}`}><Icon size={20}/></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{delivery?'Logística':'Estoque e compras'}</p><h2 className="mt-1 text-sm font-black">{delivery?'Confirmação de entrega':'Lançamento solicitado'}</h2><p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400"><Clock3 size={12}/>{row.actorName} · {validTime(row.createdAt)}</p></div>
          <span className="shrink-0 rounded-lg bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300">Pendente</span></div>
        <div className="rounded-xl bg-zinc-950/55 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{delivery?'Entrega vinculada':'Produto vinculado'}</p><p className="mt-1 break-all font-mono text-xs font-bold text-zinc-200">{row.targetId}</p>
          {!delivery&&row.quantity!==undefined&&<p className="mt-2 text-sm font-black text-amber-200">{String(row.quantity).replace('.',',')} {row.unit||''}</p>}
          {row.note&&<p className="mt-2 text-xs leading-relaxed text-zinc-400">{row.note}</p>}
        </div>
        <StaffNavRow tone="sky" icon={delivery?Bike:ShoppingBasket} label={delivery?'Conferir em Entregas':'Conferir em Compras'} onClick={()=>router.push(delivery?'/entregas':'/estoque/compras')}/>
        {delivery?<button type="button" disabled={disabled} onClick={()=>start(row,'apply')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-emerald-500 px-3 text-xs font-black text-zinc-950 disabled:opacity-40 active:scale-[.995]"><CheckCircle2 size={17}/>{busy===row.id?'Conferindo no servidor...':'Concluir entrega pelo fluxo real'}</button>:
        <div className="space-y-2 rounded-[18px] border border-amber-500/20 bg-amber-500/[.045] p-3">
          <p className="flex items-center gap-2 text-xs font-black text-amber-200"><DatabaseZap size={16}/> Conciliar compra já integrada</p>
          <button type="button" disabled={disabled} aria-expanded={expandedSupply===row.id} aria-label={`Selecionar compra integrada para ${row.targetId}`}
            onClick={()=>{staffTouch();setExpandedSupply(current=>current===row.id?null:row.id);}} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-left text-xs text-zinc-200 disabled:opacity-40"><span className="truncate">{selected?`${selected.supplier||'Compra'} · ${selected.id.slice(0,14)}`:'Selecionar compra conferida'}</span><ChevronDown size={16}/></button>
          {expandedSupply===row.id&&<div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1.5" role="group" aria-label="Compras integradas disponíveis">
            {matched.map(item=><button key={item.id} type="button" onClick={()=>{staffTouch();setSelectedSupplies(current=>({...current,[row.id]:item.id}));setExpandedSupply(null);}} className="min-h-11 w-full rounded-lg px-3 text-left text-xs text-zinc-200 hover:bg-zinc-800"><span className="block truncate font-bold">{item.supplier||'Compra integrada'}</span><span className="block truncate text-[10px] text-zinc-500">{item.id}</span></button>)}
            {!matched.length&&<p className="p-3 text-xs text-zinc-400">Nenhuma compra integrada correspondente.</p>}
          </div>}
          {!matched.length&&<p className="text-[11px] leading-relaxed text-zinc-400">Integre a compra em Compras e sincronize antes de conferir aqui.</p>}
          <button type="button" disabled={disabled||!selected} onClick={()=>start(row,'link',selected?.id)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-black text-zinc-950 disabled:opacity-35"><DatabaseZap size={16}/> Conferir entrada no ledger</button>
        </div>}
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3">
          <button type="button" disabled={disabled} onClick={()=>start(row,'reviewed')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] px-2 text-[11px] font-black text-emerald-300 disabled:opacity-40"><CheckCircle2 size={15}/> Revisado (sem aplicar)</button>
          <button type="button" disabled={disabled} onClick={()=>start(row,'dismissed')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950/50 px-2 text-[11px] font-bold text-zinc-300 disabled:opacity-40"><XCircle size={15}/> Dispensar</button>
        </div>
      </article>;
    })}</div>
    <StaffPanel title="Acesso ainda bloqueado" tone="neutral" icon={LockKeyhole}
      subtitle="A aplicação canônica exige DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED=true no servidor. O portal de funcionários e as regras de produção permanecem protegidos."/>
    {pending&&<StaffConfirmDialog title={confirmation[pending.decision].title} description={confirmation[pending.decision].description}
      detail={`${pending.row.kind==='delivery_confirmation'?'Entrega':'Produto'}: ${pending.row.targetId} · Solicitante: ${pending.row.actorName}`}
      confirmLabel={confirmation[pending.decision].confirmLabel}
      tone={pending.decision==='apply'?'danger':pending.decision==='dismissed'?'caution':'safe'}
      requirePhrase={pending.decision==='apply'?'CONCLUIR':undefined}
      onCancel={()=>setPending(null)} onConfirm={()=>void execute()} busy={!!busy}/>}
  </div>;
}
