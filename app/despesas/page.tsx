// app/despesas/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike,
  ChevronRight,
  ReceiptText,
  Trash2,
  Wallet,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpenseType } from '@/types';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const labels: Record<OperationalExpenseType, string> = {
  motoboy: 'Motoboy',
  frete: 'Frete',
  manutencao: 'Manutenção',
  taxa: 'Taxa',
  outro: 'Outro',
};

const date = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

export default function ExpensesPage() {
  const router = useRouter();
  const expenses = useAppStore((state) => state.operationalExpenses);
  const remove = useAppStore((state) => state.deleteOperationalExpense);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(
    () =>
      [...expenses].sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      ),
    [expenses],
  );

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );

  const removeItem = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await remove(pendingDelete);
      toast.success('Despesa removida.');
      setPendingDelete(null);
    } catch {
      toast.error('Não foi possível remover a despesa.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <PageHeader
        title="Despesas operacionais"
        subtitle="Custos que não movimentam o estoque"
        to="/loja"
      />

      <section className="rounded-[26px] border border-amber-500/20 bg-amber-500/[.055] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-amber-300">
              <Wallet size={16} />
              <p className="text-[9px] font-black uppercase tracking-[.16em]">
                Total registrado
              </p>
            </div>
            <p className="mt-2 text-2xl font-black text-zinc-100">
              {money(total)}
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">
              Separado de compras físicas e do valor do estoque.
            </p>
          </div>

        </div>
      </section>

      <section className="space-y-2">
        {sorted.map((item) => {
          const Icon =
            item.type === 'motoboy'
              ? Bike
              : item.type === 'manutencao'
                ? Wrench
                : ReceiptText;

          return (
            <article
              key={item.id}
              className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Icon size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-zinc-100">
                      {item.description}
                    </p>
                    {item.source_kind === 'motoboy_settlement' && (
                      <span className="shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-sky-400">
                        Acerto
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {labels[item.type]} · {date(item.occurred_at)}
                  </p>
                  {item.observation && (
                    <p className="mt-1 truncate text-[10px] text-zinc-600">
                      {item.observation}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-amber-300">
                    {money(item.amount)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item.id)}
                    className="ml-auto mt-2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 active:scale-95"
                    aria-label="Excluir despesa"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!sorted.length && (
          <button
            type="button"
            onClick={() => router.push('/despesas/novo')}
            className="flex w-full flex-col items-center rounded-[24px] border border-dashed border-zinc-800 py-12 text-center active:bg-zinc-900/30"
          >
            <ReceiptText size={26} className="text-zinc-700" />
            <p className="mt-3 text-sm font-black text-zinc-400">
              Nenhuma despesa operacional registrada
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Toque aqui para lançar a primeira.
            </p>
            <span className="mt-3 flex items-center gap-1 text-[10px] font-black text-amber-400">
              Adicionar despesa
              <ChevronRight size={13} />
            </span>
          </button>
        )}
      </section>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <section
            className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-950 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-red-400">Excluir despesa</p>
            <h2 className="mt-2 text-lg font-black text-zinc-100">Remover este lançamento?</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              A despesa será removida do histórico operacional. Esta ação não altera o estoque.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}
                className="h-12 rounded-xl border border-zinc-800 text-sm font-bold text-zinc-400 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={deleting} onClick={removeItem}
                className="h-12 rounded-xl bg-red-500 text-sm font-black text-white disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
