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
  SlidersHorizontal,
  X,
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
  const [status, setStatus] = useState<StockSupplyStatus | 'todos'>('todos');
  const [buyer, setBuyer] = useState('todos');
  const [supplierFilter, setSupplierFilter] = useState('todos');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionOnly, setActionOnly] = useState(false);
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
            (!actionOnly || item.status !== 'conferido') &&
            (buyer === 'todos' || item.purchaser_name === buyer) &&
            (supplierFilter === 'todos' || item.supplier === supplierFilter) &&
            haystack.includes(normalizedQuery)
          );
        })
        .sort(
          (a, b) =>
            supplyDate(b).getTime() -
            supplyDate(a).getTime(),
        ),
    [actionOnly, buyer, monthly, normalizedQuery, status, supplierFilter],
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

  const buyers = useMemo(
    () => [...new Set(monthly.map((item) => item.purchaser_name).filter((value): value is string => Boolean(value)))].sort((a,b)=>a.localeCompare(b,'pt-BR')),
    [monthly],
  );
  const supplierNames = useMemo(
    () => [...new Set(monthly.map((item) => item.supplier).filter((value): value is string => Boolean(value)))].sort((a,b)=>a.localeCompare(b,'pt-BR')),
    [monthly],
  );
  const activeFilterCount =
    Number(status !== 'todos') +
    Number(buyer !== 'todos') +
    Number(supplierFilter !== 'todos');
  const hasActiveSearch =
    Boolean(normalizedQuery) ||
    activeFilterCount > 0 ||
    actionOnly;

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
        <CompactMetric
          label="Gasto no mês"
          value={money(metrics.totalAmount)}
          onClick={() => {
            setActionOnly(false);
            setStatus('todos');
          }}
        />

        <CompactMetric
          label="Compras"
          value={String(metrics.count)}
          onClick={() => {
            setActionOnly(false);
            setStatus('todos');
          }}
        />

        <CompactMetric
          label="Itens"
          value={String(metrics.itemCount)}
          onClick={() => {
            setActionOnly(false);
            setStatus('todos');
          }}
        />

        <CompactMetric
          label="Aguardando ação"
          value={String(
            metrics.pendingCount +
            metrics.uncheckedCount
          )}
          alert={
            metrics.pendingCount +
              metrics.uncheckedCount >
            0
          }
          active={actionOnly}
          onClick={() => {
            setActionOnly((value) => !value);
            setStatus('todos');
          }}
        />
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`flex h-11 items-center gap-2 rounded-[14px] border px-3.5 text-[10px] font-black ${
            activeFilterCount
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-zinc-800 bg-zinc-900/45 text-zinc-500'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {activeFilterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[8px] text-zinc-950">
              {activeFilterCount}
            </span>
          )}
        </button>
        {(activeFilterCount > 0 || actionOnly) && (
          <button
            type="button"
            onClick={() => {
              setStatus('todos');
              setBuyer('todos');
              setSupplierFilter('todos');
              setActionOnly(false);
            }}
            className="h-11 rounded-[14px] px-3 text-[10px] font-black text-zinc-600"
          >
            Limpar
          </button>
        )}
      </div>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/75 p-3 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}
        >
          <section className="dfl-bottom-sheet mx-auto w-full max-w-md p-5 pb-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-amber-400">Compras</p>
                <h2 className="mt-1 font-heading text-lg font-black text-zinc-100">Filtrar histórico</h2>
              </div>
              <button onClick={() => setFiltersOpen(false)} className="dfl-icon-button"><X size={17} /></button>
            </div>

            <PurchaseFilter label="Situação" value={status} setValue={(value)=>setStatus(value as StockSupplyStatus | 'todos')} options={[
              ['todos','Todas'],['solicitado','Solicitado'],['em_compra','Em compra'],['recebido','Recebido'],['conferido','Conferido']
            ]} />
            <PurchaseFilter label="Comprador" value={buyer} setValue={setBuyer} options={[['todos','Todos'],...buyers.map((value)=>[value,value] as [string,string])]} />
            <PurchaseFilter label="Fornecedor" value={supplierFilter} setValue={setSupplierFilter} options={[['todos','Todos'],...supplierNames.map((value)=>[value,value] as [string,string])]} />

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setStatus('todos'); setBuyer('todos'); setSupplierFilter('todos'); }} className="h-12 rounded-xl border border-zinc-800 text-xs font-black text-zinc-500">Limpar</button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="h-12 rounded-xl bg-amber-500 text-xs font-black text-zinc-950">Aplicar</button>
            </div>
          </section>
        </div>
      )}

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

          const isToday = key === todayKey();

          return (
            <section
              key={key}
              className={`overflow-hidden rounded-[24px] border ${
                isToday
                  ? 'border-emerald-500/25 bg-emerald-500/[.045]'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
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
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  isToday
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  <CalendarDays size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className={`font-heading text-sm font-black capitalize ${
                    isToday ? 'text-emerald-300' : 'text-zinc-200'
                  }`}>
                    {dayLabel(key)}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] uppercase tracking-wider text-emerald-400">
                        atual
                      </span>
                    )}
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

function CompactMetric({
  label,
  value,
  alert = false,
  active = false,
  onClick,
}: {
  label: string;
  value: string;
  alert?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3.5 py-3 text-left transition active:scale-[.98] ${
        active
          ? 'border-amber-500/50 bg-amber-500/10'
          : alert
            ? 'border-amber-500/25 bg-amber-500/[.055]'
            : 'border-zinc-800 bg-zinc-900/45'
      }`}
    >
      <p
        className={`text-[9px] font-bold ${
          alert || active
            ? 'text-amber-400'
            : 'text-zinc-600'
        }`}
      >
        {label}
      </p>

      <p className="mt-1 truncate text-base font-black text-zinc-100">
        {value}
      </p>
    </button>
  );
}
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

function PurchaseFilter({label,value,setValue,options}:{label:string;value:string;setValue:(value:string)=>void;options:[string,string][]}) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">{label}</span><select value={value} onChange={event=>setValue(event.target.value)} className="dfl-search px-3.5">{options.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
