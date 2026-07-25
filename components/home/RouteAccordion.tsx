'use client';

import { useState } from 'react';
import { ChevronDown, Bike, Wallet, PackageCheck, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { DeliveryCard } from '@/components/deliveries/DeliveryCard';

interface RouteAccordionProps {
  route: Route;
  defaultOpen?: boolean;
}

// Utilitário para formatar a duração da rota
function formatRouteDuration(departureTime: string, endTime?: string) {
  if (!endTime) return null;
  const start = new Date(departureTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMinutes = Math.floor((end - start) / (1000 * 60));
  
  if (diffMinutes < 0) return null;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes > 0 ? `${minutes}min` : ''}`;
}

export function RouteAccordion({ route, defaultOpen = false }: RouteAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const reopenRoute = useAppStore((state) => state.reopenRoute); // NOVA FUNÇÃO

  const deliveries = getDeliveriesByRoute(route.id);
  const pendingCount = deliveries.filter((d) => !d.is_paid).length;
  const duration = formatRouteDuration(route.departure_time, route.end_time);

  // Ordenação: Pendentes em cima, concluídas embaixo
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  const handleCloseRoute = () => {
    closeRoute(route.id);
    toast.success('Rota finalizada!', {
      description: 'Ela foi enviada para o histórico do dia.',
    });
    setIsOpen(false);
  };

  const handleReopenRoute = () => {
    reopenRoute(route.id);
    toast.success('Rota reaberta!', {
      description: 'Você pode adicionar novas entregas agora.',
    });
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/40">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 p-4"
      >
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex h-11 w-11 items-center justify-center rounded-full',
              route.status === 'aberta'
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-zinc-800 text-zinc-500'
            )}
          >
            <Bike size={20} />
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="font-heading text-base font-bold text-zinc-50">{route.name}</p>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  route.status === 'aberta'
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-zinc-800 text-zinc-500'
                )}
              >
                {route.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">{route.motoboy_name}</p>
              {/* Exibe o cronômetro se estiver finalizada */}
              {route.status === 'fechada' && duration && (
                <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  <Clock size={10} /> {duration}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <PackageCheck size={14} />
            {deliveries.length}
          </div>
          <ChevronDown
            size={18}
            className={clsx(
              'text-zinc-500 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-zinc-800/80 p-4 pt-3">
          {(route.change_money > 0 || pendingCount > 0) && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {route.change_money > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                  <Wallet size={13} />
                  Troco: R$ {route.change_money.toFixed(2).replace('.', ',')}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {sortedDeliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-600">
              Nenhuma entrega nesta rota ainda.
            </p>
          ) : (
            sortedDeliveries.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                customer={getCustomerById(delivery.customer_id)}
              />
            ))
          )}

          {/* Botões de Ação da Rota */}
          <div className="mt-2 flex flex-col gap-2">
            {route.status === 'aberta' ? (
              <button
                onClick={handleCloseRoute}
                className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-zinc-800/80 py-3.5 text-sm font-semibold text-zinc-300 transition-colors active:bg-zinc-800"
              >
                <CheckCircle2 size={18} className="text-emerald-500" />
                Finalizar Rota
              </button>
            ) : (
              <button
                onClick={handleReopenRoute}
                className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-zinc-800/40 py-3.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors active:bg-zinc-800/60"
              >
                <RotateCcw size={16} />
                Reabrir Rota
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
