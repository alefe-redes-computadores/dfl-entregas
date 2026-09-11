// components/home/OperationalCommandCenter.tsx
'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Delivery, Route } from '@/types';
import { extractLatLngFromMapsUrl } from '@/lib/maps';
import { useAppStore } from '@/store/useAppStore';

export function OperationalCommandCenter({
  routes,
  deliveries,
}: {
  routes: Route[];
  deliveries: Delivery[];
}) {
  const router = useRouter();
  const confirmationBacklog = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );

  const openRoutes = routes.filter((route) => route.status === 'aberta');
  const pending = deliveries.filter((delivery) => !delivery.completed);

  const noAddress = pending.filter(
    (delivery) => !delivery.address_string?.trim(),
  );

  const noLocation = pending.filter(
    (delivery) =>
      Boolean(delivery.address_string?.trim()) &&
      !extractLatLngFromMapsUrl(delivery.maps_link),
  );

  const missingCode = pending.filter(
    (delivery) =>
      delivery.origin === 'ifood' &&
      !delivery.confirmation_code?.replace(/\D/g, '').length,
  );

  const externalPending = confirmationBacklog.filter(
    (item) => (item.status || 'pending') === 'pending',
  );

  const hasRouteInProgress = openRoutes.some((route) =>
    Boolean(route.started_at || route.departure_time),
  );
  const hasRouteWaitingDeparture = openRoutes.some(
    (route) => !route.started_at && !route.departure_time,
  );

  const routeSpecificPending = externalPending.filter((item) => item.route_id);
  const firstPendingRoute = routeSpecificPending[0];

  const confirmationHref = firstPendingRoute?.route_id
    ? `/confirmacoes?route=${encodeURIComponent(firstPendingRoute.route_id)}&routeName=${encodeURIComponent(firstPendingRoute.route_name || 'Rota finalizada')}`
    : '/confirmacoes';

  const rows = [
    {
      key: 'address',
      label: 'Sem endereço',
      count: noAddress.length,
      href: '/entregas',
      icon: AlertTriangle,
    },
    {
      key: 'location',
      label: 'Endereço sem coordenada',
      count: noLocation.length,
      href: '/entregas',
      icon: MapPin,
    },
    {
      key: 'ifood-code',
      label: 'iFood sem código',
      count: missingCode.length,
      href: '/confirmacoes',
      icon: ShieldAlert,
    },
    {
      key: 'ifood-external',
      label: 'Confirmar pedidos no iFood',
      count: externalPending.length,
      href: confirmationHref,
      icon: ShieldAlert,
    },
  ].filter((item) => item.count > 0);

  const issues = rows.reduce((sum, item) => sum + item.count, 0);

  const issueTitle =
    externalPending.length > 0 && openRoutes.length === 0
      ? 'Pendências pós-rota'
      : hasRouteWaitingDeparture && !hasRouteInProgress
        ? 'Atenção antes da saída'
        : 'Atenção na operação';

  return (
    <section
      className={`overflow-hidden rounded-[26px] border ${
        issues
          ? 'border-amber-500/20 bg-amber-500/[.045]'
          : 'border-emerald-500/20 bg-emerald-500/[.045]'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
            issues
              ? 'bg-amber-500/10 text-amber-300'
              : 'bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {issues ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-zinc-500">
            Agora
          </p>
          <p className="mt-0.5 text-sm font-black text-zinc-100">
            {issues ? issueTitle : 'Operação dentro do padrão'}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {openRoutes.length} rota{openRoutes.length === 1 ? '' : 's'} aberta{openRoutes.length === 1 ? '' : 's'} · {pending.length} pendente{pending.length === 1 ? '' : 's'}
          </p>
        </div>

        {issues > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-300">
            {issues} ajuste{issues === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="border-t border-zinc-800/70 px-3 pb-3 pt-2">
          {rows.map(({ key, label, count, href, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => router.push(href)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-zinc-900/60"
            >
              <Icon size={15} className="shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-300">
                {label}
              </span>
              <span className="rounded-full bg-zinc-900 px-2 py-1 text-[10px] font-black text-zinc-400">
                {count}
              </span>
              <ChevronRight size={14} className="text-zinc-700" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
