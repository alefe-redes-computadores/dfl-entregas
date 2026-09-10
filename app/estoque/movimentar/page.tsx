// app/estoque/movimentar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamMemberPicker } from '@/components/team/TeamMemberPicker';
import {
  formatBRLCents,
  moneyToNumber,
} from '@/lib/money-input';
import {
  feedbackError,
  feedbackSuccess,
} from '@/lib/ui-feedback';
import { useAppStore } from '@/store/useAppStore';
import type { StockMovementType } from '@/types';

const options: Array<[StockMovementType, string, string]> = [
  ['entrada', 'Entrada', 'Compra ou reposição'],
  ['saida', 'Saída', 'Uso normal da operação'],
  ['perda', 'Perda', 'Descarte, vencimento ou avaria'],
  ['contagem', 'Contagem', 'Substitui o saldo pela contagem real'],
  ['ajuste', 'Ajuste', 'Define manualmente um novo saldo'],
];

const quantityNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

function Content() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const product = useAppStore((state) =>
    state.stockProducts.find((item) => item.id === id),
  );
  const add = useAppStore((state) => state.addStockMovement);

  const [type, setType] = useState<StockMovementType>('saida');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('R$ 0,00');
  const [reason, setReason] = useState('');
  const [memberId, setMemberId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  if (!product) {
    return (
      <PageHeader
        title="Produto não encontrado"
        to="/estoque"
      />
    );
  }

  const amount = quantityNumber(quantity);
  const allowsZero = type === 'contagem' || type === 'ajuste';
  const quantityInvalid =
    !Number.isFinite(amount) ||
    amount < 0 ||
    (!allowsZero && amount === 0) ||
    (!quantity.trim() && !allowsZero);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);

    if (quantityInvalid) {
      await feedbackError();
      document
        .getElementById('stock-movement-quantity')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      return;
    }

    if (busy) return;
    setBusy(true);

    try {
      await add({
        id: `move-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        product_id: product.id,
        product_name: product.name,
        type,
        quantity: amount,
        unit_cost:
          type === 'entrada' && moneyToNumber(cost) > 0
            ? moneyToNumber(cost)
            : undefined,
        reason: reason.trim() || undefined,
        team_member_id: memberId || undefined,
        team_member_name: memberName || undefined,
        occurred_at: new Date().toISOString(),
      });

      await feedbackSuccess();
      toast.success('Movimentação registrada.');
      router.replace(`/estoque/detalhes?id=${product.id}`);
    } catch (error) {
      console.error('Erro ao movimentar estoque:', error);
      await feedbackError();
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o estoque.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Movimentar estoque"
        subtitle={product.name}
        to={`/estoque/detalhes?id=${product.id}`}
      />

      <section className="mb-5 rounded-[24px] border border-emerald-500/20 bg-emerald-500/[.05] p-4">
        <p className="text-[10px] font-black uppercase text-emerald-400">
          Saldo atual
        </p>
        <p className="mt-2 font-heading text-3xl font-black text-zinc-100">
          {product.current_quantity.toLocaleString('pt-BR')}
        </p>
      </section>

      <form onSubmit={submit} className="space-y-5 pb-28" noValidate>
        <div className="grid grid-cols-2 gap-2">
          {options.map(([key, label, description]) => (
            <button
              type="button"
              key={key}
              onClick={() => {
                setType(key);
                setAttempted(false);
              }}
              className={`min-h-16 rounded-2xl border p-3 text-left ${
                type === key
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <b
                className={
                  type === key
                    ? 'text-emerald-400'
                    : 'text-zinc-300'
                }
              >
                {label}
              </b>
              <small className="mt-1 block text-[9px] text-zinc-600">
                {description}
              </small>
            </button>
          ))}
        </div>

        <label
          id="stock-movement-quantity"
          className="block text-xs font-bold text-zinc-400"
        >
          {type === 'contagem' || type === 'ajuste'
            ? 'Novo saldo*'
            : 'Quantidade*'}
          <input
            autoFocus
            inputMode="decimal"
            value={quantity}
            onChange={(event) =>
              setQuantity(
                event.target.value.replace(/[^0-9.,]/g, ''),
              )
            }
            aria-invalid={attempted && quantityInvalid}
            className={`mt-2 h-14 w-full rounded-2xl border bg-zinc-900 px-4 text-xl font-black text-zinc-100 outline-none ${
              attempted && quantityInvalid
                ? 'border-red-500/70 focus:border-red-500'
                : 'border-zinc-800 focus:border-emerald-500'
            }`}
            placeholder="0"
          />
          {attempted && quantityInvalid && (
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400">
              <AlertCircle size={12} />
              {allowsZero
                ? 'Informe um saldo válido, igual ou maior que zero.'
                : 'Informe uma quantidade maior que zero.'}
            </span>
          )}
        </label>

        {type === 'entrada' && (
          <label className="block text-xs font-bold text-zinc-400">
            Custo por unidade{' '}
            <span className="font-normal text-zinc-600">(opcional)</span>
            <input
              inputMode="numeric"
              value={cost}
              onChange={(event) =>
                setCost(formatBRLCents(event.target.value))
              }
              className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base font-bold text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        )}

        <div>
          <p className="mb-2 text-xs font-bold text-zinc-400">
            Responsável{' '}
            <span className="font-normal text-zinc-600">(opcional)</span>
          </p>
          <TeamMemberPicker
            value={memberId}
            onChange={(member) => {
              setMemberId(member.id);
              setMemberName(member.name);
            }}
          />
        </div>

        <label className="block text-xs font-bold text-zinc-400">
          Motivo / observação{' '}
          <span className="font-normal text-zinc-600">(opcional)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 outline-none focus:border-emerald-500"
          />
        </label>

        <button
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-40"
        >
          <Save size={18} />
          {busy ? 'Salvando...' : 'Confirmar movimentação'}
        </button>
      </form>
    </div>
  );
}

export default function StockMovementPage() {
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
