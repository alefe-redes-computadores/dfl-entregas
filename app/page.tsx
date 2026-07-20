'use client';

import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RouteAccordion } from '@/components/home/RouteAccordion';

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
  const selectedDate = useAppStore((state) => state.selectedDate);
  const goToPreviousDay = useAppStore((state) => state.goToPreviousDay);
  const goToNextDay = useAppStore((state) => state.goToNextDay);

  const openRoutes = routes.filter((r) => r.status === 'aberta');
  const closedRoutes = routes.filter((r) => r.status === 'fechada');

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

      {/* Rotas fechadas */}
      {closedRoutes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="px-1 font-heading text-sm font-bold uppercase tracking-wide text-zinc-500">
            Rotas finalizadas
          </h2>
          {closedRoutes.map((route) => (
            <RouteAccordion key={route.id} route={route} />
          ))}
        </div>
      )}

      {routes.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-zinc-500">Nenhuma rota criada para este dia.</p>
          <p className="text-xs text-zinc-600">Toque no + para abrir a primeira rota.</p>
        </div>
      )}
    </div>
  );
}
