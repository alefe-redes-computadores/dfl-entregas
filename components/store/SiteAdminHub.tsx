'use client';

import {
  Banknote,
  Bike,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  isSiteOrderAwaitingConfirmation,
  isSiteOrderReleasedToLogistics,
} from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import type { Delivery } from '@/types';

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export function SiteAdminHub({
  selectedDateOrders,
  selectedDateLabel,
}: {
  selectedDateOrders: Delivery[];
  selectedDateLabel: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);

  const stats = useMemo(() => {
    const routeIds = new Set(routes.map((route) => route.id));
    const site = deliveries.filter(
      (delivery) => delivery.source_system === 'dfl_site',
    );

    // O dashboard já aplica o contrato temporal canônico da Loja.
    // Usamos a projeção pronta para não criar uma segunda regra de data.
    const selectedDateSite = selectedDateOrders.filter(
      (delivery) => delivery.source_system === 'dfl_site',
    );

    const awaitingConfirmation = site.filter(
      (delivery) =>
        !delivery.completed &&
        isSiteOrderAwaitingConfirmation(delivery),
    ).length;

    const awaitingRoute = site.filter(
      (delivery) =>
        !delivery.completed &&
        isDeliveryFulfillment(delivery) &&
        !delivery.route_id &&
        isSiteOrderReleasedToLogistics(delivery),
    ).length;

    const routed = site.filter(
      (delivery) =>
        !delivery.completed &&
        isDeliveryFulfillment(delivery) &&
        Boolean(delivery.route_id) &&
        routeIds.has(delivery.route_id),
    ).length;

    const completed = selectedDateSite.filter(
      (delivery) => delivery.completed,
    ).length;
    const active = selectedDateSite.filter(
      (delivery) => !delivery.completed,
    ).length;
    const totalValue = selectedDateSite.reduce((sum, delivery) => {
      const commercialTotal = delivery.site_order_commercial?.total;
      const value =
        typeof commercialTotal === 'number'
          ? commercialTotal
          : typeof delivery.customer_charge === 'number'
            ? delivery.customer_charge
            : delivery.value || 0;
      return sum + Math.max(0, value);
    }, 0);

    return {
      total: selectedDateSite.length,
      active,
      awaitingConfirmation,
      awaitingRoute,
      routed,
      completed,
      totalValue,
    };
  }, [deliveries, routes, selectedDateOrders]);

  const hasAttention = stats.awaitingConfirmation > 0 || stats.awaitingRoute > 0;

  return (
    <section
      className={`dfl-v26-site overflow-hidden rounded-[24px] border bg-zinc-900/45 transition-colors ${
        hasAttention
          ? 'border-amber-400/25'
          : 'border-zinc-800'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left active:scale-[.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
          <ShoppingBag size={20} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <strong className="truncate text-sm font-black text-zinc-100">
              Pedidos do Site
            </strong>
            <span className="shrink-0 rounded-md bg-amber-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-300">
              DFL Site
            </span>
          </span>

          <span className="mt-1 block text-[11px] text-zinc-500">
            {stats.total === 0
              ? 'Nenhum pedido recebido'
              : `${stats.active} ativo${stats.active === 1 ? '' : 's'} · ${stats.completed} concluído${stats.completed === 1 ? '' : 's'}`}
          </span>

          {hasAttention && (
            <span className="mt-1 block text-[10px] font-bold text-amber-300">
              {[
                stats.awaitingConfirmation
                  ? `${stats.awaitingConfirmation} para confirmar`
                  : '',
                stats.awaitingRoute ? `${stats.awaitingRoute} sem rota` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>

        <span className="text-right">
          <span className="block text-xs font-black text-zinc-200">
            {money(stats.totalValue)}
          </span>
          <span className="mt-0.5 block text-[8px] font-bold text-zinc-600">
            {selectedDateLabel}
          </span>
          <ChevronDown
            size={17}
            className={`ml-auto mt-1 text-zinc-600 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800/80 px-4 pb-4 pt-3">
          <div className="grid grid-cols-4 gap-1.5">
            <Metric
              icon={<ShieldCheck size={13} />}
              value={stats.awaitingConfirmation}
              label="Confirmar"
              attention={stats.awaitingConfirmation > 0}
            />
            <Metric
              icon={<PackageCheck size={13} />}
              value={stats.awaitingRoute}
              label="Sem rota"
              attention={stats.awaitingRoute > 0}
            />
            <Metric
              icon={<Bike size={13} />}
              value={stats.routed}
              label="Em rota"
            />
            <Metric
              icon={<CheckCircle2 size={13} />}
              value={stats.completed}
              label="Concluídos"
            />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/20 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-[10px] text-zinc-500">
              <Banknote size={14} className="shrink-0 text-emerald-400" />
              Valor dos pedidos · {selectedDateLabel}
            </span>
            <strong className="ml-2 shrink-0 text-xs font-black text-zinc-200">
              {money(stats.totalValue)}
            </strong>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              router.push('/site-admin');
            }}
            className="mt-2 flex h-11 w-full items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-400/[.07] px-3 text-left text-amber-300 active:scale-[.99]"
          >
            <span>
              <strong className="block text-[11px] font-black">
                Abrir Admin do Site
              </strong>
              <small className="block text-[9px] text-zinc-600">
                Administração comercial oficial
              </small>
            </span>
            <ExternalLink size={15} />
          </button>

          <p className="mt-2 text-[9px] leading-relaxed text-zinc-700">
            O Entregas mostra o reflexo operacional. Confirmação, preços e
            demais regras comerciais continuam no DFL Site.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  value,
  label,
  attention = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-1.5 py-2 text-center ${
        attention
          ? 'border-amber-400/20 bg-amber-400/[.06]'
          : 'border-zinc-800 bg-black/20'
      }`}
    >
      <span
        className={`mx-auto flex justify-center ${
          attention ? 'text-amber-300' : 'text-zinc-600'
        }`}
      >
        {icon}
      </span>
      <strong className="mt-1 block text-sm font-black text-zinc-100">
        {value}
      </strong>
      <span className="block truncate text-[8px] font-bold uppercase tracking-tight text-zinc-600">
        {label}
      </span>
    </div>
  );
}
