// components/home/PreRouteIntelligence.tsx
'use client';

import { useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  MapPin,
  Route as RouteIcon,
} from 'lucide-react';

import type {
  Customer,
  Delivery,
  Route,
} from '@/types';

import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { buildPreRouteContext } from '@/lib/delivery-intelligence/buildPreRouteContext';

export function PreRouteIntelligence({
  route,
  deliveries,
  customers,
}: {
  route: Route;
  deliveries: Delivery[];
  customers: Customer[];
}) {
  const [open, setOpen] = useState(false);

  const intelligence =
    useDeliveryIntelligence({
      lookbackDays: 90,
      minimumSample: 3,
      highlightLimit: 3,
    });

  if (
    route.status !== 'aberta' ||
    route.started_at ||
    route.departure_time
  ) {
    return null;
  }

  const context = buildPreRouteContext({
    route,
    deliveries,
    customers,
    memory: intelligence.memory,
  });

  if (context.deliveryCount === 0) {
    return null;
  }

  const knownPercent =
    context.transitions.length > 0
      ? Math.round(
          context
            .historicalTransitionCoverage *
            100,
        )
      : 0;

  const title =
    context.status === 'well-known'
      ? 'Composição conhecida'
      : context.status === 'partial-history'
        ? 'Histórico parcial'
        : context.status === 'limited-data'
          ? 'Dados incompletos'
          : 'Histórico se formando';

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-500/15 bg-sky-500/[.035]">
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-sky-500/[.04]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
          <BrainCircuit size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black uppercase tracking-[.16em] text-sky-400/75">
            Pré-rota
          </p>
          <p className="mt-0.5 truncate text-xs font-black text-zinc-200">
            {title}
          </p>
        </div>

        <span className="shrink-0 text-[9px] font-bold text-zinc-500">
          {context.distinctNeighborhoods}{' '}
          bairro
          {context.distinctNeighborhoods === 1
            ? ''
            : 's'}
          {' · '}
          {knownPercent}%
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-600 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-zinc-800/70 px-3.5 pb-3.5 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <Mini
              icon={<RouteIcon size={10} />}
              label="Sequências"
              value={`${context.knownTransitionCount}/${context.transitions.length}`}
            />
            <Mini
              icon={<MapPin size={10} />}
              label="Bairros"
              value={String(
                context.distinctNeighborhoods,
              )}
            />
            <Mini
              icon={
                <BrainCircuit size={10} />
              }
              label="Com tempo"
              value={String(
                context.timedTransitionCount,
              )}
            />
          </div>

          {context.transitions.length > 0 && (
            <div className="mt-2 space-y-1">
              {context.transitions
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={`${item.fromDeliveryId}-${item.toDeliveryId}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/35 px-2.5 py-2"
                  >
                    <span className="min-w-0 truncate text-[9px] font-bold text-zinc-500">
                      {item.fromNeighborhood}
                      {' → '}
                      {item.toNeighborhood}
                    </span>

                    <span className="shrink-0 text-[8px] font-black text-zinc-600">
                      {item.historicalOccurrences >
                      0
                        ? `${item.historicalOccurrences}×`
                        : 'novo'}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <p className="mt-2 text-[8px] leading-relaxed text-zinc-600">
            Leitura histórica. Não altera a
            ordem nem classifica a rota como
            boa ou ruim.
          </p>
        </div>
      )}
    </section>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-950/35 p-2">
      <div className="flex items-center gap-1 text-[7px] font-bold uppercase text-zinc-600">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xs font-black text-zinc-300">
        {value}
      </p>
    </div>
  );
}
