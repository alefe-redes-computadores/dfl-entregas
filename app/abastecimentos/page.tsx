// app/abastecimentos/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  Edit3,
  Fuel,
  Gauge,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import {
  buildFuelingMetrics,
  FUEL_LABELS,
  fuelingDate,
  money,
  numberPt,
  operationalMonthKey,
} from '@/lib/fueling-analytics';
import type { FuelType } from '@/types';

type FuelFilter = 'all' | FuelType;

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

export default function FuelingsPage() {
  const router = useRouter();
  const fuelings = useAppStore((state) => state.fuelings);
  const deleteFueling = useAppStore((state) => state.deleteFueling);

  const [month, setMonth] = useState(() => operationalMonthKey(new Date()));
  const [fuel, setFuel] = useState<FuelFilter>('all');
  const [query, setQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const monthItems = useMemo(
    () =>
      fuelings.filter(
        (item) => operationalMonthKey(fuelingDate(item)) === month,
      ),
    [fuelings, month],
  );

  const metrics = useMemo(() => buildFuelingMetrics(monthItems), [monthItems]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');

    return [...monthItems]
      .filter((item) => fuel === 'all' || item.fuel_type === fuel)
      .filter((item) => {
        if (!term) return true;
        return [
          item.station,
          item.vehicle_label,
          item.motoboy_name,
          item.observation,
          FUEL_LABELS[item.fuel_type],
        ]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(term);
      })
      .sort((a, b) => fuelingDate(b).getTime() - fuelingDate(a).getTime());
  }, [fuel, monthItems, query]);

  const shiftMonth = (delta: number) => {
    const [year, monthValue] = month.split('-').map(Number);
    const next = new Date(year, monthValue - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }
      await deleteFueling(deleteId);
      setDeleteId(null);
      toast.success('Abastecimento excluído.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível excluir o abastecimento.');
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace('/loja')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
            Custo operacional
          </p>
          <h1 className="truncate font-heading text-xl font-black text-zinc-50">
            Abastecimentos
          </h1>
        </div>
        <button
          onClick={() => router.push('/abastecimentos/novo')}
          className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-zinc-950 active:scale-95"
        >
          <Plus size={16} />
          Novo
        </button>
      </header>

      <section className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <CalendarDays size={15} className="text-amber-400" />
          <span className="truncate text-sm font-black capitalize text-zinc-100">
            {monthLabel(month)}
          </span>
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"
        >
          <ChevronLeft size={17} className="rotate-180" />
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Gasto no mês" value={money(metrics.totalAmount)} icon={Fuel} />
        <Metric label="Litros registrados" value={`${numberPt(metrics.liters)} L`} icon={Gauge} />
        <Metric
          label="Preço médio / L"
          value={metrics.avgPricePerLiter ? money(metrics.avgPricePerLiter) : 'Sem amostra'}
          icon={Fuel}
        />
        <Metric
          label="Abastecimentos"
          value={String(metrics.count)}
          icon={CalendarDays}
        />
      </div>

      <div className="relative">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar posto, moto, motoboy..."
          className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-500/40"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFuel('all')}
          className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${
            fuel === 'all'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500'
          }`}
        >
          Todos
        </button>
        {(Object.entries(FUEL_LABELS) as [FuelType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFuel(key)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${
              fuel === key
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <Fuel size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-zinc-100">{FUEL_LABELS[item.fuel_type]}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {fuelingDate(item).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </p>
                  </div>
                  <p className="text-base font-black text-amber-400">
                    {money(item.total_amount)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-zinc-500">
                  {item.liters ? (
                    <span className="rounded-lg bg-zinc-950/60 px-2 py-1">
                      {numberPt(item.liters)} L
                    </span>
                  ) : null}
                  {item.price_per_liter ? (
                    <span className="rounded-lg bg-zinc-950/60 px-2 py-1">
                      {money(item.price_per_liter)}/L
                    </span>
                  ) : null}
                  {item.odometer_km ? (
                    <span className="rounded-lg bg-zinc-950/60 px-2 py-1">
                      {numberPt(item.odometer_km, 0)} km
                    </span>
                  ) : null}
                </div>

                {(item.vehicle_label || item.motoboy_name || item.station) && (
                  <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
                    {item.vehicle_label && <p>{item.vehicle_label}</p>}
                    {item.motoboy_name && (
                      <p className="flex items-center gap-1">
                        <UserRound size={11} />
                        {item.motoboy_name}
                      </p>
                    )}
                    {item.station && <p>{item.station}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-800/70 pt-3">
              <button
                onClick={() => router.push(`/abastecimentos/editar?id=${item.id}`)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300"
              >
                <Edit3 size={14} />
                Editar
              </button>
              <button
                onClick={() => setDeleteId(item.id)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[.05] text-xs font-bold text-red-400"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </article>
        ))}

        {!filtered.length && (
          <div className="rounded-[28px] border border-dashed border-zinc-800 py-14 text-center">
            <Fuel size={34} className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-bold text-zinc-400">
              Nenhum abastecimento encontrado
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Registre o primeiro custo de combustível deste período.
            </p>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="font-heading text-lg font-black text-zinc-100">
              Excluir abastecimento?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              O registro será removido do histórico operacional e do Firebase.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="h-12 rounded-xl bg-zinc-800 text-sm font-bold text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="h-12 rounded-xl bg-red-500 text-sm font-black text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Fuel;
}) {
  return (
    <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4">
      <Icon size={15} className="text-amber-400" />
      <p className="mt-3 truncate font-heading text-lg font-black text-zinc-100">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-zinc-600">{label}</p>
    </div>
  );
}
