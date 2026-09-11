// app/despesas/page.tsx
'use client';
import { useMemo } from 'react';
import { Bike, ReceiptText, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';

const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function ExpensesPage(){
  const expenses=useAppStore(s=>s.operationalExpenses);
  const remove=useAppStore(s=>s.deleteOperationalExpense);
  const total=useMemo(()=>expenses.reduce((sum,item)=>sum+item.amount,0),[expenses]);
  return <div className="flex flex-col gap-5 pb-28">
    <PageHeader title="Despesas operacionais" subtitle="Custos que não movimentam o estoque" to="/mais"/>
    <section className="rounded-[28px] border border-amber-500/20 bg-amber-500/[.06] p-5">
      <div className="flex items-center gap-2 text-amber-300"><Wallet size={17}/><p className="text-[10px] font-black uppercase tracking-[.16em]">Total registrado</p></div>
      <p className="mt-2 text-3xl font-black text-zinc-100">{money(total)}</p>
      <p className="mt-1 text-xs text-zinc-500">Separado de compras físicas e do valor do estoque.</p>
    </section>
    <section className="space-y-3">
      {expenses.map(item=><article key={item.id} className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-emerald-300">{item.type==='motoboy'?<Bike size={18}/>:<ReceiptText size={18}/>}</div>
          <div className="min-w-0 flex-1"><p className="font-bold text-zinc-100">{item.description}</p><p className="mt-1 text-xs text-zinc-500">{new Date(item.occurred_at).toLocaleDateString('pt-BR')} · {item.observation||'Despesa operacional'}</p><p className="mt-2 text-lg font-black text-zinc-100">{money(item.amount)}</p></div>
          <button type="button" onClick={async()=>{if(!confirm('Excluir esta despesa?'))return;try{await remove(item.id);toast.success('Despesa excluída.')}catch{toast.error('Não foi possível excluir.')}}} className="rounded-xl p-2 text-zinc-600 active:bg-red-500/10 active:text-red-400"><Trash2 size={16}/></button>
        </div>
      </article>)}
      {!expenses.length&&<div className="rounded-[24px] border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-600">Nenhuma despesa operacional registrada.</div>}
    </section>
  </div>
}
