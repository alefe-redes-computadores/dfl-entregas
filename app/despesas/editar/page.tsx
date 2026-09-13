'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  BriefcaseBusiness,
  ChevronLeft,
  Ellipsis,
  Package,
  ReceiptText,
  Save,
  Truck,
  Utensils,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpenseType } from '@/types';

const OPTIONS: Array<{
  value: OperationalExpenseType;
  label: string;
  Icon: typeof Bike;
}> = [
  { value: 'motoboy', label: 'Motoboy', Icon: Bike },
  { value: 'frete', label: 'Frete', Icon: Truck },
  { value: 'manutencao', label: 'Manutenção', Icon: Wrench },
  { value: 'taxa', label: 'Taxa', Icon: ReceiptText },
  { value: 'alimentacao', label: 'Alimentação', Icon: Utensils },
  { value: 'servico', label: 'Serviço', Icon: BriefcaseBusiness },
  { value: 'material', label: 'Material', Icon: Package },
  { value: 'outro', label: 'Outro', Icon: Ellipsis },
];

function toLocalInput(value: string) {
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');

  const expense = useAppStore((state) =>
    state.operationalExpenses.find((item) => item.id === id),
  );
  const motoboys = useAppStore((state) => state.motoboys);
  const update = useAppStore((state) => state.updateOperationalExpense);

  const [type, setType] = useState<OperationalExpenseType>(
    expense?.type || 'outro',
  );
  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(
    expense ? String(expense.amount).replace('.', ',') : '',
  );
  const [occurredAt, setOccurredAt] = useState(
    expense ? toLocalInput(expense.occurred_at) : '',
  );
  const [motoboyId, setMotoboyId] = useState(expense?.motoboy_id || '');
  const [observation, setObservation] = useState(expense?.observation || '');
  const [saving, setSaving] = useState(false);

  const activeMotoboys = useMemo(
    () =>
      motoboys
        .filter((item) => item.active || item.id === expense?.motoboy_id)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [expense?.motoboy_id, motoboys],
  );

  if (!expense) {
    return (
      <div className="dfl-page">
        <p className="py-20 text-center text-sm font-bold text-zinc-500">
          Despesa não encontrada.
        </p>
      </div>
    );
  }

  if (expense.source_kind === 'motoboy_settlement') {
    return (
      <div className="dfl-page">
        <button
          type="button"
          onClick={() => router.replace('/despesas')}
          className="dfl-icon-button"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="dfl-empty">
          <ReceiptText size={30} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-black text-zinc-300">
            Acerto protegido
          </p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] text-zinc-600">
            Despesas geradas pelo acerto do motoboy preservam o vínculo histórico.
            Faça a correção no fluxo de acerto quando necessário.
          </p>
        </div>
      </div>
    );
  }

  const save = async () => {
    const numeric = Number(amount.replace(/\./g, '').replace(',', '.'));

    if (!description.trim()) {
      toast.error('Informe a descrição.');
      return;
    }

    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    const selectedMotoboy = motoboys.find((item) => item.id === motoboyId);

    setSaving(true);
    try {
      await update(expense.id, {
        type,
        description: description.trim(),
        amount: numeric,
        occurred_at: new Date(occurredAt).toISOString(),
        motoboy_id: selectedMotoboy?.id,
        motoboy_name: selectedMotoboy?.name,
        observation: observation.trim() || undefined,
      });

      toast.success('Despesa atualizada.');
      router.replace('/despesas');
    } catch (error) {
      toast.error('Não foi possível atualizar.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dfl-page">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/despesas')}
          className="dfl-icon-button"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-rose-400">
            Ajustar lançamento
          </p>
          <h1 className="font-heading text-xl font-black text-zinc-100">
            Editar despesa
          </h1>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-2">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setType(value);
              if (value !== 'motoboy' && value !== 'frete') {
                setMotoboyId('');
              }
            }}
            className={`rounded-[16px] border px-1 py-3 ${
              type === value
                ? 'border-rose-400/35 bg-rose-500/[.08] text-rose-300'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-600'
            }`}
          >
            <Icon size={15} className="mx-auto" />
            <span className="mt-1.5 block truncate text-[8px] font-black">
              {label}
            </span>
          </button>
        ))}
      </section>

      <section className="space-y-3 rounded-[24px] border border-zinc-800/80 bg-zinc-900/35 p-4">
        <Field label="Descrição">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="dfl-search px-3.5"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <input
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d.,]/g, ''))
              }
              inputMode="decimal"
              className="dfl-search px-3.5"
            />
          </Field>

          <Field label="Quando">
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="dfl-search px-2.5 text-[11px]"
            />
          </Field>
        </div>

        {(type === 'motoboy' || type === 'frete') && (
          <Field label="Motoboy relacionado">
            <select
              value={motoboyId}
              onChange={(event) => setMotoboyId(event.target.value)}
              className="dfl-search px-3.5"
            >
              <option value="">Sem vínculo</option>
              {activeMotoboys.map((motoboy) => (
                <option key={motoboy.id} value={motoboy.id}>
                  {motoboy.name}
                  {!motoboy.active ? ' · inativo (histórico)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Observação">
          <textarea
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-[16px] border border-zinc-800/80 bg-zinc-950/55 px-3.5 py-3 text-sm text-zinc-100 outline-none focus:border-rose-500/50"
          />
        </Field>
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-rose-500 text-sm font-black text-white disabled:opacity-50"
      >
        <Save size={17} />
        {saving ? 'Salvando...' : 'Salvar alterações'}
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
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function EditExpensePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-zinc-600">Carregando...</div>
      }
    >
      <Content />
    </Suspense>
  );
}
