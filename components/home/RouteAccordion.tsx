'use client';

import { useState } from 'react';
import { ChevronDown, Bike, Wallet, PackageCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { DeliveryCard } from '@/components/home/DeliveryCard';

interface RouteAccordionProps {
  route: Route;
  defaultOpen?: boolean;
}

export function RouteAccordion({ route, defaultOpen = false }: RouteAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const closeRoute = useAppStore((state) => state.closeRoute);

  const deliveries = getDeliveriesByRoute(route.id);
  const pendingCount = deliveries.filter((d) => !d.is_paid).length;

  const handleCloseRoute = () => {
    closeRoute(route.id);
    toast.success('Rota finalizada!', {
      description: 'Ela foi enviada para o histórico do dia.',
    });
    setIsOpen(false);
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
            <p className="text-xs text-zinc-500">{route.motoboy_name}</p>
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
          {(route.change_money > 0 || route.drinks_summary) && (
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

          {deliveries.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-600">
              Nenhuma entrega nesta rota ainda.
            </p>
          ) : (
            deliveries.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                customer={getCustomerById(delivery.customer_id)}
              />
            ))
          )}

          {/* Botão de Finalizar Rota */}
          {route.status === 'aberta' && (
            <button
              onClick={handleCloseRoute}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[20px] bg-zinc-800/80 py-3.5 text-sm font-semibold text-zinc-300 transition-colors active:bg-zinc-800"
            >
              <CheckCircle2 size={18} className="text-emerald-500" />
              Finalizar Rota
            </button>
          )}
        </div>
      )}
    </div>
  );
}
