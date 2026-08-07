'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Package, Eye, EyeOff, Filter, Users, UserRound, Bike } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RouteAccordion } from '@/components/home/RouteAccordion';
import type { Route } from '@/types';

function formatDateLabel(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return 'Hoje';
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function HomePage() {
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries); 
  const motoboys = useAppStore((state) => state.motoboys);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const goToPreviousDay = useAppStore((state) => state.goToPreviousDay);
  const goToNextDay = useAppStore((state) => state.goToNextDay);
  
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode);

  const [globalMotoboy, setGlobalMotoboy] = useState<string | null>(null);

  const selectedDateStr = selectedDate.toDateString();
  
  let routesDoDia = routes.filter((r) => {
    const routeDate = new Date(r.departure_time || r.updated_at || Date.now()).toDateString();
    return routeDate === selectedDateStr;
  });

  if (globalMotoboy) {
    routesDoDia = routesDoDia.filter(r => r.motoboy_name === globalMotoboy);
  }

  // Ordenação Cronológica de Ferro
  routesDoDia.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());

  const routeIdsDoDia = routesDoDia.map(r => r.id);
  
  const deliveriesDoDia = deliveries.filter(d => {
    const belongsToRoute = routeIdsDoDia.includes(d.route_id);
    const deliveryDateStr = new Date(d.updated_at || Date.now()).toDateString();
    const isSameDay = deliveryDateStr === selectedDateStr;
    const isSameMotoboy = globalMotoboy ? (d as any).motoboy_name === globalMotoboy : true;
    
    return belongsToRoute || (isSameDay && isSameMotoboy && !d.route_id);
  });

  const orphanedDeliveries = deliveriesDoDia.filter(d => !routeIdsDoDia.includes(d.route_id));

  if (orphanedDeliveries.length > 0 && !globalMotoboy) {
    const rescueRoute: Route = {
      id: 'rota-resgate-recuperada',
      name: 'Rota Geral de Recuperação',
      status: 'aberta',
      motoboy_name: 'Sistema',
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

  // AGRUPAMENTO DE ROTAS FECHADAS POR MOTOBOY
  const closedRoutesByMotoboy = closedRoutes.reduce((acc, route) => {
    if (!acc[route.motoboy_name]) acc[route.motoboy_name] = [];
    acc[route.motoboy_name].push(route);
    return acc;
  }, {} as Record<string, Route[]>);

  const activeMotoboysToday = motoboys.filter(m => 
    routes.some(r => r.motoboy_name === m.name && new Date(r.departure_time).toDateString() === selectedDateStr)
  );

  // Função para pegar ícone do motoboy para o cabeçalho do grupo
  const getMotoboyIcon = (name: string) => {
    const m = motoboys.find(mb => mb.name === name);
    if (m?.avatar?.includes('woman')) return UserRound;
    if (m?.avatar?.includes('bike')) return Bike;
    return Users;
  };

  return (
    <div className="flex flex-col gap-5 pb-32">
      
      <div className="flex items-center justify-between rounded-[20px] border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
        <button onClick={goToPreviousDay} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 active:scale-90"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><CalendarDays size={15} className="text-emerald-500" />{formatDateLabel(selectedDate)}</div>
        <button onClick={goToNextDay} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 active:scale-90"><ChevronRight size={18} /></button>
      </div>

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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-[20px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-zinc-400"><Package size={16} className="text-sky-400" /><span className="text-xs font-semibold uppercase tracking-wider">Entregas</span></div>
          <p className="font-heading text-2xl font-bold text-zinc-50">{totalEntregas}</p>
        </div>

        <div className="flex flex-col gap-1.5 rounded-[20px] border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /><span className="text-xs font-semibold uppercase tracking-wider">Faturamento</span></div>
            <button onClick={togglePrivacyMode} className="text-zinc-500 hover:text-zinc-300 transition-colors active:scale-90">{isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <p className="font-heading text-2xl font-bold text-zinc-50">{isPrivacyMode ? 'R$ •••••' : `R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
        </div>
      </div>

      {openRoutes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="px-1 font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">
            Em andamento {globalMotoboy && `(${globalMotoboy})`}
          </h2>
          {openRoutes.map((route, index) => (
            <RouteAccordion key={route.id} route={route} defaultOpen={index === 0} />
          ))}
        </div>
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
          <p className="text-sm text-zinc-500">Nenhuma rota {globalMotoboy ? 'para este motoboy' : 'neste dia'}.</p>
        </div>
      )}
    </div>
  );
}
