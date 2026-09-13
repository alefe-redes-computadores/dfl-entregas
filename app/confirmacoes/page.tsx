// app/confirmacoes/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  CalendarDays,
  ChevronRight,
  Plus,
  Trash2,
  ClipboardPaste,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import { fulfillmentLabel, getFulfillmentMode } from '@/lib/delivery-mode';
import { dateFromKey, dateKey, deliveryDate, shiftDateKey } from '@/lib/operational-time';
import {
  getIfoodConfirmationInfo,
  isIfoodOrder,
  type IfoodConfirmationState,
} from '@/lib/ifood-confirmations';
import type { Delivery, IfoodPendingConfirmation } from '@/types';

type QueueFilter = 'all' | IfoodConfirmationState;

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
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get('date');
  const requestedRouteId = searchParams.get('route');
  const requestedRouteName = searchParams.get('routeName');
  const initialDateKey =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : dateKey(new Date());
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const ifoodPendingConfirmations = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );
  const addIfoodPendingConfirmations = useAppStore(
    (state) => state.addIfoodPendingConfirmations,
  );
  const updateIfoodPendingConfirmation = useAppStore(
    (state) => state.updateIfoodPendingConfirmation,
  );
  const deleteIfoodPendingConfirmation = useAppStore(
    (state) => state.deleteIfoodPendingConfirmation,
  );

  const [filter, setFilter] = useState<QueueFilter>('all');
  const [query, setQuery] = useState('');
  const [isBatchOpen, setIsBatchOpen] = useState(() => searchParams.get('add') === '1');
  const [batchText, setBatchText] = useState('');
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [manualView, setManualView] = useState<'pending' | 'resolved'>('pending');
  const [pendingDeleteManual, setPendingDeleteManual] = useState<IfoodPendingConfirmation | null>(null);
  const [deletingManual, setDeletingManual] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() => initialDateKey);
  const selectedDate = dateFromKey(selectedDateKey);
  const selectedDateLabel =
    selectedDateKey === dateKey(new Date())
      ? 'Hoje'
      : selectedDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

  const confirmationReturn = useMemo(() => {
    const params = new URLSearchParams({
      date: selectedDateKey,
    });

    if (requestedRouteId) {
      params.set('route', requestedRouteId);
    }

    if (requestedRouteName) {
      params.set('routeName', requestedRouteName);
    }

    return `/confirmacoes?${params.toString()}`;
  }, [
    requestedRouteId,
    requestedRouteName,
    selectedDateKey,
  ]);

  const deliveryDateSuffix = `&date=${encodeURIComponent(selectedDateKey)}`;

  const allIfood = useMemo(
    () => deliveries.filter((delivery) => isIfoodOrder(delivery)),
    [deliveries],
  );

  const selectedIfood = useMemo(
    () =>
      allIfood.filter((delivery) => {
        const created = deliveryDate(delivery);
        return Boolean(created) && dateKey(created) === selectedDateKey;
      }),
    [allIfood, selectedDateKey],
  );

  const queue = useMemo(
    () =>
      selectedIfood
        .filter((delivery) => !delivery.completed)
        .map((delivery) => {
          const customer = customers.find((item) => item.id === delivery.customer_id);
          const confirmation = getIfoodConfirmationInfo(delivery, customer);
          const created = deliveryDate(delivery);
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
    [selectedIfood, customers, filter, query],
  );

  const metrics = useMemo(() => {
    const pending = selectedIfood.filter((delivery) => !delivery.completed);
    const withoutCode = pending.filter((delivery) => {
      const customer = customers.find((item) => item.id === delivery.customer_id);
      return getIfoodConfirmationInfo(delivery, customer).code.length !== 4;
    }).length;
    const completed = selectedIfood.filter((delivery) => delivery.completed).length;

    return {
      pending: pending.length,
      withoutCode,
      completed,
    };
  }, [customers, selectedIfood]);

  const manualOperationalContext = (item: IfoodPendingConfirmation) => {
    const route = item.route_id
      ? routes.find((current) => current.id === item.route_id)
      : undefined;

    if (!route) {
      return {
        key: 'manual' as const,
        rank: 3,
        label: 'Avulso',
        routeName: item.route_name || 'Sem rota',
        motoboy: '',
        tone: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
      };
    }

    if (route.status === 'fechada') {
      return {
        key: 'post' as const,
        rank: 2,
        label: 'Pós-rota',
        routeName: route.name,
        motoboy: route.motoboy_name || '',
        tone: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
      };
    }

    if (route.started_at) {
      return {
        key: 'street' as const,
        rank: 0,
        label: 'Na rua agora',
        routeName: route.name,
        motoboy: route.motoboy_name || '',
        tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
      };
    }

    return {
      key: 'prep' as const,
      rank: 1,
      label: 'Preparando saída',
      routeName: route.name,
      motoboy: route.motoboy_name || '',
      tone: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    };
  };

  const pendingManualConfirmations = useMemo(
    () =>
      ifoodPendingConfirmations
        .filter((item) => (item.status || 'pending') === 'pending')
        .filter((item) => !requestedRouteId || item.route_id === requestedRouteId)
        .sort((a, b) => {
          const contextA = manualOperationalContext(a);
          const contextB = manualOperationalContext(b);

          if (contextA.rank !== contextB.rank) {
            return contextA.rank - contextB.rank;
          }

          const routeCompare = contextA.routeName.localeCompare(
            contextB.routeName,
            'pt-BR',
          );
          if (routeCompare !== 0) return routeCompare;

          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        }),
    [ifoodPendingConfirmations, requestedRouteId, routes],
  );

  const pendingOperationalCounts = useMemo(() => {
    const counts = { street: 0, prep: 0, post: 0, manual: 0 };

    pendingManualConfirmations.forEach((item) => {
      counts[manualOperationalContext(item).key] += 1;
    });

    return counts;
  }, [pendingManualConfirmations, routes]);

  const resolvedManualConfirmations = useMemo(
    () =>
      ifoodPendingConfirmations
        .filter((item) => item.status === 'resolved')
        .filter((item) => !requestedRouteId || item.route_id === requestedRouteId)
        .sort(
          (a, b) =>
            new Date(b.resolved_at || b.updated_at || b.created_at).getTime() -
            new Date(a.resolved_at || a.updated_at || a.created_at).getTime(),
        ),
    [ifoodPendingConfirmations, requestedRouteId],
  );

  const visibleManualConfirmations =
    manualView === 'pending'
      ? pendingManualConfirmations
      : resolvedManualConfirmations;

  const markManualResolved = async (item: IfoodPendingConfirmation) => {
    try {
      await vibrate(ImpactStyle.Medium);
      await updateIfoodPendingConfirmation(item.id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });
      toast.success('Pedido marcado como confirmado no iFood.');
    } catch {
      toast.error('Não foi possível concluir a pendência.');
    }
  };

  const restoreManualPending = async (item: IfoodPendingConfirmation) => {
    try {
      await vibrate(ImpactStyle.Light);
      await updateIfoodPendingConfirmation(item.id, {
        status: 'pending',
        resolved_at: undefined,
      });
      toast.success('Pendência restaurada para a fila.');
    } catch {
      toast.error('Não foi possível restaurar a pendência.');
    }
  };

  const permanentlyDeleteManual = (item: IfoodPendingConfirmation) => {
    setPendingDeleteManual(item);
  };

  const confirmPermanentDeleteManual = async () => {
    if (!pendingDeleteManual || deletingManual) return;

    setDeletingManual(true);
    try {
      await vibrate(ImpactStyle.Medium);
      await deleteIfoodPendingConfirmation(pendingDeleteManual.id);
      toast.success('Histórico excluído definitivamente.');
      setPendingDeleteManual(null);
    } catch {
      toast.error('Não foi possível excluir o histórico.');
    } finally {
      setDeletingManual(false);
    }
  };

  const normalizePendingKey = (value?: string) =>
    (value || '').replace(/\D/g, '');

  const parsePendingBatch = (text: string): IfoodPendingConfirmation[] => {
    const now = new Date().toISOString();

    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parts = line
          .split(/[;|\t]/)
          .map((part) => part.trim())
          .filter(Boolean);

        const joined = parts.join(' ');
        const tokens = joined.match(/\b\d{4,8}\b/g) || [];
        const ifoodId = tokens.find((token) => token.length === 8) || '';
        const shortTokens = tokens.filter(
          (token) => token.length === 4 || token.length === 5,
        );
        const orderId = shortTokens[0] || '';
        const confirmationCode =
          shortTokens.find((token) => token.length === 4 && token !== orderId) || '';
        const customerName =
          parts.find((part) => !/\d/.test(part) && part.length >= 2) || '';

        return {
          id: `ifood-pending-${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          order_id: orderId || undefined,
          ifood_id: ifoodId || undefined,
          confirmation_code: confirmationCode || undefined,
          customer_name: customerName || undefined,
          status: 'pending',
          source_kind: 'manual',
          created_at: now,
          updated_at: now,
        } satisfies IfoodPendingConfirmation;
      });
  };

  const savePendingBatch = async () => {
    const parsed = parsePendingBatch(batchText);

    if (!parsed.length) {
      toast.error('Cole pelo menos uma linha.');
      return;
    }

    const existingIds = new Set(
      [
        ...deliveries.map((item) => item.ifood_id),
        ...ifoodPendingConfirmations.map((item) => item.ifood_id),
      ]
        .filter(Boolean)
        .map((value) => normalizePendingKey(value)),
    );

    const existingOrders = new Set(
      [
        ...deliveries.map((item) => item.order_id),
        ...ifoodPendingConfirmations.map((item) => item.order_id),
      ]
        .filter(Boolean)
        .map((value) => normalizePendingKey(value)),
    );

    const unique = parsed.filter((item) => {
      const idKey = normalizePendingKey(item.ifood_id);
      const orderKey = normalizePendingKey(item.order_id);

      if (idKey && existingIds.has(idKey)) return false;
      if (orderKey && existingOrders.has(orderKey)) return false;

      if (idKey) existingIds.add(idKey);
      if (orderKey) existingOrders.add(orderKey);
      return true;
    });

    if (!unique.length) {
      toast.info('Essas pendências já estão cadastradas.');
      return;
    }

    setIsBatchSaving(true);

    try {
      await addIfoodPendingConfirmations(unique);
      toast.success(
        `${unique.length} pendência${unique.length === 1 ? '' : 's'} adicionada${
          unique.length === 1 ? '' : 's'
        }.`,
      );
      setBatchText('');
      setIsBatchOpen(false);
    } catch {
      toast.error('Não foi possível salvar as pendências.');
    } finally {
      setIsBatchSaving(false);
    }
  };

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

    router.replace(
      `/confirmar?orderId=${encodeURIComponent(ifoodId)}&code=${encodeURIComponent(
        code,
      )}&returnTo=${encodeURIComponent(confirmationReturn)}`,
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
            router.replace(
              `/confirmar?returnTo=${encodeURIComponent(confirmationReturn)}`,
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

      <section className="rounded-[22px] border border-zinc-800 bg-zinc-900/40 p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDateKey((key) => shiftDateKey(key, -1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 active:scale-95"
            aria-label="Dia anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDateKey(dateKey(new Date()))}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3 text-xs font-black text-red-300 active:scale-[0.99]"
            aria-label="Voltar para hoje"
          >
            <CalendarDays size={15} />
            {selectedDateLabel}
          </button>

          <button
            type="button"
            onClick={() => setSelectedDateKey((key) => shiftDateKey(key, 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 active:scale-95"
            aria-label="Próximo dia"
          >
            <ChevronRight size={18} />
          </button>
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
          label="Concluídos"
          value={metrics.completed}
          tone="text-emerald-400"
        />
      </div>

      {requestedRouteId && (
        <div className="rounded-[24px] border border-sky-500/20 bg-sky-500/[.055] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
            Pós-rota
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-100">
                {requestedRouteName || 'Rota finalizada'}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {pendingManualConfirmations.length} pedido{pendingManualConfirmations.length === 1 ? '' : 's'} aguardando confirmação no iFood
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.replace(`/confirmacoes?date=${encodeURIComponent(selectedDateKey)}`)}
              className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] font-black text-zinc-400"
            >
              Ver todas
            </button>
          </div>
        </div>
      )}

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

      {ifoodPendingConfirmations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                Confirmação externa
              </p>
              <h2 className="mt-1 text-sm font-black text-zinc-100">
                Pendências do portal iFood
              </h2>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                Código coletado não significa pedido confirmado no portal.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-black text-zinc-400">
              {pendingManualConfirmations.length} pendente{pendingManualConfirmations.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-1">
            <button
              type="button"
              onClick={() => setManualView('pending')}
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                manualView === 'pending'
                  ? 'bg-red-500 text-white'
                  : 'text-zinc-500'
              }`}
            >
              Pendentes · {pendingManualConfirmations.length}
            </button>
            <button
              type="button"
              onClick={() => setManualView('resolved')}
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                manualView === 'resolved'
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-500'
              }`}
            >
              Histórico · {resolvedManualConfirmations.length}
            </button>
          </div>

          {manualView === 'pending' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Na rua agora', pendingOperationalCounts.street, 'border-emerald-500/20 bg-emerald-500/[.06] text-emerald-300'],
                ['Preparando', pendingOperationalCounts.prep, 'border-amber-500/20 bg-amber-500/[.06] text-amber-300'],
                ['Pós-rota', pendingOperationalCounts.post, 'border-sky-500/20 bg-sky-500/[.06] text-sky-300'],
                ['Avulsos', pendingOperationalCounts.manual, 'border-zinc-800 bg-zinc-900/50 text-zinc-400'],
              ].map(([label, count, tone]) => (
                <div key={String(label)} className={`rounded-2xl border px-3 py-2 ${tone}`}>
                  <p className="text-[9px] font-black uppercase tracking-wide">{label}</p>
                  <p className="mt-1 text-lg font-black">{count}</p>
                </div>
              ))}
            </div>
          )}

          {visibleManualConfirmations.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-zinc-800 px-5 py-9 text-center">
              {manualView === 'pending' ? (
                <>
                  <CheckCircle2 size={28} className="mx-auto text-emerald-500/70" />
                  <p className="mt-3 text-sm font-black text-zinc-300">
                    Nenhuma confirmação pendente
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Não há pedidos aguardando confirmação externa neste filtro.
                  </p>
                </>
              ) : (
                <>
                  <TimerReset size={28} className="mx-auto text-zinc-700" />
                  <p className="mt-3 text-sm font-black text-zinc-400">
                    Histórico vazio
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    As pendências resolvidas aparecerão aqui.
                  </p>
                </>
              )}
            </div>
          ) : (
            visibleManualConfirmations.map((item) => {
              const ready =
                (item.ifood_id || '').replace(/\D/g, '').length === 8 &&
                (item.confirmation_code || '').replace(/\D/g, '').length === 4;
              const resolved = item.status === 'resolved';
              const operational = manualOperationalContext(item);

              return (
                <article
                  key={item.id}
                  className={`rounded-[24px] border p-4 ${
                    resolved
                      ? 'border-emerald-500/15 bg-emerald-500/[.035]'
                      : 'border-zinc-800 bg-zinc-900/45'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                        resolved
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-red-500/20 bg-red-500/10 text-red-400'
                      }`}
                    >
                      {resolved ? <CheckCircle2 size={19} /> : <Smartphone size={19} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-black text-zinc-100">
                          {item.customer_name || 'Pendência iFood'}
                        </p>
                        {resolved && (
                          <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                            Resolvida
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {item.order_id
                          ? `Pedido #${item.order_id}`
                          : 'Pedido sem número'}
                      </p>
                      <p className="mt-1 text-[9px] text-zinc-700">
                        {resolved
                          ? `Resolvida ${waitingLabel(item.resolved_at)}`
                          : `Criada ${waitingLabel(item.created_at)}`}
                      </p>

                      {!resolved && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${operational.tone}`}>
                            {operational.label}
                          </span>
                          <span className="max-w-[190px] truncate text-[9px] font-bold text-zinc-500">
                            {operational.routeName}
                            {operational.motoboy ? ` · ${operational.motoboy}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => copyValue(item.ifood_id || '', 'ID do pedido')}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.98]"
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-600">
                        ID iFood
                      </span>
                      <strong className="mt-1 block font-mono text-xs text-zinc-200">
                        {item.ifood_id || 'Não informado'}
                      </strong>
                    </button>

                    <button
                      onClick={() => copyValue(item.confirmation_code || '', 'Código')}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.98]"
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-600">
                        Código
                      </span>
                      <strong className="mt-1 block font-mono text-xs text-amber-400">
                        {item.confirmation_code || 'Pendente'}
                      </strong>
                    </button>
                  </div>

                  {!resolved ? (
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        onClick={() =>
                          router.replace(
                            `/confirmar?orderId=${encodeURIComponent(
                              item.ifood_id || '',
                            )}&code=${encodeURIComponent(
                              item.confirmation_code || '',
                            )}&pendingId=${encodeURIComponent(
                              item.id,
                            )}&returnTo=${encodeURIComponent(confirmationReturn)}`,
                          )
                        }
                        className={`flex h-12 items-center justify-center gap-2 rounded-xl font-black active:scale-95 ${
                          ready
                            ? 'bg-red-500 text-white'
                            : 'border border-red-500/30 bg-red-500/10 text-red-400'
                        }`}
                      >
                        <ExternalLink size={15} />
                        {ready ? 'Confirmar no iFood' : 'Abrir portal'}
                      </button>

                      <button
                        type="button"
                        onClick={() => markManualResolved(item)}
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 active:scale-95"
                        aria-label="Marcar como confirmado no iFood"
                        title="Marcar como confirmado no iFood"
                      >
                        <CheckCircle2 size={17} />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => restoreManualPending(item)}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 font-black text-zinc-300 active:scale-95"
                      >
                        <TimerReset size={15} />
                        Restaurar para pendentes
                      </button>

                      <button
                        type="button"
                        onClick={() => permanentlyDeleteManual(item)}
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 active:scale-95"
                        aria-label="Excluir definitivamente"
                        title="Excluir definitivamente"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}

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
                    onClick={() => router.push(`/entregas/editar?id=${delivery.id}${deliveryDateSuffix}`)}
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
                  onClick={() => router.push(`/entregas/details?id=${delivery.id}${deliveryDateSuffix}`)}
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
              Não há pedidos iFood pendentes para esta data e filtro.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsBatchOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[55] flex h-14 items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500 px-4 font-black text-white shadow-[0_14px_36px_rgba(239,68,68,.28)] active:scale-95"
        aria-label="Adicionar pendências iFood"
      >
        <Plus size={18} />
        Adicionar
      </button>

      {pendingDeleteManual && (
        <div
          className="fixed inset-0 z-[130] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => !deletingManual && setPendingDeleteManual(null)}
        >
          <section
            className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-950 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
              Excluir histórico
            </p>
            <h2 className="mt-2 text-lg font-black text-zinc-100">
              Remover esta confirmação?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Essa ação remove a pendência do histórico do iFood e não pode ser desfeita.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={deletingManual}
                onClick={() => setPendingDeleteManual(null)}
                className="h-12 rounded-xl border border-zinc-800 text-sm font-bold text-zinc-400 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingManual}
                onClick={confirmPermanentDeleteManual}
                className="h-12 rounded-xl bg-red-500 text-sm font-black text-white disabled:opacity-50"
              >
                {deletingManual ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isBatchOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setIsBatchOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
                  Cadastro em lote
                </p>
                <h2 className="mt-1 font-heading text-lg font-black text-zinc-100">
                  Adicionar pendências iFood
                </h2>
              </div>

              <button
                onClick={() => setIsBatchOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 active:scale-95"
                aria-label="Fechar cadastro em lote"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3">
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Uma pendência por linha. Separe os campos por ponto e vírgula,
                barra vertical ou tabulação. Ex.:
                <span className="ml-1 font-mono text-zinc-300">
                  5463 ; 60873228 ; 1234 ; João
                </span>
              </p>
            </div>

            <textarea
              rows={8}
              value={batchText}
              onChange={(event) => setBatchText(event.target.value)}
              placeholder={'5463 ; 60873228 ; 1234 ; João\n5488 ; 12345678 ; 4321 ; Maria'}
              className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 font-mono text-xs text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-red-500/50"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setBatchText(text);
                    toast.success('Texto colado.');
                  } catch {
                    toast.error(
                      'Não foi possível acessar a área de transferência.',
                    );
                  }
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-black text-zinc-300 active:scale-95"
              >
                <ClipboardPaste size={15} />
                Colar
              </button>

              <button
                onClick={savePendingBatch}
                disabled={isBatchSaving}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-500 text-xs font-black text-white active:scale-95 disabled:opacity-50"
              >
                <Plus size={15} />
                {isBatchSaving ? 'Salvando...' : 'Salvar pendências'}
              </button>
            </div>
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
