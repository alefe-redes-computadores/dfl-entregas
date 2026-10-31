'use client';
import { useRouter } from 'next/navigation';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';

import { useEffect, useMemo, useState } from 'react';
import { isFutureScheduledDelivery } from "@/lib/scheduled-delivery";
import { isSyntheticOperationalRoute } from '@/lib/operational-time';
import { TrendingUp, Package, Eye, EyeOff, Filter, Users, Bike, ShoppingBag, Store, Clock3, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RouteAccordion } from '@/components/home/RouteAccordion';
import { ClosedRoutesSection } from '@/components/home/ClosedRoutesSection';
import type { Route } from '@/types';
import { getFulfillmentMode, isDeliveryFulfillment } from '@/lib/delivery-mode';
import { firstValidTimestamp, saoPauloDateKey } from '@/lib/reports/time';
import { OperationalRadar } from '@/components/home/OperationalRadar';
import { ShiftBriefing } from '@/components/home/ShiftBriefing';
import { OperationalCommandCenter } from '@/components/home/OperationalCommandCenter';
import { OperationalDatePicker } from '@/components/home/OperationalDatePicker';
import { deliveryEconomicValue, deriveDeliveryPaymentState } from '@/lib/delivery-finance';
import { isSiteOrderAwaitingHomeReview } from '@/lib/integration/site-order';

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
  const router = useRouter();
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
  // R154_R2_ROUTE_FOCUS: compactacao voluntaria, nenhuma rota fica oculta sem acao explicita.
  const [compactOpenRoutes, setCompactOpenRoutes] = useState(false);
  // R90: balcão/retirada/99Food não montam dezenas de cards numa só pintura.
  // Os totais e a contabilidade continuam usando TODOS os pedidos do período.
  const [storeOrdersVisibleLimit, setStoreOrdersVisibleLimit] = useState(8);

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
    // Guarda timestamps por objeto: IDs legados duplicados não colidem.
    const routeTimes = new Map<Route, number>();

    for (const route of routes) {
      // Rotas virtuais de recuperação não são uma operação real na Home.
      // Pedidos órfãos permanecem no store e na Caixa para correção de vínculo.
      if (isSyntheticOperationalRoute(route.id)) continue;
      allRouteIds.add(route.id);

      const routeTimestamp = firstValidTimestamp(
        route.created_at,
        route.started_at,
        route.departure_time,
      );
      const key = routeTimestamp ? saoPauloDateKey(routeTimestamp) : null;

      if (key) {
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          baseRoutesDoDia.push(route);
          routeTimes.set(route, routeTimestamp!.getTime());
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

    // Já calculamos as datas durante o recorte do dia; não repetir
    // parseTimestamp em cada comparação da ordenação.
    routesDoDia.sort((a, b) =>
      (routeTimes.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (routeTimes.get(b) ?? Number.MAX_SAFE_INTEGER)
    );

    const routeIdsDoDia = new Set(
      routesDoDia.map((route) => route.id),
    );
    const deliveriesCreatedOnDay = new Set(ordersDoDia);

    const deliveriesDoDia = deliveries.filter(
      (delivery) => {
        if (isCancelledSiteDelivery(delivery)) return false;
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

        const hasValidRoute = Boolean(
          delivery.route_id &&
            allRouteIds.has(delivery.route_id),
        );

        return (
          deliveriesCreatedOnDay.has(delivery) &&
          !hasValidRoute
        );
      },
    );

    const operationalDeliveriesDoDia = deliveriesDoDia.filter(
      (delivery) =>
        !isCancelledSiteDelivery(delivery) &&
        !delivery.operational_dismissed_at &&
        (!isFutureScheduledDelivery(delivery) ||
          (!delivery.route_id && isSiteOrderAwaitingHomeReview(delivery))),
    );
    // R66: pedidos sem rota sao pendencias da Caixa, NAO rotas virtuais.
    // Ligacoes quebradas tambem sao diagnosticadas separadamente na Home.

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
          !isCancelledSiteDelivery(order) &&
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
    const platformCount = storeOrdersDoDia.filter(
      (order) => getFulfillmentMode(order) === 'external_delivery',
    ).length;

    const faturamentoTotal = ordersDoDia.reduce(
      (acc, order) => acc + (isCancelledSiteDelivery(order) ? 0 : deliveryEconomicValue(order)),
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
        route.id === 'rota-resgate-recuperada' ||
        route.id === 'rota-aguardando-vinculo' ||
        route.id === 'rota-site-aguardando-confirmacao'
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
      platformCount,
      faturamentoTotal,
      openRoutes,
      closedRoutes,
      readyRoutes,
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
    platformCount,
    faturamentoTotal,
    openRoutes,
    closedRoutes,
    readyRoutes,
    activeMotoboysToday,
  } = homeOperation;

  // Ao mudar o dia, não manter filtro invisível de motoboy sem operação.
  useEffect(() => {
    if (globalMotoboy && !activeMotoboysToday.some((motoboy) => motoboy.name === globalMotoboy)) {
      setGlobalMotoboy(null);
    }
  }, [activeMotoboysToday, globalMotoboy]);

  useEffect(() => {
    setStoreOrdersVisibleLimit(8);
    setCompactOpenRoutes(false);
  }, [selectedDateKey, globalMotoboy]);

  const hasOperationSummary =
    totalEntregas > 0 ||
    openRoutes.length > 0 ||
    faturamentoTotal > 0;

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

  return (
    <div className="dfl-page dfl-r196-home">

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

      {hasOperationSummary ? (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Operação do período</p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">Visão rápida</h2>
          </div>
          <p className="text-[10px] font-bold text-zinc-500">{pendingDeliveries > 0 ? `${pendingDeliveries} pendentes` : 'Entregas em dia'}</p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-900/40">
          <a
            href={`/entregas?date=${encodeURIComponent(selectedDateKey)}`}
            className="min-w-0 p-3.5 transition active:bg-zinc-900"
          >
            <Package size={14} className="text-sky-400" />
            <p className="mt-2 font-heading text-xl font-black leading-none text-zinc-50">
              {totalEntregas}
            </p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">
              Entregas{pendingDeliveries > 0 ? ` · ${pendingDeliveries} pend.` : ''}
            </p>
          </a>

          <a
            href={`/rotas?date=${encodeURIComponent(selectedDateKey)}`}
            className="min-w-0 border-x border-zinc-800 p-3.5 transition active:bg-zinc-900"
          >
            <Bike size={14} className="text-emerald-400" />
            <p className="mt-2 font-heading text-xl font-black leading-none text-zinc-50">
              {openRoutes.length}
            </p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">
              Rotas abertas
            </p>
          </a>

          <div className="min-w-0 p-3.5">
            <div className="flex items-center justify-between gap-1">
              <TrendingUp size={14} className="text-emerald-400" />
              <button
                type="button"
                onClick={togglePrivacyMode}
                aria-label={isPrivacyMode ? 'Mostrar valor dos pedidos' : 'Ocultar valor dos pedidos'}
                className="text-zinc-600 active:scale-90"
              >
                {isPrivacyMode ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <p className="mt-2 truncate font-heading text-sm font-black leading-none text-zinc-50">
              {isPrivacyMode
                ? 'R$ •••'
                : `R$ ${faturamentoTotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </p>
            <p className="mt-1 truncate text-[9px] font-bold text-zinc-600">
              Faturamento do período
            </p>
          </div>
        </div>
      </section>
      ) : (
        <section className="rounded-[20px] border border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-zinc-600">
              <Package size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-zinc-300">Sem movimento neste período</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                Entregas, rotas e valores aparecem aqui quando houver operação.
              </p>
            </div>
          </div>
        </section>
      )}

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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${globalMotoboy === m.name ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-emerald-400'}`}
            >
              <Users size={14} /> {m.name}
            </button>
          ))}
        </div>
      )}


      <OperationalRadar />

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
              {platformCount > 0 && <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1 text-yellow-300">{platformCount} pela plataforma</span>}
            </div>
          </div>

          <div className="space-y-2">
            {storeOrdersDoDia.slice(0, storeOrdersVisibleLimit).map((order) => {
              const mode = getFulfillmentMode(order);
              const isPickup = mode === 'pickup';
              const isPlatform = mode === 'external_delivery';
              const paidConfirmed = deriveDeliveryPaymentState(order) === 'paid';
              const cardPayment = ['cartao', 'cartao_credito', 'cartao_debito'].includes(order.payment_method);
              // Conclusao fisica nao comprova o recebimento financeiro. O Site pode
              // entregar apenas o metodo de pagamento, sem a confirmacao do terminal.
              const financialCaption = paidConfirmed ? 'Pago confirmado'
                : order.completed && isPickup && cardPayment ? 'Retirada concluída · cartão a conferir'
                : order.completed ? 'Concluído · recebimento a conferir'
                : 'Pagamento pendente';
              const ModeIcon = isPickup || isPlatform ? ShoppingBag : Store;
              return (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => router.push(`/entregas/details?id=${order.id}&date=${encodeURIComponent(selectedDateKey)}`)}
                  className="flex w-full items-center gap-3 rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-3.5 text-left transition-all active:scale-[0.99]"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isPlatform?'bg-yellow-400/10 text-yellow-300':isPickup ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <ModeIcon size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-zinc-100">{order.customer_name || `Pedido #${order.order_id || 'sem número'}`}</p>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase ${isPlatform?'bg-yellow-400/10 text-yellow-300':isPickup ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {isPlatform ? 'Entrega 99Food' : isPickup ? 'Retirada' : 'Balcão'}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Clock3 size={10} className="shrink-0" />{formatOrderTime(order)}<span>•</span><span className="min-w-0 truncate" title={financialCaption}>{financialCaption}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-emerald-400">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${(order.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                    {order.completed ? <CheckCircle2 size={14} className="ml-auto mt-1 text-emerald-500" /> : <Clock3 size={14} className="ml-auto mt-1 text-amber-400" />}
                  </div>
                </button>
              );
            })}
          </div>
          {storeOrdersDoDia.length > storeOrdersVisibleLimit && (
            <button
              type="button"
              onClick={() => setStoreOrdersVisibleLimit((limit) => limit + 12)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/70 bg-zinc-900/45 px-4 text-xs font-bold text-zinc-300 transition-colors active:bg-zinc-800"
              aria-label={`Mostrar mais pedidos da loja; ${storeOrdersDoDia.length - storeOrdersVisibleLimit} restantes`}
            >
              Ver mais {Math.min(12, storeOrdersDoDia.length - storeOrdersVisibleLimit)} pedidos
              <span className="text-[10px] font-medium text-zinc-500">{Math.min(storeOrdersVisibleLimit, storeOrdersDoDia.length)} de {storeOrdersDoDia.length}</span>
            </button>
          )}
        </section>
      )}

      {openRoutes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Execução</p><h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">Rotas em andamento {globalMotoboy && `· ${globalMotoboy}`}</h2></div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {openRoutes.length > 3 && (
                <button type="button" onClick={() => setCompactOpenRoutes((value) => !value)} aria-pressed={compactOpenRoutes} aria-label={compactOpenRoutes ? 'Mostrar todas as rotas abertas' : 'Mostrar apenas tres rotas abertas'} className="min-h-9 rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-bold text-zinc-200 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
                  {compactOpenRoutes ? 'Mostrar todas' : 'Focar em 3'}
                </button>
              )}
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-400">{openRoutes.length} {openRoutes.length === 1 ? 'aberta' : 'abertas'}</span>
            </div>
          </div>
          {openRoutes.map((route, index) => (
            !compactOpenRoutes || index < 3 ? (
              <RouteAccordion key={route.id} route={route} defaultOpen={false} />
            ) : null
          ))}
          {compactOpenRoutes && openRoutes.length > 3 && (
            <button type="button" onClick={() => setCompactOpenRoutes(false)} className="min-h-11 rounded-2xl border border-zinc-700 bg-zinc-900/70 px-4 text-xs font-bold text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label={`Exibir todas as ${openRoutes.length} rotas abertas`}>
              Exibir mais {openRoutes.length - 3} rotas abertas
            </button>
          )}
        </section>
      )}

      {closedRoutes.length > 0 && (
        <ClosedRoutesSection
          key={`${selectedDateKey}:${globalMotoboy || 'all'}`}
          routes={closedRoutes}
          motoboys={motoboys}
          motoboyFilter={globalMotoboy}
        />
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
