'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CalendarClock, CheckCircle2, RotateCcw, Truck } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { isSyntheticOperationalRoute } from '@/lib/operational-time';
import { isSuperadminUid } from '@/lib/access/roles';
import { isAwaitingRedelivery } from '@/lib/operation/return-to-store';
import { deliveryAttemptLabel } from '@/lib/delivery-attempts';
import { PremiumChoicePicker } from '@/components/ui/PremiumChoicePicker';

/** Owner-controlled retry queue. Moving a delivery never completes it or charges the customer. */
export default function DeliveryReturnsPage(){
  const router=useRouter();
  const deliveries=useAppStore(s=>s.deliveries);
  const routes=useAppStore(s=>s.routes);
  const customers=useAppStore(s=>s.customers);
  const updateDelivery=useAppStore(s=>s.updateDelivery);
  const user=useAppStore(s=>s.user);
  const [chosen,setChosen]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const pending=useMemo(()=>deliveries.filter(isAwaitingRedelivery)
    .sort((a,b)=>(a.return_to_store?.at||'').localeCompare(b.return_to_store?.at||'')),[deliveries]);
  const openRoutes=routes.filter(r=>r.status==='aberta' && !isSyntheticOperationalRoute(r));
  const onReinsert=async(id:string)=>{
    if(busy || confirmId!==id)return;
    const delivery=deliveries.find(x=>x.id===id);
    const newRoute=chosen[id];
    const target=routes.find(x=>x.id===newRoute && x.status==='aberta' && !isSyntheticOperationalRoute(x));
    if(!delivery || !isAwaitingRedelivery(delivery) || !target || target.id===delivery.route_id){
      toast.warning('Escolha outra rota operacional aberta.');return;
    }
    setConfirmId(null);
    setBusy(id);
    try {
      await updateDelivery(id,{route_id:target.id,return_to_store:null});
      toast.success('Pedido reinserido na nova rota, sem dar baixa.');
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível reinserir a entrega.');}
    finally{setBusy(null);}
  };
  const confirmDelivery=confirmId ? deliveries.find(x=>x.id===confirmId) : undefined;
  const confirmTarget=confirmId ? openRoutes.find(x=>x.id===chosen[confirmId]) : undefined;
  if (!isSuperadminUid(user?.uid)) return <main className="dfl-page p-5 text-sm text-zinc-400">Esta fila operacional exige autorização do proprietário.</main>;
  return <main className="dfl-page mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-3">
    <header className="flex items-start gap-3"><button type="button" onClick={()=>router.back()} aria-label="Voltar" className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-900"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black tracking-widest text-amber-300">OPERAÇÃO · R72</p><h1 className="text-xl font-black">Retornos à loja</h1><p className="text-xs text-zinc-400">Pedidos não entregues aguardando nova tentativa. Nenhuma venda ou baixa foi criada.</p></div></header>
    <section aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4"><AlertTriangle className="text-amber-300" size={24}/><div><b className="text-xl tabular-nums">{pending.length}</b><p className="text-xs text-zinc-400">pendência{pending.length===1?'':'s'} para replanejar; permanecem visíveis após o expediente</p></div></section>
    {pending.map(item=>{const returned=item.return_to_store!;const customer=customers.find(c=>c.id===item.customer_id);const lastRoute=routes.find(r=>r.id===returned.route_id);return <article key={item.id} className="space-y-3 rounded-[22px] border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start gap-3"><RotateCcw size={20} className="mt-1 shrink-0 text-amber-300"/><div className="min-w-0"><h2 className="font-black text-zinc-100">{item.customer_name||customer?.name||'Cliente'}</h2><p className="text-xs text-zinc-400">{item.address_string||customer?.address||'Endereço não informado'}</p><p className="mt-1 text-xs text-amber-200">{deliveryAttemptLabel(returned.reason)} · {lastRoute?.name||'Rota de origem'}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500"><CalendarClock size={12}/>{new Date(returned.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p></div></div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-300">Nova rota para tentativa real</p>
        <PremiumChoicePicker label="Nova rota para reentrega" value={chosen[item.id]||''} disabled={busy!==null} onChange={value=>setChosen(old=>({...old,[item.id]:value}))} options={[{value:'',label:'Selecione uma rota aberta'},...openRoutes.filter(r=>r.id!==item.route_id).map(r=>({value:r.id,label:r.name}))]} />
      </div>
      <button type="button" disabled={Boolean(busy)||!chosen[item.id]} onClick={()=>setConfirmId(item.id)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-black text-zinc-950 disabled:opacity-40"><Truck size={17}/>{busy===item.id?'Reinserindo…':'Reinserir na rota selecionada'}</button>
    </article>})}
    {confirmId&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] backdrop-blur-sm sm:items-center"
      onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setConfirmId(null);}}
      onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();setConfirmId(null);}}}>
      <section role="dialog" aria-modal="true" aria-labelledby="r73-return-title" className="w-full max-w-md space-y-4 rounded-[26px] border border-amber-400/30 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-300"><RotateCcw size={22}/></span><div><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Conferência da operação</p><h2 id="r73-return-title" className="text-base font-black text-zinc-100">Reinserir na rota?</h2></div></div>
        <p className="text-xs leading-relaxed text-zinc-300">{confirmDelivery?.customer_name||'Pedido'} será reinserido em <strong className="text-amber-200">{confirmTarget?.name||'rota não disponível'}</strong>. A operação não marca entrega concluída, não cria nova venda e não cobra o cliente.</p>
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-[11px] text-zinc-400">Confira a rota antes de confirmar. Se a seleção mudou, cancele e escolha novamente.</p>
        <div className="grid grid-cols-2 gap-2"><button type="button" autoFocus disabled={Boolean(busy)} onClick={()=>setConfirmId(null)} className="min-h-12 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-200">Cancelar</button><button type="button" disabled={Boolean(busy)||!confirmTarget||!confirmDelivery||confirmTarget.id===confirmDelivery.route_id} onClick={()=>void onReinsert(confirmId)} className="min-h-12 rounded-xl bg-amber-400 px-3 text-xs font-black text-zinc-950 disabled:opacity-40">Confirmar rota</button></div>
      </section>
    </div>}
    {!pending.length&&<div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 p-8 text-center"><CheckCircle2 className="text-emerald-300" size={25}/><p className="font-bold">Nenhum retorno pendente</p><p className="text-xs text-zinc-500">As tentativas antigas permanecem no histórico dos pedidos.</p></div>}
  </main>;
}
