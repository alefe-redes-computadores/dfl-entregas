// components/fuelings/FuelingForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, Fuel, Gauge, MapPin, Save, UserRound, Bike } from 'lucide-react';
import type { Fueling, FuelType, Motoboy } from '@/types';
import { FUEL_LABELS } from '@/lib/fueling-analytics';

export interface FuelingFormValue {
  occurred_at: string;
  fuel_type: FuelType;
  total_amount: number;
  liters?: number;
  price_per_liter?: number;
  odometer_km?: number;
  station?: string;
  vehicle_label?: string;
  motoboy_id?: string;
  motoboy_name?: string;
  observation?: string;
}

interface Props {
  initial?: Fueling;
  motoboys: Motoboy[];
  busy?: boolean;
  submitLabel: string;
  onSubmit: (value: FuelingFormValue) => Promise<void>;
}

const toInputDateTime = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const parseDecimal = (value: string) => {
  const raw = value.trim().replace(/\s/g, '');
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : '';

  let normalized = raw;
  if (decimalSeparator === ',') {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (decimalSeparator === '.') {
    const dotCount = (raw.match(/\./g) || []).length;
    normalized = dotCount > 1 ? raw.replace(/\./g, '') : raw.replace(/,/g, '');
  } else {
    normalized = raw.replace(/[.,]/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const decimalInput = (value?: number) =>
  value === undefined || value === null ? '' : String(value).replace('.', ',');

export function FuelingForm({
  initial,
  motoboys,
  busy = false,
  submitLabel,
  onSubmit,
}: Props) {
  const [occurredAt, setOccurredAt] = useState(toInputDateTime(initial?.occurred_at));
  const [fuelType, setFuelType] = useState<FuelType>(initial?.fuel_type || 'gasolina_comum');
  const [total, setTotal] = useState(decimalInput(initial?.total_amount));
  const [liters, setLiters] = useState(decimalInput(initial?.liters));
  const [price, setPrice] = useState(decimalInput(initial?.price_per_liter));
  const [odometer, setOdometer] = useState(decimalInput(initial?.odometer_km));
  const [station, setStation] = useState(initial?.station || '');
  const [vehicle, setVehicle] = useState(initial?.vehicle_label || '');
  const [motoboyId, setMotoboyId] = useState(initial?.motoboy_id || '');
  const [observation, setObservation] = useState(initial?.observation || '');

  const selectedMotoboy = useMemo(
    () => motoboys.find((item) => item.id === motoboyId),
    [motoboyId, motoboys],
  );

  const computedTotal = useMemo(() => {
    const litersValue = parseDecimal(liters);
    const priceValue = parseDecimal(price);
    return litersValue > 0 && priceValue > 0 ? litersValue * priceValue : 0;
  }, [liters, price]);

  useEffect(() => {
    if (!total && computedTotal > 0) {
      setTotal(computedTotal.toFixed(2).replace('.', ','));
    }
  }, [computedTotal, total]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const totalAmount = parseDecimal(total);
    const litersValue = parseDecimal(liters);
    const priceValue = parseDecimal(price);
    const odometerValue = parseDecimal(odometer);

    if (!occurredAt || totalAmount <= 0) return;

    await onSubmit({
      occurred_at: new Date(occurredAt).toISOString(),
      fuel_type: fuelType,
      total_amount: totalAmount,
      liters: litersValue > 0 ? litersValue : undefined,
      price_per_liter: priceValue > 0 ? priceValue : undefined,
      odometer_km: odometerValue > 0 ? odometerValue : undefined,
      station: station.trim() || undefined,
      vehicle_label: vehicle.trim() || undefined,
      motoboy_id: selectedMotoboy?.id,
      motoboy_name: selectedMotoboy?.name,
      observation: observation.trim() || undefined,
    });
  };

  const field =
    'mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-500';

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-28">
      <section className="rounded-[26px] border border-amber-500/20 bg-amber-500/[.05] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Fuel size={20} />
          </div>
          <div>
            <p className="font-heading text-sm font-black text-zinc-100">Registro operacional</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Valor e data são essenciais. Os demais campos melhoram os indicadores futuros.
            </p>
          </div>
        </div>
      </section>

      <label className="text-xs font-bold text-zinc-400">
        Data e hora
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          className={field}
          required
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-400">Combustível</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(FUEL_LABELS) as [FuelType, string][]).map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setFuelType(key)}
              className={`rounded-xl border px-3 py-3 text-left text-xs font-bold ${
                fuelType === key
                  ? 'border-amber-500/45 bg-amber-500/10 text-amber-400'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-zinc-400">
          Valor total
          <input
            inputMode="decimal"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="50,00"
            className={field}
            required
          />
        </label>

        <label className="text-xs font-bold text-zinc-400">
          Litros
          <input
            inputMode="decimal"
            value={liters}
            onChange={(event) => setLiters(event.target.value)}
            placeholder="8,25"
            className={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-zinc-400">
          Preço por litro
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="6,09"
            className={field}
          />
        </label>

        <label className="text-xs font-bold text-zinc-400">
          Quilometragem
          <input
            inputMode="numeric"
            value={odometer}
            onChange={(event) => setOdometer(event.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="32540"
            className={field}
          />
        </label>
      </div>

      {computedTotal > 0 && (
        <button
          type="button"
          onClick={() => setTotal(computedTotal.toFixed(2).replace('.', ','))}
          className="flex items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/[.05] p-4 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-sky-400">
            <Calculator size={15} />
            Litros × preço
          </span>
          <strong className="text-sm text-zinc-100">
            R$ {computedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </strong>
        </button>
      )}

      <label className="text-xs font-bold text-zinc-400">
        Veículo / moto
        <div className="relative">
          <Bike size={15} className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-zinc-600" />
          <input
            value={vehicle}
            onChange={(event) => setVehicle(event.target.value)}
            placeholder="Ex.: Honda CG 160 / Moto da loja"
            className={`${field} pl-11`}
          />
        </div>
      </label>

      <div>
        <p className="mb-2 text-xs font-bold text-zinc-400">Responsável / motoboy</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setMotoboyId('')}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${
              !motoboyId
                ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            Não vincular
          </button>
          {motoboys.map((motoboy) => (
            <button
              type="button"
              key={motoboy.id}
              onClick={() => setMotoboyId(motoboy.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${
                motoboyId === motoboy.id
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}
            >
              <UserRound size={11} className="mr-1 inline" />
              {motoboy.name}
            </button>
          ))}
        </div>
      </div>

      <label className="text-xs font-bold text-zinc-400">
        Posto
        <div className="relative">
          <MapPin size={15} className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-zinc-600" />
          <input
            value={station}
            onChange={(event) => setStation(event.target.value)}
            placeholder="Nome do posto"
            className={`${field} pl-11`}
          />
        </div>
      </label>

      <label className="text-xs font-bold text-zinc-400">
        Observação
        <textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          rows={3}
          placeholder="Ex.: abastecimento antes da operação, viagem, manutenção..."
          className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />
      </label>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
        <div className="flex items-start gap-3">
          <Gauge size={17} className="mt-0.5 shrink-0 text-zinc-500" />
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Quilometragem e litros serão usados depois para estimar consumo e custo operacional,
            mas o sistema não inventará km/l quando a amostra não for suficiente.
          </p>
        </div>
      </div>

      <button
        disabled={busy || parseDecimal(total) <= 0 || !occurredAt}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"
      >
        <Save size={18} />
        {busy ? 'Salvando...' : submitLabel}
      </button>
    </form>
  );
}
