// app/confirmacoes/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  ExternalLink,
  Hash,
  Pencil,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  TimerReset,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import { fulfillmentLabel, getFulfillmentMode } from '@/lib/delivery-mode';
import {
  getIfoodConfirmationInfo,
  isIfoodOrder,
  type IfoodConfirmationState,
} from '@/lib/ifood-confirmations';
import type { Delivery } from '@/types';

type QueueFilter = 'all' | IfoodConfirmationState;
type DatedDelivery = Pick<Delivery, 'created_at' | 'createdAt' | 'updated_at'>;

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

const normalize = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const money = (value = 0) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const waitingLabel = (value?: string) => {
  if (!value) return 'Horário não registrado';

  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return 'Horário não registrado';

  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));

  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `Há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours < 24) return rest ? `Há ${hours}h ${rest}min` : `Há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Há ${days} dia${days === 1 ? '' : 's'}`;
};

const stateMeta: Record<
  IfoodConfirmationState,
  { label: string; description: string; className: string }
> = {
  ready: {
    label: 'Pronto para confirmar',
    description: 'ID e código disponíveis',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  },
  missing_code: {
    label: 'Aguardando código',
    description: 'ID disponível, código ainda não informado',
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  },
  missing_id: {
    label: 'Falta ID do iFood',
    description: 'Complete os dados do pedido antes de confirmar',
    className: 'border-red-500/25 bg-red-500/10 text-red-400',
  },
};

export default function ConfirmacoesPage() {
  const router = useRouter();
  const deliveries = useAppStore((state) => state.deliveries);
  const customers = useAppStore((state) => state.customers);

  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');

  const allIfood = useMemo(
    () => deliveries.filter((delivery) => isIfoodOrder(delivery)),
    [deliveries],
  );

  const queue = useMemo(
    () =>
      allIfood
        .filter((delivery) => !delivery.completed)
        .map((delivery) => {
          const customer = customers.find((item) => item.id === delivery.customer_id);
          const confirmation = getIfoodConfirmationInfo(delivery, customer);
          const created = createdAt(delivery);
          const haystack = normalize(
            [
              delivery.order_id,
              delivery.ifood_id,
              delivery.confirmation_code,
              delivery.customer_name,
              customer?.name,
              customer?.phone,
              fulfillmentLabel(delivery),
            ].join(' '),
          );

          return {
            delivery,
            customer,
            confirmation,
            created,
            haystack,
          };
        })
        .filter(({ confirmation, haystack }) => {
          const matchesFilter = filter === 'all' || confirmation.state === filter;
          const matchesQuery = !query.trim() || haystack.includes(normalize(query));
          return matchesFilter && matchesQuery;
        })
        .sort((a, b) => {
          const urgentDiff = Number(Boolean(b.delivery.is_urgent)) - Number(Boolean(a.delivery.is_urgent));
          if (urgentDiff !== 0) return urgentDiff;

          const stateRank: Record<IfoodConfirmationState, number> = {
            ready: 0,
            missing_code: 1,
            missing_id: 2,
          };

          const stateDiff =
            stateRank[a.confirmation.state] - stateRank[b.confirmation.state];
          if (stateDiff !== 0) return stateDiff;

          return (
            new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime()
          );
        }),
    [allIfood, customers, filter, query],
  );

  const metrics = useMemo(() => {
    const pending = allIfood.filter((delivery) => !delivery.completed);
    const withoutCode = pending.filter((delivery) => {
      const customer = customers.find((item) => item.id === delivery.customer_id);
      return getIfoodConfirmationInfo(delivery, customer).code.length !== 4;
    }).length;

    const completedToday = allIfood.filter((delivery) => {
      if (!delivery.completed) return false;
      const value = delivery.completed_at || delivery.updated_at;
      return value ? dateKey(value) === todayKey() : false;
    }).length;

    return {
      pending: pending.length,
      withoutCode,
      completedToday,
    };
  }, [allIfood, customers]);

  const vibrate = async (style: ImpactStyle) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  };

  const copyValue = async (value: string, label: string) => {
    if (!value) {
      toast.error(`${label} não informado.`);
      return;
    }

    try {
      await vibrate(ImpactStyle.Light);
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    }
  };

  const openPortal = async (delivery: Delivery, code: string, ifoodId: string) => {
    await vibrate(ImpactStyle.Medium);

    if (ifoodId) {
      try {
        await navigator.clipboard.writeText(ifoodId);
      } catch {
        // O portal mantém botões manuais de cópia.
      }
    }

    router.push(
      `/confirmar?orderId=${encodeURIComponent(ifoodId)}&code=${encodeURIComponent(
        code,
      )}&returnTo=${encodeURIComponent('/confirmacoes')}`,
    );
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace('/mais')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
            Operação iFood
          </p>
          <h1 className="truncate font-heading text-xl font-black text-zinc-50">
            Central de Confirmações
          </h1>
        </div>

        <button
          onClick={() =>
            router.push(
              `/confirmar?returnTo=${encodeURIComponent('/confirmacoes')}`,
            )
          }
          className="flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[11px] font-black text-zinc-200 active:scale-95"
        >
          <ExternalLink size={14} />
          Portal
        </button>
      </header>

      <section className="rounded-[26px] border border-red-500/15 bg-gradient-to-br from-red-500/[0.07] to-zinc-950 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
            <ShieldCheck size={23} />
          </div>

          <div>
            <h2 className="font-heading text-base font-black text-zinc-100">
              Fila operacional
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              A central organiza os pedidos que ainda estão abertos no DFL. Abrir o portal não
              marca uma confirmação externa como concluída.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Metric
          icon={TimerReset}
          label="Aguardando"
          value={metrics.pending}
          tone="text-amber-400"
        />
        <Metric
          icon={AlertTriangle}
          label="Sem código"
          value={metrics.withoutCode}
          tone="text-red-400"
        />
        <Metric
          icon={CheckCircle2}
          label="Concluídos hoje"
          value={metrics.completedToday}
          tone="text-emerald-400"
        />
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pedido, cliente, ID ou código"
          className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 pl-11 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-red-500/50"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(
          [
            ['all', 'Todos'],
            ['ready', 'Prontos'],
            ['missing_code', 'Sem código'],
            ['missing_id', 'Sem ID'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold ${
              filter === value
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-zinc-800 bg-zinc-900/45 text-zinc-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {queue.map(({ delivery, customer, confirmation, created }) => {
          const state = stateMeta[confirmation.state];
          const mode = getFulfillmentMode(delivery);
          const ModeIcon = mode === 'pickup' ? ShoppingBag : mode === 'counter' ? Store : Smartphone;
          const name = customer?.name || delivery.customer_name || 'Cliente não informado';

          return (
            <article
              key={delivery.id}
              className={`rounded-[24px] border bg-zinc-900/45 p-4 ${
                delivery.is_urgent ? 'border-red-500/35' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                  <Smartphone size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black text-zinc-100">{name}</p>
                    {delivery.is_urgent && (
                      <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-400">
                        Urgente
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span>{delivery.order_id ? `Pedido #${delivery.order_id}` : 'Pedido sem número'}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <ModeIcon size={10} />
                      {fulfillmentLabel(delivery)}
                    </span>
                    <span>•</span>
                    <span>{money(delivery.value || 0)}</span>
                  </div>
                </div>

                <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-zinc-500">
                  <Clock3 size={11} />
                  {waitingLabel(created)}
                </span>
              </div>

              <div className={`mt-4 rounded-2xl border p-3 ${state.className}`}>
                <p className="text-xs font-black">{state.label}</p>
                <p className="mt-0.5 text-[10px] opacity-80">{state.description}</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => copyValue(confirmation.ifoodId, 'ID do pedido')}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.98]"
                >
                  <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-600">
                    ID iFood
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <strong className="truncate font-mono text-xs text-zinc-200">
                      {confirmation.ifoodId || 'Não informado'}
                    </strong>
                    <Copy size={13} className="shrink-0 text-sky-400" />
                  </span>
                </button>

                <button
                  onClick={() => copyValue(confirmation.code, 'Código')}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.98]"
                >
                  <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-600">
                    Código
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <strong className="truncate font-mono text-xs text-amber-400">
                      {confirmation.code || 'Pendente'}
                    </strong>
                    <Copy size={13} className="shrink-0 text-amber-400" />
                  </span>
                  {confirmation.codeSource === 'customer' && (
                    <span className="mt-1 block text-[9px] text-zinc-600">
                      Recuperado do cadastro do cliente
                    </span>
                  )}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                {confirmation.state === 'missing_id' ? (
                  <button
                    onClick={() => router.push(`/entregas/editar?id=${delivery.id}`)}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 font-black text-zinc-950 active:scale-95"
                  >
                    <Pencil size={15} />
                    Completar dados
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      openPortal(delivery, confirmation.code, confirmation.ifoodId)
                    }
                    className={`flex h-12 items-center justify-center gap-2 rounded-xl font-black active:scale-95 ${
                      confirmation.ready
                        ? 'bg-red-500 text-white'
                        : 'border border-red-500/30 bg-red-500/10 text-red-400'
                    }`}
                  >
                    <ExternalLink size={15} />
                    {confirmation.ready ? 'Confirmar no iFood' : 'Abrir portal'}
                  </button>
                )}

                <button
                  onClick={() => router.push(`/entregas/details?id=${delivery.id}`)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
                  aria-label="Abrir pedido"
                >
                  <Hash size={16} />
                </button>
              </div>
            </article>
          );
        })}

        {queue.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-zinc-800 px-5 py-14 text-center">
            <CheckCircle2 size={34} className="mx-auto text-emerald-500/70" />
            <h3 className="mt-4 font-heading text-base font-black text-zinc-200">
              Nenhuma pendência neste filtro
            </h3>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-600">
              Quando houver pedidos iFood abertos, eles aparecerão aqui automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TimerReset;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
      <Icon size={15} className={tone} />
      <p className="mt-2 text-xl font-black text-zinc-100">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold leading-tight text-zinc-600">{label}</p>
    </div>
  );
}
