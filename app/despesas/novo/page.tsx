// app/despesas/novo/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Truck,
  Wrench,
  BadgeDollarSign,
  MoreHorizontal,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import type { OperationalExpenseType } from '@/types';
import { dateFromKey, dateKey, shiftDateKey } from '@/lib/operational-time';

const TYPES: Array<{
  value: OperationalExpenseType;
  label: string;
  hint: string;
  icon: typeof Bike;
}> = [
  { value: 'motoboy', label: 'Motoboy', hint: 'Diária ou custo ligado a um entregador', icon: Bike },
  { value: 'frete', label: 'Frete', hint: 'Transporte ou deslocamento operacional', icon: Truck },
  { value: 'manutencao', label: 'Manutenção', hint: 'Equipamento, estrutura ou reparo', icon: Wrench },
  { value: 'taxa', label: 'Taxa', hint: 'Tarifa ou cobrança operacional', icon: BadgeDollarSign },
  { value: 'outro', label: 'Outro', hint: 'Outro custo fora do estoque', icon: MoreHorizontal },
];

const moneyFromDigits = (digits: string) => {
  const cents = Number(digits || '0');
  return cents / 100;
};

const moneyMask = (digits: string) =>
  moneyFromDigits(digits).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export default function NewExpensePage() {
  const router = useRouter();
  const add = useAppStore((state) => state.addOperationalExpense);
  const motoboys = useAppStore((state) => state.motoboys);
  const expenses = useAppStore((state) => state.operationalExpenses);

  const [type, setType] = useState<OperationalExpenseType>('outro');
  const [description, setDescription] = useState('');
  const [amountDigits, setAmountDigits] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => dateKey(new Date()));
  const [observation, setObservation] = useState('');
  const [motoboyId, setMotoboyId] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [motoboyOpen, setMotoboyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedMotoboy = motoboys.find((item) => item.id === motoboyId);
  const amount = moneyFromDigits(amountDigits);
  const selectedDate = dateFromKey(occurredAt);

  const settlementAlreadyExists = useMemo(() => {
    if (!motoboyId || type !== 'motoboy') return false;
    return expenses.some(
      (item) => item.source_id === `motoboy:${motoboyId}:${occurredAt}`,
    );
  }, [expenses, motoboyId, occurredAt, type]);

  const selectType = (value: OperationalExpenseType) => {
    setType(value);
    if (value !== 'motoboy') setMotoboyId('');
    if (!description.trim()) {
      const label = TYPES.find((item) => item.value === value)?.label;
      setDescription(label || '');
    }
  };

  const save = async () => {
    const cleanDescription = description.trim();

    if (cleanDescription.length < 2) {
      toast.error('Informe uma descrição.');
      return;
    }
    if (amount <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    if (type === 'motoboy' && !selectedMotoboy) {
      toast.error('Selecione o entregador.');
      return;
    }
    if (settlementAlreadyExists) {
      toast.error('A diária deste entregador já foi lançada pelo acerto.', {
        description: 'Evitei registrar o mesmo custo duas vezes.',
      });
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
        amount,
        motoboy_id: selectedMotoboy?.id,
        motoboy_name: selectedMotoboy?.name,
        source_kind: 'manual',
        observation: observation.trim() || undefined,
        created_at: now,
        updated_at: now,
      });

      toast.success('Despesa operacional registrada.');
      router.replace('/despesas');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível registrar a despesa.',
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

      <section className="rounded-[22px] border border-amber-500/20 bg-amber-500/[.045] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
            <ReceiptText size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-100">Lançamento operacional</p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Estoque continua em Compras. Aqui entram custos de operação, com vínculo real ao entregador quando necessário.
            </p>
          </div>
        </div>
      </section>

      <Field label="Categoria">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((item) => {
            const Icon = item.icon;
            const active = type === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => selectType(item.value)}
                className={`rounded-2xl border p-3 text-left ${
                  active
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/45'
                }`}
              >
                <Icon size={16} className={active ? 'text-amber-400' : 'text-zinc-600'} />
                <p className="mt-2 text-xs font-black text-zinc-200">{item.label}</p>
                <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-zinc-600">
                  {item.hint}
                </p>
              </button>
            );
          })}
        </div>
      </Field>

      {type === 'motoboy' && (
        <Field label="Entregador">
          <button
            type="button"
            onClick={() => setMotoboyOpen(true)}
            className="flex h-12 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-left"
          >
            <span className="flex items-center gap-2">
              <UserRound size={16} className="text-sky-400" />
              <span className={selectedMotoboy ? 'text-sm font-bold text-zinc-200' : 'text-sm text-zinc-600'}>
                {selectedMotoboy?.name || 'Selecionar entregador'}
              </span>
            </span>
            <ChevronRight size={16} className="text-zinc-600" />
          </button>

          {settlementAlreadyExists && (
            <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/[.05] px-3 py-2 text-[10px] text-red-300">
              A diária deste entregador nesta data já foi lançada pelo Acerto. Um segundo lançamento seria duplicado.
            </p>
          )}
        </Field>
      )}

      <Field label="Descrição">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={
            type === 'motoboy'
              ? 'Ex.: Diária do entregador'
              : type === 'manutencao'
                ? 'Ex.: Manutenção da chapa'
                : 'Descreva a despesa'
          }
          className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-sm outline-none focus:border-amber-500"
        />
      </Field>

      <Field label="Valor">
        <input
          value={moneyMask(amountDigits)}
          onChange={(event) => setAmountDigits(event.target.value.replace(/\D/g, '').slice(0, 10))}
          inputMode="numeric"
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-xl font-black text-amber-300 outline-none focus:border-amber-500"
        />
      </Field>

      <Field label="Data">
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="flex h-12 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <CalendarDays size={16} className="text-amber-400" />
            {selectedDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <ChevronRight size={16} className="text-zinc-600" />
        </button>
      </Field>

      <Field label="Observação">
        <textarea
          rows={4}
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          placeholder="Detalhes opcionais"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm outline-none focus:border-amber-500"
        />
      </Field>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 active:scale-[.98] disabled:opacity-50"
      >
        <Check size={18} />
        {busy ? 'Salvando...' : 'Salvar despesa'}
      </button>

      {motoboyOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/75 p-3 backdrop-blur-sm"
          onClick={() => setMotoboyOpen(false)}
        >
          <section
            className="w-full rounded-[28px] border border-zinc-800 bg-zinc-950 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                Entregador
              </p>
              <h2 className="mt-1 text-lg font-black text-zinc-100">Vincular despesa</h2>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {motoboys.map((motoboy) => (
                <button
                  key={motoboy.id}
                  type="button"
                  onClick={() => {
                    setMotoboyId(motoboy.id);
                    setMotoboyOpen(false);
                    if (!description.trim() || description === 'Motoboy') {
                      setDescription(`Diária de motoboy · ${motoboy.name}`);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3 text-left"
                >
                  <span>
                    <strong className="block text-sm text-zinc-200">{motoboy.name}</strong>
                    <span className="mt-0.5 block text-[10px] text-zinc-600">
                      {motoboy.active ? 'Ativo / escalado' : 'Fora da escala'}
                    </span>
                  </span>
                  <ChevronRight size={15} className="text-zinc-600" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {calendarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setCalendarOpen(false)}
        >
          <section
            className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-950 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOccurredAt((key) => shiftDateKey(key, -1))}
                className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-zinc-400"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  Data da despesa
                </p>
                <p className="mt-1 text-sm font-black text-zinc-100">
                  {dateFromKey(occurredAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOccurredAt((key) => shiftDateKey(key, 1))}
                className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-zinc-400"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setOccurredAt(dateKey(new Date()));
                setCalendarOpen(false);
              }}
              className="mt-4 h-11 w-full rounded-xl bg-amber-500/10 text-xs font-black text-amber-400"
            >
              Usar hoje
            </button>

            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              className="mt-2 h-11 w-full rounded-xl bg-zinc-900 text-xs font-black text-zinc-400"
            >
              Confirmar data
            </button>
          </section>
        </div>
      )}
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
    <section>
      <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">
        {label}
      </p>
      {children}
    </section>
  );
}
