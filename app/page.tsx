'use client';

import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Package } from 'lucide-react';
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

  // Filtra as rotas para mostrar APENAS as do dia selecionado
  const selectedDateStr = selectedDate.toDateString();
  let routesDoDia = routes.filter((r) => {
    const routeDate = new Date(r.departure_time).toDateString();
    return routeDate === selectedDateStr;
  });

  // REDE DE SEGURANÇA (Auto-Recuperação Inteligente):
  const routeIdsDoDia = routesDoDia.map(r => r.id);
  
  // Pegamos todas as entregas do dia selecionado
  let deliveriesDoDia = deliveries.filter(d => {
    const belongsToRoute = routeIdsDoDia.includes(d.route_id);
    const deliveryDateStr = new Date(d.updated_at || Date.now()).toDateString();
    return belongsToRoute || deliveryDateStr === selectedDateStr;
  });

  // Se houver entregas soltas para este dia mas nenhuma rota oficial, criamos a rota de resgate
  // E amarramos o route_id da entrega para ela cair dentro da rota visualmente!
  if (deliveriesDoDia.length > 0 && routesDoDia.length === 0) {
    const rescueRouteId = 'rota-resgate-recuperada';
    
    // Força a entrega a pertencer à rota de resgate para aparecer no acordeão
    deliveriesDoDia = deliveriesDoDia.map(d => ({
      ...d,
      route_id: rescueRouteId
    }));

    const rescueRoute: Route = {
      id: rescueRouteId,
      name: 'Rota Geral de Recuperação',
      status: 'aberta',
      motoboy_name: 'Sincronizado da Nuvem',
      departure_time: selectedDate.toISOString(),
      change_money: 0,
      drinks_summary: 'Recuperado automaticamente do Cofre/Firebase'
    };
    routesDoDia = [rescueRoute];
  }
  
  const totalEntregas = deliveriesDoDia.length;
  const faturamentoTotal = deliveriesDoDia.reduce((acc, delivery) => acc + (delivery.value || 0), 0);

  const openRoutes = routesDoDia.filter((r) => r.status === 'aberta');
  const closedRoutes = routesDoDia.filter((r) => r.status === 'fechada');

  return (
    <div className="flex flex-col gap-5">
      {/* Filtro de data */}
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

      {/* PAINEL DE RESUMO DO DIA (DASHBOARD) */}
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
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento</span>
          </div>
          <p className="font-heading text-2xl font-bold text-zinc-50">
            R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Rotas abertas */}
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

      {/* Rotas fechadas (vão caindo pra cá) */}
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
