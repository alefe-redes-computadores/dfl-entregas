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
      /*
       * addStockSupply altera o Zustand antes do Firestore.
       * Podemos abrir os detalhes imediatamente sem fingir
       * que a persistência já terminou.
       */
      const operation = addStockSupply(supply);

      void feedbackSuccess();

      toast.loading('Compra registrada. Sincronizando...', {
        id: 'purchase-save',
      });

      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );

      await operation;

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
        'A compra não pôde ser sincronizada e foi desfeita.',
        { id: 'purchase-save' },
      );
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
