// app/abastecimentos/editar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Undo2 } from 'lucide-react';
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

  if (supply.stock_integrated_at) {
    return (
      <div className="pb-28">
        <PageHeader
          title="Editar compra"
          subtitle="Compra já integrada"
          to={`/abastecimentos/detalhes?id=${supply.id}`}
        />

        <section className="rounded-[26px] border border-amber-500/25 bg-amber-500/[.06] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
              <AlertTriangle size={20} />
            </span>

            <div>
              <p className="font-heading text-base font-black text-zinc-100">
                Esta compra já alterou o estoque
              </p>

              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Itens, quantidades e valores não podem ser alterados
                enquanto a integração estiver ativa. Isso protege o saldo,
                o custo médio e o histórico das movimentações.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              router.replace(
                `/abastecimentos/detalhes?id=${supply.id}`,
              )
            }
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 text-sm font-black text-amber-400"
          >
            <Undo2 size={17} />
            Voltar e estornar integração
          </button>
        </section>
      </div>
    );
  }

  const save = async (value: StockSupplyFormValue) => {
    if (busy) return;

    setBusy(true);
    void feedbackSuccess();

    try {
      const operation = updateStockSupply(
        supply.id,
        value,
      );

      toast.loading(
        'Alterações aplicadas. Sincronizando...',
        { id: 'purchase-save' },
      );

      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );

      await operation;

      toast.success('Compra sincronizada.', {
        id: 'purchase-save',
      });
    } catch (error) {
      console.error(
        'Erro ao atualizar compra:',
        error,
      );

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
