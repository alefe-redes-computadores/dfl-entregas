'use client';

import { useState } from 'react';
import { ChevronDown, Bike, Wallet, CheckCircle2, RotateCcw, Timer, MapPin, Copy, User, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { DeliveryCard } from '@/components/home/DeliveryCard';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { copyFullRouteToClipboard } from '@/lib/whatsapp';

interface RouteAccordionProps {
  route: Route;
  defaultOpen?: boolean;
}

export function RouteAccordion({ route, defaultOpen = false }: RouteAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const reopenRoute = useAppStore((state) => state.reopenRoute);
  const startRoute = useAppStore((state) => state.startRoute); 
  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const storeSettings = useAppStore((state) => state.storeSettings);
  const motoboys = useAppStore(state => state.motoboys);

  const deliveries = getDeliveriesByRoute(route.id);
  const totalDeliveries = deliveries.length;
  // NOVO: Contador real de pendências (Entregas não concluídas)
  const pendingDeliveriesCount = deliveries.filter((d) => !d.completed).length;
  const progressPercent = totalDeliveries > 0 ? ((totalDeliveries - pendingDeliveriesCount) / totalDeliveries) * 100 : 0;

  // Lógica Semáforo (Cores)
  const isNotStarted = route.status === 'aberta' && !route.started_at;
  const isInProgress = route.status === 'aberta' && !!route.started_at;
  const isCompleted = route.status === 'fechada';

  // Buscar avatar do motoboy
  const motoboyObj = motoboys.find(m => m.name === route.motoboy_name);
  const MotoIcon = motoboyObj?.avatar?.includes('woman') ? UserRound : motoboyObj?.avatar?.includes('bike') ? Bike : User;

  const pendingDeliveries = [...deliveries].filter(d => !d.completed).sort((a, b) => {
    const aUrgent = a.is_urgent ? 1 : 0;
    const bUrgent = b.is_urgent ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    const aOrder = a.order_index !== undefined ? a.order_index : new Date(a.updated_at || 0).getTime();
    const bOrder = b.order_index !== undefined ? b.order_index : new Date(b.updated_at || 0).getTime();
    return aOrder - bOrder;
  });

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    const timeA = new Date(a.updated_at || 0).getTime();
    const timeB = new Date(b.updated_at || 0).getTime();
    return (a.order_index ?? timeA) - (b.order_index ?? timeB);
  });

  const handleStartRoute = async () => {
    startRoute(route.id);
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    toast.success('Rota Iniciada! 🚀', { description: 'O cronômetro de performance está valendo.' });
  };

  const handleCloseRoute = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.notification({ type: NotificationType.Success });
    closeRoute(route.id);
    toast.success('Rota finalizada!', { description: 'Enviada para as rotas concluídas.' });
    setIsOpen(false);

    if (routeAlertsEnabled && Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [{
          title: '🎉 Rota Finalizada!',
          body: `O motoboy ${route.motoboy_name} encerrou a rota.`,
          id: Math.floor(Math.random() * 100000), 
          schedule: { at: new Date(Date.now() + 1000) }, 
        }]
      });
    }
  };

  return (
    <div className={clsx(
      "overflow-hidden rounded-[28px] border transition-all duration-300 relative",
      isNotStarted ? "bg-zinc-900/60 border-zinc-700/80" : 
      isInProgress ? "bg-sky-900/10 border-sky-500/30" : 
      "bg-emerald-900/10 border-emerald-500/30 opacity-75 grayscale"
    )}>
      
      {/* BARRA DE PROGRESSO NO TOPO */}
      {totalDeliveries > 0 && !isCompleted && (
        <div className="absolute top-0 left-0 h-1 bg-zinc-800 w-full">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      <button onClick={() => setIsOpen((prev) => !prev)} className="flex w-full items-center justify-between gap-3 p-4 pt-5">
        <div className="flex items-center gap-3">
          
          <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            isNotStarted ? 'bg-zinc-800 text-zinc-400' : 
            isInProgress ? 'bg-sky-500/20 text-sky-400' : 
            'bg-emerald-500/20 text-emerald-500'
          )}>
            <Bike size={22} />
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className={clsx("font-heading text-lg font-bold", isCompleted ? "text-emerald-400" : "text-zinc-50")}>
                {route.name}
              </p>
              {isNotStarted && <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-300">Montando</span>}
              {isInProgress && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow-sm shadow-sky-500/30">Na Rua</span>}
            </div>
            
            <div className="flex items-center gap-1.5 mt-0.5 text-xs font-semibold text-zinc-400">
              <MotoIcon size={12} className={isInProgress ? 'text-sky-400' : 'text-zinc-500'} />
              {route.motoboy_name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* BADGE DE PENDÊNCIAS CORRETO */}
          {!isCompleted ? (
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", 
              pendingDeliveriesCount === 0 && totalDeliveries > 0 ? "bg-emerald-500 text-white" :
              isInProgress ? "bg-sky-500/20 text-sky-400" : "bg-zinc-800 text-zinc-400"
            )}>
              {pendingDeliveriesCount === 0 && totalDeliveries > 0 ? 'Concluída!' : `${pendingDeliveriesCount} pendente${pendingDeliveriesCount !== 1 ? 's' : ''}`}
            </span>
          ) : (
             <CheckCircle2 size={20} className="text-emerald-500" />
          )}

          <ChevronDown size={18} className={clsx('text-zinc-500 transition-transform duration-200', isOpen && 'rotate-180')} />
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-zinc-800/80 p-4 pt-3 pb-6">
          {route.change_money > 0 && (
            <span className="self-start flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500">
              <Wallet size={13} /> Levar Troco: R$ {route.change_money.toFixed(2).replace('.', ',')}
            </span>
          )}

          {sortedDeliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-600">Nenhuma entrega nesta rota ainda.</p>
          ) : (
            sortedDeliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} customer={getCustomerById(delivery.customer_id)} />
            ))
          )}

          <div className="mt-2 flex flex-col gap-2">
            
            {sortedDeliveries.length > 0 && route.status === 'aberta' && (
              <div className="fixed bottom-24 left-0 right-0 z-40 mx-auto flex w-full max-w-[92%] items-center justify-between gap-3 rounded-[24px] border border-zinc-700/80 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl shadow-2xl shadow-black/50">
                <button onClick={() => copyFullRouteToClipboard(route, pendingDeliveries, storeSettings?.storeAddress || 'Patos de Minas, MG', getCustomerById)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800/80 text-sm font-semibold text-zinc-300 active:scale-95">
                  <Copy size={18} className="text-emerald-500" /><span className="truncate">Copiar Tudo</span>
                </button>
                <button onClick={() => window.open(`https://www.google.com/maps/dir/${encodeURIComponent(storeSettings?.storeAddress || 'Patos de Minas, MG')}/${pendingDeliveries.map(d => encodeURIComponent(d.address_string)).join('/')}`, '_blank')} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 active:scale-95">
                  <MapPin size={18} /><span className="truncate">Otimizar (Maps)</span>
                </button>
              </div>
            )}

            {route.status === 'aberta' ? (
              !route.started_at ? (
                <button onClick={handleStartRoute} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-sky-500/10 border border-sky-500/20 py-3.5 text-sm font-bold text-sky-500 hover:bg-sky-500/20 active:scale-95">
                  <Timer size={18} /> Iniciar Rota (Cronômetro)
                </button>
              ) : (
                <button onClick={handleCloseRoute} className={clsx("flex w-full items-center justify-center gap-2 rounded-[20px] py-3.5 text-sm font-bold active:scale-95 transition-all", pendingDeliveriesCount === 0 && totalDeliveries > 0 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-pulse" : "bg-zinc-800/80 text-zinc-300")}>
                  <CheckCircle2 size={18} className={pendingDeliveriesCount === 0 ? "text-white" : "text-emerald-500"} /> 
                  {pendingDeliveriesCount === 0 ? 'Tudo Entregue! Fechar Rota' : 'Finalizar Rota'}
                </button>
              )
            ) : (
              <button onClick={() => reopenRoute(route.id)} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-zinc-800/40 py-3.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 active:scale-95">
                <RotateCcw size={16} /> Reabrir Rota
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
