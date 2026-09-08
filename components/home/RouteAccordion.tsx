'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crosshair,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Receipt,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
  Trash2,
  Undo2,
  User,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

import type { Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { DeliveryCard } from '@/components/home/DeliveryCard';
import { useOptimizedDeliveries } from '@/hooks/useOptimizedDeliveries';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from '@capacitor/haptics';

import {
  generateClientDispatchUrl,
  generateRouteMessages,
} from '@/lib/whatsapp';
import {
  buildGoogleMapsRouteUrl,
  distanceMeters,
  extractLatLngFromMapsUrl,
  formatDistance,
  optimizePointsNearestNeighbor,
  resolveStopLocation,
  type LatLngPoint,
} from '@/lib/maps';
import { dateKey, routeDate, routeStartedAt } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';

interface RouteAccordionProps {
  route: Route;
  defaultOpen?: boolean;
}

export function RouteAccordion({ route, defaultOpen = false }: RouteAccordionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [fuzzyModalOpen, setFuzzyModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false); 
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [currentFuzzyList, setCurrentFuzzyList] = useState<any[]>([]);
  const [pendingActionType, setPendingActionType] = useState<'copy1' | 'copy2' | 'maps' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [optimizerBusy, setOptimizerBusy] = useState(false);
  const [optimizerOrigin, setOptimizerOrigin] = useState<LatLngPoint | null>(null);
  const [optimizerOriginLabel, setOptimizerOriginLabel] = useState('Localização atual');
  const [optimizerOrder, setOptimizerOrder] = useState<string[]>([]);
  const [optimizerPreviousOrder, setOptimizerPreviousOrder] = useState<string[]>([]);
  const [optimizerApproximateIds, setOptimizerApproximateIds] = useState<string[]>([]);
  const [lastAppliedOrder, setLastAppliedOrder] = useState<string[] | null>(null);

  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const reopenRoute = useAppStore((state) => state.reopenRoute);
  const startRoute = useAppStore((state) => state.startRoute); 
  const deleteRoute = useAppStore((state) => state.deleteRoute); 
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const allRoutes = useAppStore((state) => state.routes);
  const setDeliveryOrder = useAppStore((state) => state.setDeliveryOrder);
  
  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const storeSettings = useAppStore((state) => state.storeSettings);
  const motoboys = useAppStore((state) => state.motoboys);

  const deliveries = getDeliveriesByRoute(route.id);
  const totalDeliveries = deliveries.length;
  const pendingDeliveriesCount = deliveries.filter((d) => !d.completed).length;
  const progressPercent = totalDeliveries > 0 ? ((totalDeliveries - pendingDeliveriesCount) / totalDeliveries) * 100 : 0;
  
  const routeTotalValue = deliveries.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const operationalRouteDate = routeDate(route);
  const operationalRouteDateKey = operationalRouteDate ? dateKey(operationalRouteDate) : '';
  const routeDetailsHref = operationalRouteDateKey
    ? `/rotas/details?id=${route.id}&date=${encodeURIComponent(operationalRouteDateKey)}`
    : `/rotas/details?id=${route.id}`;

  const startedAt = routeStartedAt(route);
  const isNotStarted = route.status === 'aberta' && !startedAt;
  const isInProgress = route.status === 'aberta' && !!startedAt;
  const isCompleted = route.status === 'fechada';

  const motoboyObj = motoboys.find((m) => m.name === route.motoboy_name);
  const MotoIcon = motoboyObj?.avatar?.includes('woman') ? UserRound : motoboyObj?.avatar?.includes('bike') ? Bike : User;

  const { sortedDeliveries, pendingDeliveries, addressCounts, normalizedAddress } = useOptimizedDeliveries(deliveries, getCustomerById);

  const optimizerRows = useMemo(() => {
    const orderIds = optimizerOrder.length > 0
      ? optimizerOrder
      : pendingDeliveries.map((delivery) => delivery.id);

    return orderIds
      .map((id) => pendingDeliveries.find((delivery) => delivery.id === id))
      .filter(Boolean)
      .map((delivery) => {
        const customer = getCustomerById(delivery!.customer_id);
        const point =
          extractLatLngFromMapsUrl(delivery!.maps_link) ||
          extractLatLngFromMapsUrl(customer?.maps_link);

        return {
          delivery: delivery!,
          customer,
          point,
          approximate: optimizerApproximateIds.includes(delivery!.id),
        };
      });
  }, [
    getCustomerById,
    optimizerApproximateIds,
    optimizerOrder,
    pendingDeliveries,
  ]);

  // Clientes com telefone para disparo de aviso de saída
  const clientsWithPhone = deliveries
    .map((d) => {
      const cust = getCustomerById(d.customer_id);
      const phone = d.phone || cust?.phone;
      return {
        id: d.id,
        name: cust?.name || 'Cliente',
        phone,
        orderId: d.order_id
      };
    })
    .filter((c) => !!c.phone);

  let routeDuration = '';
  if (isCompleted && startedAt && route.end_time) {
    const start = firstValidTimestamp(startedAt);
    const end = firstValidTimestamp(route.end_time);
    const diffMins =
      start && end ? Math.floor((end.getTime() - start.getTime()) / 60000) : -1;

    if (diffMins >= 0) {
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      routeDuration = hrs > 0 ? `${hrs}h${mins}m` : `${mins}min`;
    }
  }

  const getPreviousRoute = (): Route | null => {
    if (!allRoutes || allRoutes.length === 0) return null;
    const motoboyRoutes = allRoutes
      .filter((r) => r.motoboy_name === route.motoboy_name)
      .sort((a, b) => {
        const timeA = firstValidTimestamp(routeDate(a))?.getTime() ?? Number.POSITIVE_INFINITY;
        const timeB = firstValidTimestamp(routeDate(b))?.getTime() ?? Number.POSITIVE_INFINITY;
        return timeA - timeB;
      });
    
    const currentIndex = motoboyRoutes.findIndex((r) => r.id === route.id);
    return currentIndex > 0 ? motoboyRoutes[currentIndex - 1] : null;
  };

  const handleStartRoute = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await startRoute(route.id);
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
      toast.success('Rota iniciada.', { description: 'O horário real de saída foi registrado.' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a rota.');
    } finally { setActionBusy(false); }
  };

  const handleCloseRoute = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await closeRoute(route.id);
      if (Capacitor.isNativePlatform()) await Haptics.notification({ type: NotificationType.Success });
      toast.success('Rota finalizada!', { description: 'Enviada para as rotas concluídas.' });
      setIsOpen(false);

      if (routeAlertsEnabled && Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [{
          title: 'Rota finalizada',
          body: `O motoboy ${route.motoboy_name} encerrou a rota.`,
          id: Math.floor(Math.random() * 100000), 
          schedule: { at: new Date(Date.now() + 1000) }, 
        }]
      });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível finalizar a rota.');
    } finally { setActionBusy(false); }
  };

  const handleDeleteEmptyRoute = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }
      await deleteRoute(route.id);
      toast.success('Rota excluída.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir a rota.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const confirmReopenRoute = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
      await reopenRoute(route.id);
      setIsReopenModalOpen(false);
      toast.success('Rota reaberta para correções.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível reabrir a rota.',
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyMessage = async (msgType: 1 | 2) => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const previousRoute = getPreviousRoute();
    
    const result = await generateRouteMessages(route, pendingDeliveries, storeAddr, getCustomerById, previousRoute);
    
    if (result.hasFuzzyAddresses && result.fuzzyList.length > 0 && msgType === 1) {
      setCurrentFuzzyList(result.fuzzyList);
      setPendingActionType(msgType === 1 ? 'copy1' : 'copy2');
      setFuzzyModalOpen(true);
      return;
    }

    executeCopyAction(msgType, result.messages);
  };

  const executeCopyAction = async (msgType: 1 | 2, messages?: string[]) => {
    setFuzzyModalOpen(false);
    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const previousRoute = getPreviousRoute();
    
    const msgsToCopy = messages || (await generateRouteMessages(route, pendingDeliveries, storeAddr, getCustomerById, previousRoute)).messages;

    if (msgType === 1) {
      await navigator.clipboard.writeText(msgsToCopy[0]);
      toast.success('Mensagem 1 copiada!', { description: 'Rota e mapas prontos para o WhatsApp.' });
    } else {
      await navigator.clipboard.writeText(msgsToCopy[1]);
      toast.success('Mensagem 2 copiada!', { description: 'Resumo, bebidas e valor exato a passar pro caixa prontos.' });
    }
    setIsCopyMenuOpen(false);
  };

  const getCurrentOrigin = async (): Promise<{ point: LatLngPoint | null; label: string }> => {
    try {
      const permission = await Geolocation.checkPermissions();
      let locationPermission = permission.location;

      if (locationPermission !== 'granted') {
        const requested = await Geolocation.requestPermissions({
          permissions: ['location'],
        });
        locationPermission = requested.location;
      }

      if (locationPermission === 'granted') {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });

        return {
          point: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          label: 'Minha localização atual',
        };
      }
    } catch (error) {
      console.warn('GPS indisponível para organizar rota:', error);
    }

    return { point: null, label: 'GPS indisponível' };
  };

  const buildOptimizerPreview = async () => {
    if (optimizerBusy || pendingDeliveries.length < 2) return;
    setOptimizerBusy(true);

    try {
      const previousIds = pendingDeliveries.map((delivery) => delivery.id);

      const precise = pendingDeliveries
        .map((delivery) => {
          const customer = getCustomerById(delivery.customer_id);
          const point =
            extractLatLngFromMapsUrl(delivery.maps_link) ||
            extractLatLngFromMapsUrl(customer?.maps_link);

          return point ? { delivery, point } : null;
        })
        .filter(Boolean) as Array<{
          delivery: typeof pendingDeliveries[number];
          point: LatLngPoint;
        }>;

      const approximate = pendingDeliveries.filter(
        (delivery) => !precise.some((item) => item.delivery.id === delivery.id),
      );

      const current = await getCurrentOrigin();

      setOptimizerPreviousOrder(previousIds);
      setOptimizerApproximateIds(approximate.map((delivery) => delivery.id));
      setOptimizerOrigin(current.point);
      setOptimizerOriginLabel(current.label);

      if (!current.point) {
        setOptimizerOrder(previousIds);
        setOptimizerOpen(true);
        toast.warning('Não foi possível usar sua localização atual.', {
          description: 'Ative a localização do aparelho para calcular a rota por distância.',
        });
        return;
      }

      const optimizedPrecise = optimizePointsNearestNeighbor(current.point, precise);
      const nextIds = [
        ...optimizedPrecise.map((item) => item.delivery.id),
        ...approximate.map((delivery) => delivery.id),
      ];

      setOptimizerOrder(nextIds);
      setOptimizerOpen(true);

      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    } finally {
      setOptimizerBusy(false);
    }
  };

  const applyOptimizerOrder = async () => {
    if (optimizerOrder.length < 2 || !optimizerOrigin) return;
    setOptimizerBusy(true);

    try {
      await setDeliveryOrder(route.id, optimizerOrder);
      setLastAppliedOrder(optimizerPreviousOrder);
      setOptimizerOpen(false);

      if (Capacitor.isNativePlatform()) {
        await Haptics.notification({ type: NotificationType.Success });
      }

      toast.success('Ordem sugerida aplicada.', {
        description: 'Você pode desfazer enquanto a rota continuar aberta.',
      });
    } catch {
      toast.error('Não foi possível aplicar a ordem sugerida.');
    } finally {
      setOptimizerBusy(false);
    }
  };

  const undoOptimizerOrder = async () => {
    if (!lastAppliedOrder?.length) return;

    try {
      await setDeliveryOrder(route.id, lastAppliedOrder);
      setLastAppliedOrder(null);

      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }

      toast.success('Ordem anterior restaurada.');
    } catch {
      toast.error('Não foi possível restaurar a ordem anterior.');
    }
  };

  const handleOpenMaps = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    
    const stops = pendingDeliveries.map((d) => {
      const cust = getCustomerById(d.customer_id);
      return resolveStopLocation(d, cust?.maps_link);
    });

    if (stops.length === 0) return;

    const storeAddr = storeSettings?.storeAddress || 'Patos de Minas, MG';
    const mapUrl = buildGoogleMapsRouteUrl(storeAddr, stops);

    window.open(mapUrl, '_blank');
  };

  return (
    <div className={clsx("overflow-hidden rounded-[28px] border transition-all duration-300 relative", isNotStarted ? "bg-zinc-900/60 border-zinc-700/80" : isInProgress ? "bg-sky-900/10 border-sky-500/30" : "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]")}>
      {totalDeliveries > 0 && !isCompleted && (
        <div className="absolute top-0 left-0 h-1 bg-zinc-800 w-full">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
      <button onClick={() => setIsOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 p-4 pt-5 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3">
          <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full transition-colors shrink-0', isNotStarted ? 'bg-zinc-800 text-zinc-400' : isInProgress ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-500')}>
            <Bike size={22} />
          </div>
          <div className="text-left flex flex-col">
            <div className="flex items-center gap-2">
              <p className={clsx("font-heading text-lg font-bold truncate max-w-[130px]", isCompleted ? "text-emerald-400" : "text-zinc-50")}>{route.name}</p>
              {isNotStarted && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-300">Montando</span>}
              {isInProgress && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow-sm shadow-sky-500/30">Na Rua</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-zinc-400">
              <MotoIcon size={12} className={isInProgress ? 'text-sky-400' : isCompleted ? 'text-emerald-500' : 'text-zinc-500'} />
              <span className="truncate max-w-[120px]">{route.motoboy_name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isCompleted ? (
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", pendingDeliveriesCount === 0 && totalDeliveries > 0 ? "bg-emerald-500 text-white" : isInProgress ? "bg-sky-500/20 text-sky-400" : "bg-zinc-800 text-zinc-400")}>
              {pendingDeliveriesCount === 0 && totalDeliveries > 0 ? 'Concluída!' : `${pendingDeliveriesCount} pendente${pendingDeliveriesCount !== 1 ? 's' : ''}`}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {routeDuration && (
                <div className="flex items-center gap-1 bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-full">
                  <Timer size={12} className="text-zinc-400" />
                  <span className="text-zinc-300 font-bold text-[10px]">{routeDuration}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold text-[11px]">
                  {isPrivacyMode ? 'R$ •••••' : `R$ ${routeTotalValue.toFixed(2).replace('.', ',')}`}
                </span>
              </div>
            </div>
          )}
          <ChevronDown size={18} className={clsx('text-zinc-500 transition-transform duration-200 ml-1', isOpen && 'rotate-180')} />
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-zinc-800/80 p-4 pt-3 pb-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {route.change_money > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500">
                <Wallet size={13} /> Levar Troco: {isPrivacyMode ? 'R$ •••••' : `R$ ${route.change_money.toFixed(2).replace('.', ',')}`}
              </span>
            )}

            {clientsWithPhone.length > 0 && (
              <button 
                onClick={() => setIsDispatchModalOpen(true)}
                className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold active:scale-95 transition-all shadow-sm"
              >
                <Send size={12} /> Avisar Clientes ({clientsWithPhone.length})
              </button>
            )}
          </div>

          {sortedDeliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-600">Nenhuma entrega nesta rota ainda.</p>
          ) : (
            sortedDeliveries.map((delivery) => {
              const cust = getCustomerById(delivery.customer_id);
              const addressKey = normalizedAddress(delivery.address_string || cust?.address);
              const isNeighbor = addressKey ? (addressCounts[addressKey] > 1) : false;
              const pendingIndex = pendingDeliveries.findIndex((item) => item.id === delivery.id);
              return (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  customer={cust}
                  route={route}
                  isNeighbor={isNeighbor}
                  position={pendingIndex >= 0 ? pendingIndex + 1 : undefined}
                  pendingCount={pendingDeliveries.length}
                />
              );
            })
          )}
          
          <div className="mt-2 flex flex-col gap-2">
            {sortedDeliveries.length === 0 && isNotStarted && (
              <button onClick={handleDeleteEmptyRoute} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-red-500/10 border border-red-500/20 py-3.5 text-sm font-bold text-red-500 hover:bg-red-500/20 active:scale-95 transition-all">
                <Trash2 size={18} /> Excluir Rota Vazia
              </button>
            )}
            {sortedDeliveries.length > 0 && route.status === 'aberta' && (
              <div className="flex flex-col gap-2 rounded-[22px] border border-zinc-700/80 bg-zinc-950/70 p-2.5">
                <button
                  onClick={buildOptimizerPreview}
                  disabled={optimizerBusy || pendingDeliveries.length < 2}
                  className="flex w-full items-center justify-between rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/15 to-sky-500/10 px-4 py-3 text-left active:scale-[0.99] disabled:opacity-40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-black text-zinc-100">Organizar rota</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">GPS atual + pontos precisos</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-violet-300" />
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setIsCopyMenuOpen(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-semibold text-zinc-300 active:scale-95">
                    <Copy size={15} className="text-emerald-500" />
                    WhatsApp
                  </button>
                  <button onClick={handleOpenMaps} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white active:scale-95">
                    <MapPin size={15} />
                    Abrir no Maps
                  </button>
                </div>

                {lastAppliedOrder && (
                  <button
                    onClick={undoOptimizerOrder}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-[11px] font-black text-amber-300 active:scale-95"
                  >
                    <Undo2 size={14} />
                    Desfazer organização
                  </button>
                )}
              </div>
            )}
            {route.status === 'aberta' && totalDeliveries > 0 ? (
              !startedAt ? (
                <button
                  onClick={handleStartRoute}
                  disabled={actionBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-sky-500/20 bg-sky-500/10 py-3.5 text-sm font-bold text-sky-500 active:scale-95 disabled:opacity-50"
                >
                  <Timer size={18} /> Iniciar rota
                </button>
              ) : (
                <button
                  onClick={handleCloseRoute}
                  disabled={actionBusy || pendingDeliveriesCount > 0}
                  className={clsx(
                    "flex w-full items-center justify-center gap-2 rounded-[20px] border py-3.5 text-sm font-bold transition-all active:scale-95 disabled:active:scale-100",
                    pendingDeliveriesCount === 0
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/15"
                      : "cursor-not-allowed border-zinc-800 bg-zinc-900/70 text-zinc-600",
                    actionBusy && "opacity-50",
                  )}
                >
                  <CheckCircle2 size={18} />
                  {pendingDeliveriesCount > 0
                    ? `${pendingDeliveriesCount} entrega${pendingDeliveriesCount === 1 ? '' : 's'} pendente${pendingDeliveriesCount === 1 ? '' : 's'}`
                    : 'Finalizar rota'}
                </button>
              )
            ) : null}
            {route.status === 'fechada' && (
              <button
                onClick={() => setIsReopenModalOpen(true)}
                disabled={actionBusy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-[20px] border border-amber-500/20 bg-amber-500/[.06] py-3.5 text-sm font-semibold text-amber-400 active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={16} /> Reabrir rota para correções
              </button>
            )}
            <button onClick={() => router.push(routeDetailsHref)} className="flex w-full items-center justify-center rounded-[18px] border border-zinc-800 py-3 text-xs font-bold text-zinc-400 active:scale-95">Ver detalhes da rota</button>
          </div>
        </div>
      )}

      {optimizerOpen && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="max-h-[88vh] overflow-hidden rounded-t-[34px] border-t border-zinc-700 bg-[#151515]">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 pb-4 pt-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Sparkles size={20} />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Prévia inteligente</p>
                  <h3 className="mt-1 font-heading text-xl font-black text-zinc-50">Nova sequência</h3>
                  <p className="mt-1 text-[11px] text-zinc-500">Nada muda até você confirmar.</p>
                </div>
              </div>
              <button onClick={() => setOptimizerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-180px)] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[.07] p-3">
                  <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-sky-400">
                    <Crosshair size={11} /> Origem
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-200">{optimizerOriginLabel}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.07] p-3">
                  <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                    <MapPinned size={11} /> Precisão
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-200">
                    {pendingDeliveries.length - optimizerApproximateIds.length}/{pendingDeliveries.length} pontos
                  </p>
                </div>
              </div>

              {optimizerApproximateIds.length > 0 && (
                <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-3">
                  <p className="flex items-center gap-2 text-[10px] font-black text-amber-300">
                    <AlertTriangle size={13} />
                    {optimizerApproximateIds.length} parada{optimizerApproximateIds.length !== 1 ? 's' : ''} sem coordenadas
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    Elas não entram no cálculo de distância e mantêm a ordem relativa atual.
                  </p>
                </div>
              )}

              {!optimizerOrigin && (
                <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/[.06] p-3">
                  <p className="text-[10px] font-black text-red-300">GPS indisponível</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Ative a localização do aparelho para calcular a sequência por distância.
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {optimizerRows.map((row, index) => {
                  const previousIndex = optimizerPreviousOrder.indexOf(row.delivery.id);
                  const changed = previousIndex !== index;

                  let legDistance: string | null = null;
                  if (optimizerOrigin && row.point) {
                    const previousPrecise = optimizerRows.slice(0, index).reverse().find((item) => item.point);
                    const from = previousPrecise?.point || optimizerOrigin;
                    legDistance = formatDistance(distanceMeters(from, row.point));
                  }

                  return (
                    <div
                      key={row.delivery.id}
                      className={`rounded-[20px] border p-3 ${
                        row.approximate
                          ? 'border-amber-500/15 bg-amber-500/[.04]'
                          : changed
                            ? 'border-violet-500/20 bg-violet-500/[.06]'
                            : 'border-zinc-800 bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${
                          row.approximate
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-violet-500/10 text-violet-300'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-zinc-200">
                            {row.customer?.name || row.delivery.customer_name || `Pedido ${row.delivery.order_id || ''}`}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-zinc-500">
                            {row.delivery.address_string || 'Endereço não informado'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {row.approximate ? (
                            <span className="text-[9px] font-black text-amber-400">Aproximado</span>
                          ) : (
                            <span className="text-[9px] font-black text-emerald-400">{legDistance || 'Preciso'}</span>
                          )}
                          {changed && (
                            <p className="mt-1 text-[9px] font-bold text-zinc-600">era {previousIndex + 1}º</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/80 p-4 pb-7">
              <button
                onClick={applyOptimizerOrder}
                disabled={optimizerBusy || optimizerOrder.length < 2 || !optimizerOrigin}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3.5 text-sm font-black text-white disabled:opacity-40"
              >
                <Navigation size={17} />
                Aplicar ordem sugerida
              </button>
              <button onClick={() => setOptimizerOpen(false)} className="mt-2 flex h-11 w-full items-center justify-center text-xs font-bold text-zinc-500">
                Manter ordem atual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BOTTOM SHEET DE CÓPIA DO WHATSAPP */}
      {isCopyMenuOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 animate-in fade-in">
          <div className="bg-[#1a1a1a] rounded-t-[32px] p-6 pb-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 relative">
             <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-700" />
             <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-xl text-zinc-50 flex items-center gap-2"><Copy size={20} className="text-emerald-500"/> Enviar para WhatsApp</h3>
               <button onClick={() => setIsCopyMenuOpen(false)} className="p-2.5 bg-zinc-800 rounded-full text-zinc-400 active:scale-90"><X size={20}/></button>
             </div>

             <div className="flex flex-col gap-4">
                <button onClick={() => handleCopyMessage(1)} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-3xl active:scale-95 transition-all text-left">
                  <div className="h-14 w-14 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0"><MapPin size={24}/></div>
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-100 text-lg">Mensagem 1 (Logística)</span>
                    <span className="text-xs text-zinc-400 font-medium mt-1 leading-relaxed">Copia os endereços, IDs, botão de chamar no portão e o link do Mapa otimizado.</span>
                  </div>
                </button>
                
                <button onClick={() => handleCopyMessage(2)} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-3xl active:scale-95 transition-all text-left">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0"><Receipt size={24}/></div>
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-100 text-lg">Mensagem 2 (Acerto)</span>
                    <span className="text-xs text-zinc-400 font-medium mt-1 leading-relaxed">Bebidas, aviso de maquininha e o valor bruto real a recolher no caixa.</span>
                  </div>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL PARA O BALCÃO AVISAR CLIENTES DA SAÍDA */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <MessageCircle size={22} />
                <h3 className="text-base font-bold text-zinc-50">Avisar Saída do Pedido</h3>
              </div>
              <button onClick={() => setIsDispatchModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">Toque no cliente para abrir a conversa no WhatsApp avisando que o motoboy <strong className="text-zinc-200">{route.motoboy_name}</strong> saiu com a entrega:</p>
            
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {clientsWithPhone.map((c) => (
                <a
                  key={c.id}
                  href={generateClientDispatchUrl(c.name, c.phone!, route.motoboy_name)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 active:scale-95 transition-all"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="text-xs font-bold text-zinc-200 truncate">{c.name} {c.orderId && `(#${c.orderId})`}</span>
                    <span className="text-[10px] text-zinc-500">{c.phone}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl shrink-0">
                    Avisar <Send size={10} />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REABERTURA */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-zinc-50">Atenção ao Reabrir</h3>
              </div>
              <button onClick={() => setIsReopenModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
              Se você precisa <strong className="text-amber-400">apenas consultar</strong> dados, não é necessário reabrir. As entregas já estão visíveis acima.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed px-1">Reabrir a rota reiniciará o status para aberta e permitirá edições. O tempo original de entrega da rota está seguro.</p>
            <div className="flex flex-col gap-2.5 pt-3">
              <button onClick={confirmReopenRoute} className="w-full h-12 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-zinc-950 text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/20">Sim, Reabrir para Alterações</button>
              <button onClick={() => setIsReopenModalOpen(false)} className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-zinc-300 text-xs active:scale-95 transition-all">Cancelar e Manter Fechada</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENDEREÇOS FUZZY */}
      {fuzzyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2.5 text-amber-400"><AlertTriangle size={24} /><h3 className="text-lg font-bold text-zinc-50">Endereços Incompletos</h3></div><button onClick={() => setFuzzyModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button></div>
            <p className="text-xs text-zinc-400 leading-relaxed">Encontramos <strong className="text-zinc-200">{currentFuzzyList.length}</strong> {currentFuzzyList.length === 1 ? 'parada' : 'paradas'} sem número explícito. O Google Maps pode se confundir.</p>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {currentFuzzyList.map((item, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl flex flex-col gap-1">
                  <span className="text-xs font-bold text-zinc-200">{item.index}️⃣ {item.name}</span>
                  <span className="text-[11px] text-zinc-400 truncate">{item.address}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button onClick={() => { if (pendingActionType) executeCopyAction(pendingActionType === 'copy1' ? 1 : 2); }} className="w-full h-12 bg-sky-500 hover:bg-sky-400 rounded-xl font-bold text-zinc-950 text-sm active:scale-95 transition-all shadow-lg shadow-sky-500/20">Prosseguir Mesmo Assim</button>
              <button onClick={() => setFuzzyModalOpen(false)} className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-zinc-300 text-xs active:scale-95 transition-all">Cancelar e Inserir Links Manuais</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
