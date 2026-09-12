'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, Package, Eye, EyeOff, Filter, Users, UserRound, Bike, ShoppingBag, Store, Clock3, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RouteAccordion } from '@/components/home/RouteAccordion';
import type { Route } from '@/types';
import { getFulfillmentMode, isDeliveryFulfillment } from '@/lib/delivery-mode';
import { firstValidTimestamp, saoPauloDateKey } from '@/lib/reports/time';
import { OperationalRadar } from '@/components/home/OperationalRadar';
import { ShiftBriefing } from '@/components/home/ShiftBriefing';
import { OperationalCommandCenter } from '@/components/home/OperationalCommandCenter';
import { OperationalDatePicker } from '@/components/home/OperationalDatePicker';

function formatDateLabel(date: Date): string {
  const todayKey = saoPauloDateKey(new Date());
  const dateKey = saoPauloDateKey(date);

  if (dateKey === todayKey) return 'Hoje';

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function operationalKey(...values: Parameters<typeof firstValidTimestamp>): string | null {
  const timestamp = firstValidTimestamp(...values);
  return timestamp ? saoPauloDateKey(timestamp) : null;
}

export default function HomePage() {
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const motoboys = useAppStore((state) => state.motoboys);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const goToPreviousDay = useAppStore((state) => state.goToPreviousDay);
  const goToNextDay = useAppStore((state) => state.goToNextDay);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);

  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode);

  const [globalMotoboy, setGlobalMotoboy] = useState<string | null>(null);

  const selectedDateKey = saoPauloDateKey(selectedDate);

  /*
   * Tomografia operacional da Home.
   * Antes cada render percorria routes/deliveries muitas vezes,
   * inclusive ao apenas tocar no filtro ou no modo privacidade.
   */
  const homeOperation = useMemo(() => {
    const datesWithOperation = new Set<string>();
    const allRouteIds = new Set<string>();
    const baseRoutesDoDia: Route[] = [];

    for (const route of routes) {
      allRouteIds.add(route.id);

      const key = operationalKey(
        route.created_at,
        route.started_at,
        route.departure_time,
      );

      if (key) {
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          baseRoutesDoDia.push(route);
        }
      }
    }

    const ordersDoDia = [];

    for (const delivery of deliveries) {
      const key = operationalKey(
        delivery.created_at,
        delivery.createdAt,
      );

      if (key) {
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          ordersDoDia.push(delivery);
        }
      }
    }

    let routesDoDia = globalMotoboy
      ? baseRoutesDoDia.filter(
          (route) =>
            route.motoboy_name === globalMotoboy,
        )
      : [...baseRoutesDoDia];

    routesDoDia.sort((a, b) => {
      const aDate = firstValidTimestamp(
        a.created_at,
        a.started_at,
        a.departure_time,
      );

      const bDate = firstValidTimestamp(
        b.created_at,
        b.started_at,
        b.departure_time,
      );

      return (
        (aDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (bDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
      );
    });

    const routeIdsDoDia = new Set(
      routesDoDia.map((route) => route.id),
    );

    const deliveriesDoDia = deliveries.filter(
      (delivery) => {
        if (!isDeliveryFulfillment(delivery)) {
          return false;
        }

        if (
          delivery.route_id &&
          routeIdsDoDia.has(delivery.route_id)
        ) {
          return true;
        }

        if (globalMotoboy) return false;

        const deliveryKey = operationalKey(
          delivery.created_at,
          delivery.createdAt,
        );

        const hasValidRoute = Boolean(
          delivery.route_id &&
            allRouteIds.has(delivery.route_id),
        );

        return (
          deliveryKey === selectedDateKey &&
          !hasValidRoute
        );
      },
    );

    const orphanedDeliveries =
      deliveriesDoDia.filter(
        (delivery) =>
          !delivery.route_id ||
          !allRouteIds.has(delivery.route_id),
      );

    if (
      orphanedDeliveries.length > 0 &&
      !globalMotoboy
    ) {
      routesDoDia.push({
        id: 'rota-resgate-recuperada',
        name: 'Rota Geral de Recuperação',
        status: 'aberta',
        motoboy_name: 'Sistema',
        departure_time: selectedDate.toISOString(),
        change_money: 0,
        drinks_summary:
          'Entregas sem rota válida — corrigir vínculo',
      });
    }

    const deliveriesByRoute = new Map<string, typeof deliveriesDoDia>();

    for (const delivery of deliveriesDoDia) {
      if (!delivery.route_id) continue;

      const bucket =
        deliveriesByRoute.get(delivery.route_id) || [];

      bucket.push(delivery);
      deliveriesByRoute.set(
        delivery.route_id,
        bucket,
      );
    }

    const totalEntregas = deliveriesDoDia.length;
    const pendingDeliveries =
      deliveriesDoDia.filter(
        (delivery) => !delivery.completed,
      ).length;

    const completedDeliveries = Math.max(
      0,
      totalEntregas - pendingDeliveries,
    );

    const storeOrdersDoDia = ordersDoDia
      .filter(
        (order) =>
          !isDeliveryFulfillment(order),
      )
      .sort((a, b) => {
        const aDate = firstValidTimestamp(
          a.created_at,
          a.createdAt,
        );

        const bDate = firstValidTimestamp(
          b.created_at,
          b.createdAt,
        );

        return (
          (aDate?.getTime() ?? 0) -
          (bDate?.getTime() ?? 0)
        );
      });

    const pickupCount =
      storeOrdersDoDia.filter(
        (order) =>
          getFulfillmentMode(order) === 'pickup',
      ).length;

    const counterCount =
      storeOrdersDoDia.filter(
        (order) =>
          getFulfillmentMode(order) === 'counter',
      ).length;

    const faturamentoTotal = ordersDoDia.reduce(
      (acc, order) => acc + (order.value || 0),
      0,
    );

    const openRoutes = routesDoDia.filter(
      (route) => route.status === 'aberta',
    );

    const closedRoutes = routesDoDia.filter(
      (route) => route.status === 'fechada',
    );

    const readyRoutes = openRoutes.filter((route) => {
      if (
        route.id === 'rota-resgate-recuperada'
      ) {
        return false;
      }

      const linked =
        deliveriesByRoute.get(route.id) || [];

      return (
        linked.length > 0 &&
        linked.every(
          (delivery) =>
            delivery.completed === true,
        )
      );
    });

    const closedRoutesByMotoboy =
      closedRoutes.reduce((acc, route) => {
        if (!acc[route.motoboy_name]) {
          acc[route.motoboy_name] = [];
        }

        acc[route.motoboy_name].push(route);
        return acc;
      }, {} as Record<string, Route[]>);

    const activeMotoboyNames = new Set(
      baseRoutesDoDia.flatMap((route) => [
        route.motoboy_id || '',
        route.motoboy_name,
      ]),
    );

    const activeMotoboysToday =
      motoboys.filter(
        (motoboy) =>
          activeMotoboyNames.has(motoboy.id) ||
          activeMotoboyNames.has(motoboy.name),
      );

    return {
      datesWithOperation,
      routesDoDia,
      ordersDoDia,
      deliveriesDoDia,
      totalEntregas,
      pendingDeliveries,
      completedDeliveries,
      storeOrdersDoDia,
      pickupCount,
      counterCount,
      faturamentoTotal,
      openRoutes,
      closedRoutes,
      readyRoutes,
      closedRoutesByMotoboy,
      activeMotoboysToday,
    };
  }, [
    deliveries,
    globalMotoboy,
    motoboys,
    routes,
    selectedDate,
    selectedDateKey,
  ]);

  const {
    datesWithOperation,
    routesDoDia,
    ordersDoDia,
    deliveriesDoDia,
    totalEntregas,
    pendingDeliveries,
    completedDeliveries,
    storeOrdersDoDia,
    pickupCount,
    counterCount,
    faturamentoTotal,
    openRoutes,
    closedRoutes,
    readyRoutes,
    closedRoutesByMotoboy,
    activeMotoboysToday,
  } = homeOperation;

  const formatOrderTime = (
    order: (typeof ordersDoDia)[number],
  ) => {
    const timestamp = firstValidTimestamp(
      order.created_at,
      order.createdAt,
    );

    return timestamp
      ? timestamp.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--:--';
  };

  // Função para pegar ícone do motoboy para o cabeçalho do grupo
  const getMotoboyIcon = (name: string) => {
    const m = motoboys.find(mb => mb.name === name);
    if (m?.avatar?.includes('woman')) return UserRound;
    if (m?.avatar?.includes('bike')) return Bike;
    return Users;
  };

  return (
    <div className="flex flex-col gap-5 pb-32">

      <OperationalDatePicker
        selectedDate={selectedDate}
        selectedDateKey={selectedDateKey}
        datesWithOperation={datesWithOperation}
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
        onSelect={setSelectedDate}
      />

      <OperationalCommandCenter routes={routesDoDia} deliveries={deliveriesDoDia} />
      <ShiftBriefing />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Operação de hoje</p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">Visão rápida</h2>
          </div>
          <p className="text-[10px] font-bold text-zinc-600">{completedDeliveries}/{totalEntregas} entregas</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a href={`/entregas?date=${encodeURIComponent(selectedDateKey)}`} className="min-w-0 rounded-[20px] border border-zinc-800 bg-zinc-900/45 p-3 active:scale-[0.98]">
            <div className="flex items-center justify-between gap-1"><Package size={14} className="shrink-0 text-sky-400" />{pendingDeliveries > 0 && <span className="truncate text-[8px] font-black text-amber-400">{pendingDeliveries} pend.</span>}</div>
            <p className="mt-3 font-heading text-2xl font-black leading-none text-zinc-50">{totalEntregas}</p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">Entregas</p>
          </a>
          <a href={`/rotas?date=${encodeURIComponent(selectedDateKey)}`} className={`min-w-0 rounded-[20px] border p-3 active:scale-[0.98] ${readyRoutes.length > 0 ? 'border-emerald-500/25 bg-emerald-500/[.055]' : 'border-zinc-800 bg-zinc-900/45'}`}>
            <div className="flex items-center justify-between gap-1"><Bike size={14} className="shrink-0 text-emerald-400" />{readyRoutes.length > 0 && <span className="truncate text-[8px] font-black text-emerald-400">{readyRoutes.length} pronta</span>}</div>
            <p className="mt-3 font-heading text-2xl font-black leading-none text-zinc-50">{openRoutes.length}</p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">Rotas abertas</p>
          </a>
          <div className="min-w-0 rounded-[20px] border border-zinc-800 bg-zinc-900/45 p-3">
            <div className="flex items-center justify-between gap-1"><TrendingUp size={14} className="shrink-0 text-emerald-400" /><button type="button" onClick={togglePrivacyMode} aria-label={isPrivacyMode ? 'Mostrar faturamento' : 'Ocultar faturamento'} className="shrink-0 text-zinc-600 active:scale-90">{isPrivacyMode ? <EyeOff size={13} /> : <Eye size={13} />}</button></div>
            <p className="mt-3 truncate font-heading text-[15px] font-black leading-none text-zinc-50">{isPrivacyMode ? 'R$ •••' : `R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">Faturamento</p>
          </div>
        </div>
      </section>

      {activeMotoboysToday.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setGlobalMotoboy(null)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${!globalMotoboy ? 'bg-zinc-200 text-zinc-950' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >
            <Filter size={14} /> Equipe Toda
          </button>

          {activeMotoboysToday.map(m => (
            <button
              key={m.id}
              onClick={() => setGlobalMotoboy(m.name)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${globalMotoboy === m.name ? 'bg-sky-500 text-zinc-950 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-sky-400'}`}
            >
              <Users size={14} /> {m.name}
            </button>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Inteligência</p><h2 className="mt-0.5 font-heading text-sm font-black text-zinc-300">Leitura operacional</h2></div>
          <a href="/relatorios" className="text-[9px] font-black uppercase tracking-wide text-indigo-400">Ver análises</a>
        </div>
        <OperationalRadar />
      </section>

      {storeOrdersDoDia.length > 0 && !globalMotoboy && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">Pedidos na loja</h2>
              <p className="mt-1 text-[11px] text-zinc-600">Fora da logística de rotas</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black">
              {pickupCount > 0 && <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-violet-400">{pickupCount} retirada{pickupCount === 1 ? '' : 's'}</span>}
              {counterCount > 0 && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-400">{counterCount} balcão</span>}
            </div>
          </div>

          <div className="space-y-2">
            {storeOrdersDoDia.map((order) => {
              const mode = getFulfillmentMode(order);
              const isPickup = mode === 'pickup';
              const ModeIcon = isPickup ? ShoppingBag : Store;
              return (
                <a
                  key={order.id}
                  href={`/entregas/details?id=${order.id}&date=${encodeURIComponent(selectedDateKey)}`}
                  className="flex w-full items-center gap-3 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-3.5 text-left transition-all active:scale-[0.99]"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isPickup ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <ModeIcon size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-zinc-100">{order.customer_name || `Pedido #${order.order_id || 'sem número'}`}</p>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase ${isPickup ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {isPickup ? 'Retirada' : 'Balcão'}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Clock3 size={10} />{formatOrderTime(order)}<span>•</span>{order.is_paid ? 'Pago' : 'Pagamento pendente'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-emerald-400">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${(order.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                    {order.completed ? <CheckCircle2 size={14} className="ml-auto mt-1 text-emerald-500" /> : <Clock3 size={14} className="ml-auto mt-1 text-amber-400" />}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {openRoutes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Execução</p><h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">Rotas em andamento {globalMotoboy && `· ${globalMotoboy}`}</h2></div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-400">{openRoutes.length} {openRoutes.length === 1 ? 'aberta' : 'abertas'}</span>
          </div>
          {openRoutes.map((route, index) => (
            <RouteAccordion key={route.id} route={route} defaultOpen={index === 0} />
          ))}
        </section>
      )}

      {closedRoutes.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          <h2 className="px-1 font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">
            Finalizadas {globalMotoboy && `(${globalMotoboy})`}
          </h2>

          {globalMotoboy ? (
            // Se tem filtro global, mostra a lista plana
            closedRoutes.map((route) => (
              <RouteAccordion key={route.id} route={route} />
            ))
          ) : (
            // Sem filtro, agrupa por motoboy
            Object.keys(closedRoutesByMotoboy).sort().map(motoboyName => {
              const Icon = getMotoboyIcon(motoboyName);
              return (
                <div key={motoboyName} className="flex flex-col gap-3 rounded-3xl border border-zinc-800/60 bg-zinc-900/20 p-3">
                  <div className="flex items-center gap-2 px-2 pt-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                      <Icon size={14} />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-300">{motoboyName}</h3>
                    <span className="ml-auto text-xs font-semibold text-zinc-500">{closedRoutesByMotoboy[motoboyName].length} rotas</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {closedRoutesByMotoboy[motoboyName].map(route => (
                      <RouteAccordion key={route.id} route={route} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {routesDoDia.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm font-black text-zinc-300">
            Nenhuma rota {globalMotoboy ? 'para este motoboy' : 'neste dia'}.
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            {globalMotoboy
              ? 'Troque o filtro da equipe para revisar o restante da operação.'
              : 'Você pode consultar os pedidos do dia ou criar uma nova rota pela tela de Rotas.'}
          </p>
        </div>
      )}
    </div>
  );
}
