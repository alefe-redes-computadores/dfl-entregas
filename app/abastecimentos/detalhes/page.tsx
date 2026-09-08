// app/abastecimentos/detalhes/page.tsx
'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CheckCircle2, Edit3, Store, Trash2, UserRound, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { money, SUPPLY_STATUS_LABELS, supplyTotal } from '@/lib/stock-supply';

function Content() {
  const router = useRouter(); const id = useSearchParams().get('id');
  const supply = useAppStore((state) => state.stockSupplies.find((item) => item.id === id));
  const update = useAppStore((state) => state.updateStockSupply); const remove = useAppStore((state) => state.deleteStockSupply); const integrate = useAppStore((state) => state.integrateStockSupply);
  const [busy, setBusy] = useState(false);
  if (!supply) return <PageHeader title="Abastecimento não encontrado" to="/abastecimentos"/>;
  const advance = async () => {
    const next = supply.status === 'solicitado' ? 'em_compra' : supply.status === 'em_compra' ? 'recebido' : supply.status === 'recebido' ? 'conferido' : null;
    if (!next) return; setBusy(true);
    try { const now = new Date().toISOString(); await update(supply.id, { status: next, received_at: next === 'recebido' ? now : supply.received_at, checked_at: next === 'conferido' ? now : supply.checked_at }); toast.success(`Status: ${SUPPLY_STATUS_LABELS[next]}.`); } finally { setBusy(false); }
  };
  const deleteRecord = async () => { if (!confirm('Excluir este abastecimento permanentemente?')) return; setBusy(true); try { await remove(supply.id); toast.success('Registro excluído.'); router.replace('/abastecimentos'); } catch { toast.error('Não foi possível excluir.'); setBusy(false); } };
  const checkIn = async () => { setBusy(true); try { await integrate(supply.id); toast.success('Compra conferida e estoque atualizado.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível integrar ao estoque.'); } finally { setBusy(false); } };
  return <div className="pb-28">
    <PageHeader title="Detalhes do abastecimento" subtitle={SUPPLY_STATUS_LABELS[supply.status]} to="/abastecimentos"/>
    <section className="rounded-[28px] border border-amber-500/20 bg-amber-500/[.05] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Total registrado</p><p className="mt-2 font-heading text-3xl font-black text-zinc-100">{money(supplyTotal(supply))}</p></div><span className="rounded-full bg-amber-500/10 px-3 py-2 text-[10px] font-black text-amber-400">{SUPPLY_STATUS_LABELS[supply.status]}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs text-zinc-400"><p className="flex gap-2"><UserRound size={15}/>{supply.purchaser_name || 'Comprador não informado'}</p><p className="flex gap-2"><Store size={15}/>{supply.supplier || 'Fornecedor não informado'}</p><p className="flex gap-2"><CalendarDays size={15}/>{new Date(supply.occurred_at).toLocaleString('pt-BR')}</p><p className="flex gap-2"><Wallet size={15}/>{supply.payment_method || 'Pagamento não informado'}</p></div></section>
    <section className="mt-5 space-y-3"><h2 className="font-heading text-base font-black text-zinc-100">Itens ({supply.items.length})</h2>{supply.items.map((item) => <article key={item.id} className="rounded-[22px] border border-zinc-800 bg-zinc-900/50 p-4"><div className="flex justify-between gap-3"><div><p className="font-black text-zinc-100">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.quantity.toLocaleString('pt-BR')} {item.unit}</p><p className={`mt-2 text-[10px] font-bold ${item.stock_product_id?'text-emerald-400':'text-amber-400'}`}>{item.stock_product_id?'Vinculado ao estoque':'Vínculo pendente'}</p></div><p className="font-black text-emerald-400">{item.total_price ? money(item.total_price) : 'Sem preço'}</p></div></article>)}</section>
    <section className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-zinc-900/50 p-3"><p className="text-[9px] text-zinc-600">Produtos</p><p className="mt-1 text-xs font-black text-zinc-200">{money(supply.products_amount)}</p></div><div className="rounded-2xl bg-zinc-900/50 p-3"><p className="text-[9px] text-zinc-600">Uber / frete</p><p className="mt-1 text-xs font-black text-zinc-200">{money(supply.transport_amount || 0)}</p></div><div className="rounded-2xl bg-zinc-900/50 p-3"><p className="text-[9px] text-zinc-600">Outros</p><p className="mt-1 text-xs font-black text-zinc-200">{money(supply.other_costs || 0)}</p></div></section>
    {supply.observation && <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4"><p className="text-[10px] font-black uppercase text-zinc-600">Observação</p><p className="mt-2 text-sm text-zinc-300">{supply.observation}</p></section>}
    {!supply.stock_integrated_at&&<div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => router.push(`/abastecimentos/editar?id=${supply.id}`)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm font-bold text-zinc-200"><Edit3 size={16}/>Editar</button><button onClick={deleteRecord} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-500/20 text-sm font-bold text-red-400"><Trash2 size={16}/>Excluir</button></div>}
    {supply.stock_integrated_at?<div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/[.06] p-4 text-sm font-bold text-emerald-400">Compra já integrada ao estoque.</div>:(supply.status==='recebido'||supply.status==='conferido')?<button onClick={checkIn} disabled={busy} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950"><CheckCircle2 size={18}/>Conferir e lançar no estoque</button>:<button onClick={advance} disabled={busy} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950"><CheckCircle2 size={18}/>{supply.status === 'em_compra' ? 'Marcar como recebido' : 'Iniciar compra'}</button>}
  </div>;
}
export default function StockSupplyDetailsPage() { return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}><Content/></Suspense>; }
