// app/abastecimentos/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/operational-toast';
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
    if (busy) throw new Error('Compra já está sendo salva.');

    setBusy(true);

    const now = new Date().toISOString();
    const supply: StockSupply = {
      id: `supply-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      ...value,
      created_at: now,
      updated_at: now,
    };

    try {
      // Zustand atualiza de forma otimista, mas só navegamos após a gravação remota.
      // Caso falhe, a store reverte e o formulário preserva o rascunho.
      const operation = addStockSupply(supply);

      toast.loading('Compra registrada. Sincronizando...', {
        id: 'purchase-save',
      });

      await operation;
      void feedbackSuccess();

      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );

      toast.success('Compra sincronizada.', {
        id: 'purchase-save',
      });
    } catch (error) {
      console.error(
        'Erro ao registrar compra de estoque:',
        error,
      );

      void feedbackError();

      toast.error(
        'Compra não salva. Os dados do formulário foram mantidos.',
        { id: 'purchase-save' },
      );
      throw error;
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
