// app/abastecimentos/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StockSupplyForm,
  type StockSupplyFormValue,
} from '@/components/stock-supplies/StockSupplyForm';
import { feedbackError, feedbackSuccess } from '@/lib/ui-feedback';
import { useAppStore } from '@/store/useAppStore';
import type { StockSupply } from '@/types';

export default function NewStockSupplyPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const addStockSupply = useAppStore(
    (state) => state.addStockSupply,
  );
  const [busy, setBusy] = useState(false);

  const save = async (value: StockSupplyFormValue) => {
    if (busy) return;

    setBusy(true);

    try {
      const now = new Date().toISOString();
      const supply: StockSupply = {
        id: `supply-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        ...value,
        created_at: now,
        updated_at: now,
      };

      await addStockSupply(supply);
      await feedbackSuccess();
      toast.success('Compra registrada com sucesso.');
      router.replace('/abastecimentos');
    } catch (error) {
      console.error('Erro ao registrar compra de estoque:', error);
      await feedbackError();
      toast.error('Não foi possível registrar a compra. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nova compra"
        subtitle="Reposição de produtos da loja"
        to="/abastecimentos"
      />
      <StockSupplyForm
        defaultBuyerName={user?.displayName || 'Álefe'}
        busy={busy}
        submitLabel="Registrar compra"
        onSubmit={save}
      />
    </div>
  );
}
