// app/entregas/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { fulfillmentLabel, getFulfillmentMode, isDeliveryFulfillment } from '@/lib/delivery-mode';
import type { FulfillmentMode } from '@/types';

type StatusFilter = 'todas' | 'pendentes' | 'concluidas' | 'incompletas';
type OriginFilter = 'todas' | 'ifood' | 'loja';
type FulfillmentFilter = 'todas' | FulfillmentMode;
type DatedDelivery = { created_at?: string; createdAt?: string; updated_at?: string };

const createdAt = (delivery: DatedDelivery) =>
  delivery.created_at || delivery.createdAt || delivery.updated_at || '';

const dateKey = (value: Date | string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

const todayKey = () => dateKey(new Date());
const fromKey = (key: string) => new Date(`${key}T12:00:00-03:00`);
const shiftDay = (key: string, amount: number) => {
  const value = fromKey(key);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
};
const dayLabel = (key: string) =>
  key === todayKey()
    ? 'Hoje'
    : fromKey(key)
        .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
        .replaceAll('.', '');

const normalize = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const fulfillmentMeta = (mode: FulfillmentMode) => {
  if (mode === 'pickup') {
    return {
      Icon: ShoppingBag,
      badge: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
      compact: 'Retirada',
    };
  }

  if (mode === 'counter') {
    return {
      Icon: Store,
      badge: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
      compact: 'Balcão',
    };
  }

  return {
    Icon: Bike,
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
    compact: 'Entrega',
  };
};

export default function DeliveriesPage() {
  const router = useRouter();
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarMonth, setCalendarMonth] = useState(() => fromKey(todayKey()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todas');
  const [origin, setOrigin] = useState<OriginFilter>('todas');
  const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('todas');

  const dayDeliveries = useMemo(
    () =>
      deliveries.filter((delivery) => {
        const value = createdAt(delivery);
        return value ? dateKey(value) === selectedDate : false;
      }),
    [deliveries, selectedDate],
  );

  const rows = useMemo(
    () =>
      dayDeliveries
        .map((delivery) => {
          const route = routes.find((item) => item.id === delivery.route_id);
          const customer = customers.find((item) => item.id === delivery.customer_id);
          const mode = getFulfillmentMode(delivery);
          const logistics = isDeliveryFulfillment(delivery);

          const incomplete =
            (logistics && (!delivery.route_id || !route || !delivery.address_string)) ||
            (delivery.origin === 'ifood' && !delivery.order_id);

          const haystack = normalize(
            [
              customer?.name,
              delivery.customer_name,
              customer?.phone,
              delivery.phone,
              delivery.address_string,
              delivery.order_id,
              delivery.ifood_id,
              delivery.confirmation_code,
              route?.name,
              route?.motoboy_name,
              fulfillmentLabel(delivery),
            ].join(' '),
          );

          return { delivery, route, customer, incomplete, haystack, mode, logistics };
        })
        .filter(({ delivery, incomplete, haystack, mode }) => {
          const matchesStatus =
            status === 'todas' ||
            (status === 'pendentes' && !delivery.completed) ||
            (status === 'concluidas' && delivery.completed) ||
            (status === 'incompletas' && incomplete);

          const matchesOrigin = origin === 'todas' || delivery.origin === origin;
          const matchesFulfillment = fulfillment === 'todas' || mode === fulfillment;
          const matchesQuery = !query.trim() || haystack.includes(normalize(query));

          return matchesStatus && matchesOrigin && matchesFulfillment && matchesQuery;
        })
        .sort(
          (a, b) =>
            new Date(createdAt(a.delivery)).getTime() - new Date(createdAt(b.delivery)).getTime(),
        ),
    [customers, dayDeliveries, fulfillment, origin, query, routes, status],
  );

  const totals = useMemo(
    () => ({
      all: dayDeliveries.length,
      pending: dayDeliveries.filter((item) => !item.completed).length,
      completed: dayDeliveries.filter((item) => item.completed).length,
    }),
    [dayDeliveries],
  );

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarMonth]);

  const datesWithDeliveries = useMemo(
    () => new Set(deliveries.map(createdAt).filter(Boolean).map(dateKey)),
    [deliveries],
  );

  const selectDate = (key: string) => {
    setSelectedDate(key);
    setStatus('todas');
    setCalendarOpen(false);
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => router.replace('/loja')}
            aria-label="Voltar para Minha Loja"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">
              Operação diária
            </p>
            <h1 className="font-heading text-2xl font-bold text-zinc-50">Pedidos</h1>
          </div>
        </div>

        <button
          onClick={() => router.push('/entregas/nova')}
          className="flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-black text-zinc-950 active:scale-95"
        >
          <Plus size={18} />
          Novo
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-2">
        <button
          onClick={() => setSelectedDate((value) => shiftDay(value, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"
        >
          <ChevronLeft size={21} />
        </button>

        <button
          onClick={() => {
            setCalendarMonth(fromKey(selectedDate));
            setCalendarOpen(true);
          }}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-800/75 px-3"
        >
          <CalendarDays size={17} className="text-amber-400" />
          <span className="truncate text-sm font-black capitalize text-zinc-100">
            {dayLabel(selectedDate)}
          </span>
        </button>

        <button
          onClick={() => setSelectedDate((value) => shiftDay(value, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-zinc-500 active:bg-zinc-800"
        >
          <ChevronRight size={21} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Package} label="Pedidos" value={totals.all} color="text-sky-400" />
        <Metric icon={Clock3} label="Pendentes" value={totals.pending} color="text-amber-400" />
        <Metric
          icon={CheckCircle2}
          label="Concluídos"
          value={totals.completed}
          color="text-emerald-400"
        />
      </div>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar neste dia"
          className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm outline-none focus:border-amber-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <Filter size={16} className="mt-2.5 shrink-0 text-zinc-600" />
        {(
          [
            ['todas', 'Todas'],
            ['pendentes', 'Pendentes'],
            ['concluidas', 'Concluídos'],
            ['incompletas', 'Com atenção'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold ${
              status === value
                ? 'bg-zinc-100 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-900/50 text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ['todas', 'Todos'],
            ['delivery', 'Entrega'],
            ['pickup', 'Retirada'],
            ['counter', 'Balcão'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFulfillment(value)}
            className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${
              fulfillment === value
                ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                : 'border-zinc-800 text-zinc-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['todas', 'ifood', 'loja'] as OriginFilter[]).map((value) => (
          <button
            key={value}
            onClick={() => setOrigin(value)}
            className={`rounded-xl border py-2 text-xs font-bold ${
              origin === value
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-zinc-800 text-zinc-500'
            }`}
          >
            {value === 'todas' ? 'Origem: todas' : value === 'ifood' ? 'iFood' : 'Loja'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(({ delivery, route, customer, incomplete, mode, logistics }) => {
          const meta = fulfillmentMeta(mode);
          const ModeIcon = meta.Icon;

          return (
            <button
              key={delivery.id}
              onClick={() => router.push(`/entregas/details?id=${delivery.id}`)}
              className="w-full rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    delivery.origin === 'ifood'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  {delivery.origin === 'ifood' ? <Smartphone size={19} /> : <Store size={19} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-zinc-100">
                      {customer?.name || delivery.customer_name || 'Cliente não informado'}
                    </p>
                    {incomplete && (
                      <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                    )}
                  </div>

                  {logistics ? (
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      <MapPin size={11} className="mr-1 inline" />
                      {delivery.address_string || 'Endereço ausente'}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">
                      {mode === 'pickup'
                        ? 'Cliente retira o pedido na loja'
                        : 'Atendimento presencial / balcão'}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}
                    >
                      <ModeIcon size={10} />
                      {meta.compact}
                    </span>

                    {logistics && (
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                        {route?.name || 'Sem rota'}
                      </span>
                    )}

                    {logistics && route?.motoboy_name && (
                      <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-400">
                        <UserRound size={10} className="mr-1 inline" />
                        {route.motoboy_name}
                      </span>
                    )}

                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        delivery.completed
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {delivery.completed ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-emerald-400">
                    R${' '}
                    {(delivery.value || 0).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <ChevronRight size={16} className="ml-auto mt-3 text-zinc-600" />
                </div>
              </div>
            </button>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-800 py-14 text-center">
            <Package className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-semibold text-zinc-400">
              Nenhum pedido em {dayLabel(selectedDate).toLowerCase()}.
            </p>
            {selectedDate !== todayKey() && (
              <button
                onClick={() => selectDate(todayKey())}
                className="mt-3 text-xs font-bold text-amber-400"
              >
                Voltar para hoje
              </button>
            )}
          </div>
        )}
      </div>

      {calendarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setCalendarOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <CalendarButton
                onClick={() =>
                  setCalendarMonth(
                    (value) => new Date(value.getFullYear(), value.getMonth() - 1, 1),
                  )
                }
                icon={ChevronLeft}
              />
              <div className="text-center">
                <p className="font-heading text-base font-black capitalize text-zinc-100">
                  {calendarMonth.toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <button
                  onClick={() => selectDate(todayKey())}
                  className="text-[10px] font-bold uppercase tracking-wider text-amber-400"
                >
                  Ir para hoje
                </button>
              </div>
              <CalendarButton
                onClick={() =>
                  setCalendarMonth(
                    (value) => new Date(value.getFullYear(), value.getMonth() + 1, 1),
                  )
                }
                icon={ChevronRight}
              />
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-600">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => (
                <span key={`${label}-${index}`} className="pb-2">
                  {label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const active = key === selectedDate;
                const current = day.getMonth() === calendarMonth.getMonth();

                return (
                  <button
                    key={key}
                    onClick={() => selectDate(key)}
                    className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-bold ${
                      active
                        ? 'bg-amber-500 text-zinc-950'
                        : key === todayKey()
                          ? 'bg-amber-500/10 text-amber-400'
                          : current
                            ? 'text-zinc-300'
                            : 'text-zinc-700'
                    }`}
                  >
                    {day.getDate()}
                    {datesWithDeliveries.has(key) && (
                      <span
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          active ? 'bg-zinc-950' : 'bg-amber-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCalendarOpen(false)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-400"
            >
              <X size={15} />
              Fechar calendário
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
      <Icon size={15} className={color} />
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="truncate text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

function CalendarButton({
  onClick,
  icon: Icon,
}: {
  onClick: () => void;
  icon: typeof ChevronLeft;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400"
    >
      <Icon size={19} />
    </button>
  );
}
