// app/despesas/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpenseType } from '@/types';
import { dateKey } from '@/lib/operational-time';

const types: Array<[OperationalExpenseType, string]> = [
  ['motoboy', 'Motoboy / diária'],
  ['frete', 'Frete / transporte'],
  ['manutencao', 'Manutenção'],
  ['taxa', 'Taxa'],
  ['outro', 'Outro'],
];

const parseMoney = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function NewExpensePage() {
  const router = useRouter();
  const add = useAppStore((state) => state.addOperationalExpense);

  const [type, setType] = useState<OperationalExpenseType>('outro');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => dateKey(new Date()));
  const [observation, setObservation] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cleanDescription = description.trim();
    const cleanAmount = parseMoney(amount);

    if (cleanDescription.length < 2) {
      toast.error('Informe uma descrição.');
      return;
    }

    if (cleanAmount <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }

    setBusy(true);
    try {
      const now = new Date().toISOString();

      await add({
        id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        occurred_at: `${occurredAt}T12:00:00-03:00`,
        type,
        description: cleanDescription,
        amount: cleanAmount,
        source_kind: 'manual',
        observation: observation.trim() || undefined,
        created_at: now,
        updated_at: now,
      });

      toast.success('Despesa operacional registrada.');
      router.replace('/despesas');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a despesa.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <PageHeader
        title="Nova despesa"
        subtitle="Custo operacional fora do estoque"
        to="/despesas"
      />

      <section className="rounded-[26px] border border-amber-500/20 bg-amber-500/[.05] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <ReceiptText size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-100">
              Lançamento operacional
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Compras de estoque continuam em Compras e reposições. Use esta tela
              para taxas, manutenção, fretes e outros custos da operação.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <Field label="Tipo">
          <select
            value={type}
            onChange={(event) =>
              setType(event.target.value as OperationalExpenseType)
            }
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-amber-500"
          >
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descrição">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex.: Troca da lâmpada da cozinha"
            className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-amber-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-amber-500"
            />
          </Field>

          <Field label="Data">
            <input
              type="date"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-amber-500"
            />
          </Field>
        </div>

        <Field label="Observação">
          <textarea
            rows={4}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Detalhes opcionais"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm outline-none focus:border-amber-500"
          />
        </Field>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 active:scale-[.98] disabled:opacity-50"
      >
        <Check size={18} />
        {busy ? 'Salvando...' : 'Salvar despesa'}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
