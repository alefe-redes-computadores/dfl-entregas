// app/abastecimentos/editar/page.tsx
'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { StockSupplyForm, type StockSupplyFormValue } from '@/components/stock-supplies/StockSupplyForm';
import { useAppStore } from '@/store/useAppStore';

function Content() {
  const router = useRouter(); const id = useSearchParams().get('id');
  const supplies = useAppStore((state) => state.stockSupplies); const user = useAppStore((state) => state.user);
  const updateStockSupply = useAppStore((state) => state.updateStockSupply); const supply = supplies.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);
  if (!supply) return <PageHeader title="Abastecimento não encontrado" to="/abastecimentos"/>;
  const save = async (value: StockSupplyFormValue) => { setBusy(true); try { await updateStockSupply(supply.id, value); toast.success('Abastecimento atualizado.'); router.replace(`/abastecimentos/detalhes?id=${supply.id}`); } catch (error) { console.error(error); toast.error('Não foi possível salvar.'); } finally { setBusy(false); } };
  return <div><PageHeader title="Editar compra" subtitle={`${supply.items.length} item${supply.items.length === 1 ? '' : 's'}`} to={`/abastecimentos/detalhes?id=${supply.id}`}/><StockSupplyForm initial={supply} defaultBuyerName={user?.displayName || 'Álefe'} busy={busy} submitLabel="Salvar alterações" onSubmit={save}/></div>;
}
export default function EditStockSupplyPage() { return <Suspense fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}><Content/></Suspense>; }
