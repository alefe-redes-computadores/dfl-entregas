// app/abastecimentos/novo/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { StockSupplyForm, type StockSupplyFormValue } from '@/components/stock-supplies/StockSupplyForm';
import { useAppStore } from '@/store/useAppStore';
import type { StockSupply } from '@/types';

export default function NewStockSupplyPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const addStockSupply = useAppStore((state) => state.addStockSupply);
  const [busy, setBusy] = useState(false);
  const save = async (value: StockSupplyFormValue) => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const supply: StockSupply = { id: `supply-${Date.now()}`, ...value, created_at: now, updated_at: now };
      await addStockSupply(supply);
      toast.success('Abastecimento de estoque registrado.');
      router.replace('/abastecimentos');
    } catch (error) {
      console.error(error); toast.error('Não foi possível registrar o abastecimento.');
    } finally { setBusy(false); }
  };
  return <div><PageHeader title="Nova compra" subtitle="Reposição de produtos da loja" to="/abastecimentos"/><StockSupplyForm defaultBuyerName={user?.displayName || 'Álefe'} busy={busy} submitLabel="Registrar compra" onSubmit={save}/></div>;
}
