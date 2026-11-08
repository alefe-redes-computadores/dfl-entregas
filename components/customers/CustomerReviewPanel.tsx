'use client';
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, History, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { isSuperadminUid } from '@/lib/access/roles';
import { customerReviewLabel } from '@/lib/customer-review';
import { recordCustomerReview } from '@/lib/customer-review-store';
import type { Customer, CustomerReviewState, Delivery } from '@/types';

const options: {value:CustomerReviewState;label:string}[] = [
  {value:'normal',label:'Sem ocorrência ativa'},
  {value:'observacao',label:'Em observação'},
  {value:'revisado',label:'Revisado / resolvido'},
];

export function CustomerReviewPanel({customer,deliveries}:{customer:Customer;deliveries:readonly Delivery[]}) {
  const owner = useAppStore(s=>s.user);
  const allowed = isSuperadminUid(owner?.uid);
  const [state,setState] = useState<CustomerReviewState>('observacao');
  const [reason,setReason] = useState('');
  const [deliveryId,setDeliveryId] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const lock = useRef(false);
  const current = customer.operational_review;
  const latest = useMemo(()=>deliveries.slice(0,12),[deliveries]);
  const submit = async()=>{
    if (!allowed || busy || lock.current) return;
    if (reason.trim().length < 12) {setMessage('Descreva um fato concreto com pelo menos 12 caracteres.');return;}
    lock.current=true;setBusy(true);setMessage('');
    try {
      await recordCustomerReview({customerId:customer.id,state,reason,relatedDeliveryId:deliveryId||undefined});
      setReason('');setDeliveryId('');setMessage('Revisão registrada no servidor.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Falha ao registrar. Confira a conexão e permissões.');}
    finally{lock.current=false;setBusy(false);}
  };
  if (!allowed) return <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">Acompanhamento operacional restrito à gestão.</section>;
  return <section aria-label="Revisão operacional do cliente" className="rounded-[22px] border border-amber-500/20 bg-zinc-900/45 p-3.5 space-y-3">
    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-black text-zinc-100"><ShieldCheck size={17} className="text-amber-300"/>Acompanhamento operacional</div><span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${current?.state==='observacao'?'border-amber-500/40 bg-amber-500/10 text-amber-200':'border-zinc-700 text-zinc-300'}`}>{customerReviewLabel(current?.state)}</span></div>
    <p className="text-[11px] leading-relaxed text-zinc-400">Separado do score comercial. Uma conta nova, um telefone incompleto ou um pedido incomum não constituem prova de fraude. Somente um responsável pode registrar uma ocorrência com motivo verificável.</p>
    {current?.reason&&<p className="rounded-xl bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-300"><AlertTriangle size={13} className="mr-1 inline text-amber-400"/>Último motivo: {current.reason}</p>}
    <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-200"><History size={14}/>Histórico de revisões · {current?.events.length||0}</summary><div className="mt-3 space-y-2">{[...(current?.events||[])].reverse().map(event=><div key={event.id} className="border-t border-zinc-800 pt-2 text-[11px] text-zinc-300"><p className="font-bold">{customerReviewLabel(event.state)} · {new Date(event.occurred_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p><p className="mt-1 break-words">{event.reason}</p>{event.related_delivery_id&&<p className="mt-1 text-zinc-500">Pedido vinculado: {event.related_delivery_id}</p>}<p className="mt-1 text-[9px] text-zinc-500">Autor: {event.actor_uid===owner?.uid?'Proprietário':'Outro operador autorizado'}</p></div>)}{!current?.events.length&&<p className="text-[11px] text-zinc-500">Nenhum registro no histórico.</p>}</div></details>
    {allowed?<details className="rounded-xl border border-amber-500/20 bg-amber-500/[.04] p-3"><summary className="cursor-pointer text-xs font-bold text-amber-200"><ClipboardCheck size={14} className="mr-1 inline"/>Registrar ou encerrar observação</summary><div className="mt-3 space-y-3"><label className="block text-[11px] font-bold text-zinc-300">Estado<select value={state} onChange={e=>setState(e.target.value as CustomerReviewState)} className="mt-1 w-full min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs">{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="block text-[11px] font-bold text-zinc-300">Motivo factual<textarea value={reason} onChange={e=>setReason(e.target.value.slice(0,450))} rows={3} placeholder="Ex.: telefone informado estava incorreto e foi atualizado após confirmação com o cliente" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs"/></label><label className="block text-[11px] font-bold text-zinc-300">Pedido relacionado (opcional)<select value={deliveryId} onChange={e=>setDeliveryId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs"><option value="">Sem pedido vinculado</option>{latest.map(d=><option key={d.id} value={d.id}>{d.order_id||d.external_order_id||d.id.slice(-8)} · {d.origin}</option>)}</select></label><button type="button" disabled={busy||reason.trim().length<12} onClick={()=>void submit()} className="min-h-11 w-full rounded-xl bg-amber-500/15 px-3 text-xs font-black text-amber-200 disabled:opacity-40">{busy?'Registrando…':'Confirmar registro no servidor'}</button><p className="text-[10px] text-zinc-500">Registro transacional e restrito ao proprietário. Não bloqueia pedidos automaticamente; não substitui auditoria das regras publicadas.</p></div></details>:<p className="text-[10px] text-zinc-500">Somente o proprietário pode alterar este estado.</p>}
    {message&&<p role="status" className="text-[11px] text-amber-200">{message}</p>}
  </section>;
}
