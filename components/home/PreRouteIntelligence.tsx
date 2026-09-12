// components/home/PreRouteIntelligence.tsx
'use client';

import {
  BrainCircuit,
  CheckCircle2,
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
          context.historicalTransitionCoverage *
            100,
        )
      : 0;

  const title =
    context.status === 'well-known'
      ? 'Rota com histórico conhecido'
      : context.status === 'partial-history'
        ? 'Rota com histórico parcial'
        : context.status === 'limited-data'
          ? 'Dados limitam a leitura da rota'
          : 'Histórico desta composição ainda está se formando';

  const tone =
    context.status === 'well-known'
      ? 'emerald'
      : context.status === 'limited-data'
        ? 'amber'
        : 'sky';

  const classes = {
    emerald:
      'border-emerald-500/20 bg-emerald-500/[.045] text-emerald-300',
    amber:
      'border-amber-500/20 bg-amber-500/[.045] text-amber-300',
    sky:
      'border-sky-500/20 bg-sky-500/[.045] text-sky-300',
  }[tone];

  return (
    <section
      className={`rounded-[22px] border p-4 ${classes}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950/35">
          {context.status === 'well-known' ? (
            <CheckCircle2 size={17} />
          ) : (
            <BrainCircuit size={17} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.18em] opacity-70">
            Leitura pré-rota
          </p>

          <h3 className="mt-1 text-sm font-black text-zinc-100">
            {title}
          </h3>

          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            {context.deliveryCount} parada
            {context.deliveryCount === 1
              ? ''
              : 's'}{' '}
            · {context.distinctNeighborhoods}{' '}
            bairro
            {context.distinctNeighborhoods === 1
              ? ''
              : 's'}{' '}
            · {knownPercent}% das transições já
            apareceram no histórico.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Mini
          icon={<RouteIcon size={11} />}
          label="Sequências"
          value={`${context.knownTransitionCount}/${context.transitions.length}`}
        />

        <Mini
          icon={<MapPin size={11} />}
          label="Bairros"
          value={String(
            context.distinctNeighborhoods,
          )}
        />

        <Mini
          icon={<BrainCircuit size={11} />}
          label="Com tempo"
          value={String(
            context.timedTransitionCount,
          )}
        />
      </div>

      {context.transitions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {context.transitions
            .slice(0, 4)
            .map((item) => (
              <div
                key={`${item.fromDeliveryId}-${item.toDeliveryId}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/30 px-3 py-2"
              >
                <span className="min-w-0 truncate text-[10px] font-bold text-zinc-400">
                  {item.fromNeighborhood} →{' '}
                  {item.toNeighborhood}
                </span>

                <span className="shrink-0 text-[9px] font-black text-zinc-500">
                  {item.historicalOccurrences > 0
                    ? `${item.historicalOccurrences}×`
                    : 'novo'}
                </span>
              </div>
            ))}
        </div>
      )}

      <p className="mt-3 text-[9px] leading-relaxed text-zinc-600">
        Esta leitura não reorganiza a rota nem
        atribui dificuldade. Ela apenas compara a
        composição atual com o histórico disponível.
      </p>
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
    <div className="rounded-xl bg-zinc-950/35 p-2.5">
      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
        {icon}
        {label}
      </div>

      <div className="mt-1 text-sm font-black text-zinc-200">
        {value}
      </div>
    </div>
  );
}
