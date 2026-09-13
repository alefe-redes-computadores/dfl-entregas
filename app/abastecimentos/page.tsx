// app/abastecimentos/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PackageOpen,

  Search,
  UserRound,
  Wallet,
  Boxes,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StockSupplierIcon } from '@/components/stock-supplies/StockSupplierIcon';
import {
  buildStockSupplyMetrics,
  money,
  SUPPLY_STATUS_LABELS,
  supplyDate,
  supplyTotal,
} from '@/lib/stock-supply';
import type { StockSupply, StockSupplyStatus } from '@/types';

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;

const dayKey = (item: StockSupply) => {
  const date = supplyDate(item);
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dayLabel = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

export default function StockSuppliesPage() {
  const router = useRouter();
  const supplies = useAppStore((state) => state.stockSupplies);
  const suppliers = useAppStore((state) => state.stockSuppliers);

  const [month, setMonth] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StockSupplyStatus | 'todos'>(
    'todos',
  );
  const [expandedDays, setExpandedDays] = useState<
    Record<string, boolean>
  >(() => ({ [todayKey()]: true }));

  const monthly = useMemo(
    () =>
      supplies.filter(
        (item) =>
          monthKey(supplyDate(item)) === monthKey(month),
      ),
    [month, supplies],
  );

  const normalizedQuery = query
    .trim()
    .toLocaleLowerCase('pt-BR');

  const filtered = useMemo(
    () =>
      monthly
        .filter((item) => {
          const haystack = `${item.supplier || ''} ${
            item.purchaser_name || ''
          } ${item.items
            .map((current) => current.name)
            .join(' ')}`.toLocaleLowerCase('pt-BR');

          return (
            (status === 'todos' || item.status === status) &&
            haystack.includes(normalizedQuery)
          );
        })
        .sort(
          (a, b) =>
            supplyDate(b).getTime() -
            supplyDate(a).getTime(),
        ),
    [monthly, normalizedQuery, status],
  );

  const days = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, StockSupply[]>>(
          (all, item) => {
            (all[dayKey(item)] ||= []).push(item);
            return all;
          },
          {},
        ),
      ).sort(([a], [b]) => b.localeCompare(a)),
    [filtered],
  );

  const metrics = useMemo(
    () => buildStockSupplyMetrics(monthly),
    [monthly],
  );

  const moveMonth = (direction: number) =>
    setMonth(
      (value) =>
        new Date(
          value.getFullYear(),
          value.getMonth() + direction,
          1,
        ),
    );

  const hasActiveSearch =
    Boolean(normalizedQuery) || status !== 'todos';

  return (
    <div className="dfl-page">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.replace('/loja')}
            className="dfl-icon-button h-11 w-11"
          >
            <ChevronLeft size={21} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-400">
              Histórico de aquisição
            </p>
            <h1 className="font-heading text-xl font-black text-zinc-100">
              Compras
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push('/estoque')}
          className="flex h-11 items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] px-3 text-xs font-black text-emerald-400 active:scale-95"
        >
          <Boxes size={16} />
          Estoque
        </button>
      </header>

      <section className="flex items-center justify-between rounded-[20px] border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <button
          onClick={() => moveMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <CalendarDays
            size={16}
            className="mx-auto text-amber-400"
          />
          <p className="mt-1 font-black capitalize text-zinc-100">
            {month.toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => moveMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"
        >
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="grid grid-cols-2 gap-2 rounded-[24px] border border-zinc-800/70 bg-zinc-900/25 p-2">
        <CompactMetric label="Gasto no mês" value={money(metrics.totalAmount)} />
        <CompactMetric label="Compras" value={String(metrics.count)} />
        <CompactMetric label="Itens" value={String(metrics.itemCount)} />
        <CompactMetric label="Aguardando ação" value={String(metrics.pendingCount + metrics.uncheckedCount)} alert={metrics.pendingCount + metrics.uncheckedCount > 0} />
      </section>

      <div className="relative">
        <Search
          size={19}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar produto, fornecedor ou comprador"
          className="dfl-search pl-11 pr-4 focus:border-amber-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            'todos',
            'solicitado',
            'em_compra',
            'recebido',
            'conferido',
          ] as const
        ).map((key) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black ${
              status === key
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            {key === 'todos'
              ? 'Todos'
              : SUPPLY_STATUS_LABELS[key]}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {days.map(([key, items]) => {
          const pending = items.filter(
            (item) => item.status !== 'conferido',
          ).length;
          const open =
            hasActiveSearch ||
            expandedDays[key] === true ||
            (expandedDays[key] === undefined &&
              key === todayKey());
          const dayTotal = items.reduce(
            (sum, item) => sum + supplyTotal(item),
            0,
          );

          return (
            <section
              key={key}
              className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40"
            >
              <button
                onClick={() =>
                  setExpandedDays((value) => ({
                    ...value,
                    [key]: !open,
                  }))
                }
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
                  <CalendarDays size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-sm font-black capitalize text-zinc-200">
                    {dayLabel(key)}
                  </h2>
                  <p className="mt-1 text-[9px] font-bold text-zinc-600">
                    {items.length}{' '}
                    {items.length === 1 ? 'compra' : 'compras'} ·{' '}
                    {money(dayTotal)}
                    {pending
                      ? ` · ${pending} aguardando ação`
                      : ''}
                  </p>
                </div>

                <ChevronDown
                  size={18}
                  className={`shrink-0 text-zinc-600 transition-transform ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {open && (
                <div className="border-t border-zinc-800/70">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        router.push(
                          `/abastecimentos/detalhes?id=${item.id}`,
                        )
                      }
                      className="flex w-full items-center gap-3 border-b border-zinc-800/70 p-4 text-left last:border-0 active:bg-zinc-800/50"
                    >
                      <StockSupplierIcon supplier={suppliers.find((supplier)=>supplier.id===item.supplier_id)} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-zinc-200">
                            {item.supplier || 'Compra de estoque'}
                          </p>
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-black text-amber-400">
                            {SUPPLY_STATUS_LABELS[item.status]}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-[10px] text-zinc-500">
                          {item.items
                            .slice(0, 2)
                            .map((current) => current.name)
                            .join(' • ')}
                          {item.items.length > 2
                            ? ` +${item.items.length - 2}`
                            : ''}
                        </p>

                        <p className="mt-1 text-[9px] text-zinc-700">
                          {supplyDate(item).toLocaleTimeString(
                            'pt-BR',
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}{' '}
                          · {item.items.length}{' '}
                          {item.items.length === 1 ? 'item' : 'itens'}
                          {item.status === 'em_compra'
                            ? ' · compra em andamento'
                            : item.status === 'recebido'
                              ? ' · aguardando conferência'
                              : item.stock_integrated_at
                                ? ' · estoque atualizado'
                                : ''}
                        </p>
                      </div>

                      <p className="shrink-0 text-xs font-black text-emerald-400">
                        {money(supplyTotal(item))}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {!days.length && (
          <div className="dfl-empty">
            <PackageOpen
              size={34}
              className="mx-auto text-zinc-700"
            />
            <p className="mt-3 text-sm font-bold text-zinc-400">
              Nenhuma compra encontrada
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CompactMetric({label,value,alert=false}:{label:string;value:string;alert?:boolean}){return <div className={`rounded-2xl border px-3.5 py-3 ${alert?'border-amber-500/25 bg-amber-500/[.055]':'border-zinc-800 bg-zinc-900/45'}`}><p className={`text-[9px] font-bold ${alert?'text-amber-400':'text-zinc-600'}`}>{label}</p><p className="mt-1 truncate text-base font-black text-zinc-100">{value}</p></div>}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4">
      <Icon size={15} className="text-amber-400" />
      <p className="mt-3 truncate font-heading text-lg font-black text-zinc-100">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold text-zinc-600">
        {label}
      </p>
    </div>
  );
}
