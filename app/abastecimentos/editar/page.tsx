// app/abastecimentos/editar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StockSupplyForm,
  type StockSupplyFormValue,
} from '@/components/stock-supplies/StockSupplyForm';
import { feedbackError, feedbackSuccess } from '@/lib/ui-feedback';
import { useAppStore } from '@/store/useAppStore';

function Content() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const supplies = useAppStore((state) => state.stockSupplies);
  const user = useAppStore((state) => state.user);
  const updateStockSupply = useAppStore(
    (state) => state.updateStockSupply,
  );
  const supply = supplies.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);

  if (!supply) {
    return (
      <PageHeader
        title="Compra não encontrada"
        to="/abastecimentos"
      />
    );
  }

  const save = async (value: StockSupplyFormValue) => {
    if (busy) return;

    setBusy(true);
    void feedbackSuccess();
    toast.loading('Salvando compra...', { id: 'purchase-save' });

    try {
      await updateStockSupply(supply.id, value);
      toast.success('Compra atualizada.', { id: 'purchase-save' });
      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );
    } catch (error) {
      console.error('Erro ao atualizar compra:', error);
      void feedbackError();
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a compra.',
        { id: 'purchase-save' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Editar compra"
        subtitle={`${supply.items.length} item${
          supply.items.length === 1 ? '' : 's'
        }`}
        to={`/abastecimentos/detalhes?id=${supply.id}`}
      />
      <StockSupplyForm
        initial={supply}
        defaultBuyerName={user?.displayName || 'Álefe'}
        busy={busy}
        submitLabel="Salvar alterações"
        onSubmit={save}
      />
    </div>
  );
}

export default function EditStockSupplyPage() {
  return (
    <Suspense
      fallback={
        <p className="py-20 text-center text-zinc-500">
          Carregando...
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
