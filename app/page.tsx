'use client';

import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Package, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RouteAccordion } from '@/components/home/RouteAccordion';
import type { Route } from '@/types';

function formatDateLabel(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) return 'Hoje';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function HomePage() {
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries); 
  const selectedDate = useAppStore((state) => state.selectedDate);
  const goToPreviousDay = useAppStore((state) => state.goToPreviousDay);
  const goToNextDay = useAppStore((state) => state.goToNextDay);
  
  // MODO PRIVACIDADE IMPORTADOS
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode);

  const selectedDateStr = selectedDate.toDateString();
  let routesDoDia = routes.filter((r) => {
    const routeDate = new Date(r.departure_time).toDateString();
    return routeDate === selectedDateStr;
  });

  const routeIdsDoDia = routesDoDia.map(r => r.id);
  
  const deliveriesDoDia = deliveries.filter(d => {
    const belongsToRoute = routeIdsDoDia.includes(d.route_id);
    const deliveryDateStr = new Date(d.updated_at || Date.now()).toDateString();
    const isSameDay = deliveryDateStr === selectedDateStr;
    
    return belongsToRoute || isSameDay;
  });

  const orphanedDeliveries = deliveriesDoDia.filter(d => !routeIdsDoDia.includes(d.route_id));

  if (orphanedDeliveries.length > 0) {
    const rescueRoute: Route = {
      id: 'rota-resgate-recuperada',
      name: 'Rota Geral de Recuperação',
      status: 'aberta',
      motoboy_name: 'Sincronizado da Nuvem',
      departure_time: selectedDate.toISOString(),
      change_money: 0,
      drinks_summary: 'Recuperado automaticamente'
    };
    routesDoDia.push(rescueRoute);
  }

  const totalEntregas = deliveriesDoDia.length;
  const faturamentoTotal = deliveriesDoDia.reduce((acc, delivery) => acc + (delivery.value || 0), 0);

  const openRoutes = routesDoDia.filter((r) => r.status === 'aberta');
  const closedRoutes = routesDoDia.filter((r) => r.status === 'fechada');

  return (
    <div className="flex flex-col gap-5 pb-32">
      <div className="flex items-center justify-between rounded-[20px] border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <button
          onClick={goToPreviousDay}
          aria-label="Dia anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-transform active:scale-90"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <CalendarDays size={15} className="text-emerald-500" />
          {formatDateLabel(selectedDate)}
        </div>

        <button
          onClick={goToNextDay}
          aria-label="Próximo dia"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-transform active:scale-90"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-[20px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Package size={16} className="text-sky-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Entregas</span>
          </div>
          <p className="font-heading text-2xl font-bold text-zinc-50">
            {totalEntregas}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 rounded-[20px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">Faturamento</span>
            </div>
            {/* NOVO BOTÃO DE PRIVACIDADE NA HOME */}
            <button 
              onClick={togglePrivacyMode} 
              className="text-zinc-500 hover:text-zinc-300 transition-colors active:scale-90"
            >
              {isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="font-heading text-2xl font-bold text-zinc-50">
            {isPrivacyMode 
              ? 'R$ •••••' 
              : `R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </p>
        </div>
      </div>

      {openRoutes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="px-1 font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">
            Rotas em andamento
          </h2>
          {openRoutes.map((route, index) => (
            <RouteAccordion key={route.id} route={route} defaultOpen={index === 0} />
          ))}
        </div>
      )}

      {closedRoutes.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <h2 className="px-1 font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">
            Rotas finalizadas
          </h2>
          {closedRoutes.map((route) => (
            <RouteAccordion key={route.id} route={route} />
          ))}
        </div>
      )}

      {routesDoDia.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-zinc-500">Nenhuma rota aberta neste dia.</p>
          <p className="text-xs text-zinc-600">Toque no + para abrir a primeira rota.</p>
        </div>
      )}
    </div>
  );
}
