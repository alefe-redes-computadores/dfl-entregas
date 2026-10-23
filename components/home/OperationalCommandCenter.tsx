'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { routeIfoodCodeProgress } from '@/lib/operational-home-actions';
import type { Delivery, Route } from '@/types';
import { extractLatLngFromMapsUrl } from '@/lib/maps';
import { useAppStore } from '@/store/useAppStore';
import { buildPendingMotoboySettlements } from '@/lib/motoboy-settlement-tasks';
import { siteInboxSummary } from '@/lib/operation/siteInboxSummary';
import { siteInboxProjection } from '@/lib/operation/siteInboxPolicy';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { Inbox } from 'lucide-react';

type ActionRow = {
  key: string;
  label: string;
  description: string;
  count: number;
  badge?: string;
  href: string;
  icon: typeof AlertTriangle;
  tone: 'red' | 'amber' | 'sky';
  priority: number;
};

export function OperationalCommandCenter({
  routes,
  deliveries,
}: {
  routes: Route[];
  deliveries: Delivery[];
}) {
  const router = useRouter();
  const [showAllActions, setShowAllActions] = useState(false);
  const confirmationBacklog = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );
  const allDeliveries = useAppStore((state) => state.deliveries);
  const motoboys = useAppStore((state) => state.motoboys);
  const operationalExpenses = useAppStore((state) => state.operationalExpenses);

  const openRoutes = routes.filter((route) => route.status === 'aberta');
  const pending = deliveries.filter((delivery) => !delivery.completed && !isCancelledSiteDelivery(delivery) && isDeliveryFulfillment(delivery));

  // Backlog comercial global: não depende do dia nem da rota.
  // A regra canônica também exige pedido operacionalmente não concluído:
  // snapshot comercial "Pendente" em pedido já finalizado não gera ação fantasma.
  const siteInbox = useMemo(() => siteInboxProjection(allDeliveries), [allDeliveries]);
  const allRoutes = useAppStore(state => state.routes);
  const allRouteIds = useMemo(() => new Set(allRoutes.map(route => route.id)), [allRoutes]);
  const corruptLinks = pending.filter(item => item.route_id && !allRouteIds.has(item.route_id));

  const noAddress = pending.filter(
    (delivery) => !delivery.address_string?.trim() && (!delivery.source_system || delivery.route_id),
  );

  const addressOnly = pending.filter(
    (delivery) =>
      Boolean(delivery.route_id) &&
      Boolean(delivery.address_string?.trim()) &&
      !extractLatLngFromMapsUrl(delivery.maps_link),
  );

  // Quando há mais de um caso, abrimos o primeiro pedido concreto; após
  // sua correção, os demais continuam na fila, sem ação fantasma.
  const deliveryActionHref = (item?: Delivery) =>
    item?.id ? `/entregas/editar?id=${encodeURIComponent(item.id)}` : '/entregas';
  const firstMissingIfoodCode = pending.find((item) =>
    item.origin === 'ifood' && Boolean(item.route_id) &&
    !routes.some(route => route.id === item.route_id && motoboys.some(motoboy => motoboy.id === route.motoboy_id && motoboy.ifood_confirmation_mode === 'motoboy')) &&
    !String(item.confirmation_code || '').replace(/\D/g, '').match(/^\d{4}$/));

  const openRouteIds = new Set(openRoutes.map((route) => route.id));
  const routeCodes = useMemo(() => {
    const original = routeIfoodCodeProgress(deliveries, openRouteIds);
    const selfConfirmRouteIds = new Set(routes.filter(route =>
      motoboys.some(motoboy => motoboy.id === route.motoboy_id && motoboy.ifood_confirmation_mode === 'motoboy'))
      .map(route => route.id));
    if (!selfConfirmRouteIds.size) return original;
    return routeIfoodCodeProgress(deliveries.filter(item =>
      !item.route_id || !selfConfirmRouteIds.has(item.route_id)), openRouteIds);
  }, [deliveries, routes, motoboys]);

  const selfConfirmPendingRoutes = new Set(routes.filter(route => motoboys.some(motoboy => motoboy.id === route.motoboy_id && motoboy.ifood_confirmation_mode === 'motoboy')).map(route => route.id));
  const externalPending = confirmationBacklog.filter(
    (item) => (item.status || 'pending') === 'pending' && (!item.route_id || !selfConfirmPendingRoutes.has(item.route_id)),
  );

  const routeSpecificPending = externalPending.filter((item) => item.route_id);
  const standalonePending = externalPending.filter((item) => !item.route_id);
  const pendingRouteIds = Array.from(
    new Set(
      routeSpecificPending
        .map((item) => item.route_id)
        .filter((routeId): routeId is string => Boolean(routeId)),
    ),
  );
  const firstPendingRoute = routeSpecificPending[0];

  // Deep-link só quando toda a fila pertence à mesma rota.
  const confirmationHref =
    pendingRouteIds.length === 1 &&
    standalonePending.length === 0 &&
    firstPendingRoute?.route_id
      ? `/confirmacoes?route=${encodeURIComponent(
          firstPendingRoute.route_id,
        )}&routeName=${encodeURIComponent(
          firstPendingRoute.route_name || 'Rota finalizada',
        )}`
      : '/confirmacoes';

  const settlementTasks = useMemo(() => buildPendingMotoboySettlements({
    motoboys,
    routes,
    deliveries,
    expenses: operationalExpenses,
  }), [motoboys, routes, deliveries, operationalExpenses]);
  const firstSettlementTask = settlementTasks[0];

  const rows = [
    {
      key: 'site-inbox',
      label: 'Pedidos do Site',
      description: siteInboxSummary(siteInbox),
      count: siteInbox.total,
      href: siteInbox.rows.length === 1
        ? `/loja/caixa-de-entrada?aba=site&pedido=${encodeURIComponent(siteInbox.rows[0].delivery.id)}`
        : '/loja/caixa-de-entrada?aba=site',
      icon: Inbox,
      tone: 'amber',
      priority: 115,
    },
    {
      key: 'broken-route-link',
      label: 'Corrigir vínculo de rota',
      description: 'Pedido vinculado a uma rota que não existe mais. Revisar no cadastro da entrega.',
      count: corruptLinks.length,
      href: deliveryActionHref(corruptLinks[0]),
      icon: ShieldAlert,
      tone: 'red',
      priority: 112,
    },
    {
      key: 'address',
      label: 'Completar endereço',
      description: 'Pedido sem endereço operacional',
      count: noAddress.length,
      href: deliveryActionHref(noAddress[0]),
      icon: AlertTriangle,
      tone: 'red',
      priority: 100,
    },
    {
      key: 'ifood-external',
      label: 'Confirmar pedidos no iFood',
      description:
        pendingRouteIds.length > 1 || standalonePending.length > 0
          ? `${routeSpecificPending.length} de rota · ${standalonePending.length} avulso${standalonePending.length === 1 ? '' : 's'}`
          : 'Entrega concluída não confirma o pedido no portal',
      count: externalPending.length,
      href: confirmationHref,
      icon: ShieldAlert,
      tone: 'red',
      priority: 95,
    },
    {
      key: 'motoboy-settlement',
      label:
        settlementTasks.length === 1
          ? `Fazer acerto de ${firstSettlementTask?.motoboy.name || 'motoboy'}`
          : 'Fazer acertos dos motoboys',
      description: 'Operação do dia concluída e acerto ainda não registrado',
      count: settlementTasks.length,
      href:
        settlementTasks.length === 1 && firstSettlementTask
          ? `/motoboys/acerto?id=${encodeURIComponent(firstSettlementTask.motoboy.id)}&date=${encodeURIComponent(firstSettlementTask.date)}`
          : '/motoboys',
      icon: CheckCircle2,
      tone: 'amber',
      priority: 90,
    },
    {
      key: 'ifood-code',
      label: 'Códigos iFood da rota',
      description:
        `${routeCodes.collected} de ${routeCodes.active} coletados · falta registrar durante a rota`,
      count: routeCodes.missing,
      badge: `${routeCodes.collected}/${routeCodes.active}`,
      href: deliveryActionHref(firstMissingIfoodCode),
      icon: ShieldAlert,
      tone: 'sky',
      priority: 80,
    },
    {
      key: 'location',
      label: 'Revisar localização',
      description: 'Endereço informado; coordenadas precisas ainda não verificadas',
      count: addressOnly.length,
      href: deliveryActionHref(addressOnly[0]),
      icon: MapPin,
      tone: 'sky',
      priority: 40,
    },
  ] satisfies ActionRow[];

  const visibleActionRows = rows
    .filter((item) => item.count > 0)
    .sort((a, b) => b.priority - a.priority);

  // Duas prioridades à primeira vista; as demais são acessíveis sem ficar ocultas.
  const visibleRows = showAllActions ? visibleActionRows : visibleActionRows.slice(0, 2);
  const hiddenActions = visibleActionRows.length - visibleRows.length;

  if (visibleRows.length === 0) {
    if (openRoutes.length === 0 && pending.length === 0) return null;

    return (
      <section className="rounded-[20px] border border-emerald-500/15 bg-emerald-500/[0.035] px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-zinc-200">
              Operação dentro do padrão
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              Nenhuma ação operacional importante detectada agora.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] border border-amber-500/15 bg-amber-500/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
            Ações recomendadas
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Só aparece o que pede decisão agora
          </p>
        </div>
        <span className="rounded-full border border-zinc-700/70 bg-zinc-950/50 px-2.5 py-1 text-[10px] font-black tabular-nums text-zinc-300">
          {visibleActionRows.length} frente{visibleActionRows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-1.5">
        {visibleRows.map((item) => {
          const Icon = item.icon;
          const style =
            item.tone === 'red'
              ? 'border-red-500/20 bg-red-500/[0.05] text-red-400'
              : item.tone === 'amber'
                ? 'border-amber-500/20 bg-amber-500/[0.05] text-amber-400'
                : 'border-sky-500/20 bg-sky-500/[0.05] text-sky-400';

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left active:scale-[0.99] ${style}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/10">
                <Icon size={14} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-black text-zinc-200">
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-zinc-600">
                  {item.description}
                </p>
              </div>

              <span className="shrink-0 text-xs font-black">{item.badge ?? item.count}</span>
              <ChevronRight size={14} className="shrink-0 opacity-60" />
            </button>
          );
        })}
      </div>
      {visibleActionRows.length > 2 && (
        <button
          type="button"
          aria-expanded={showAllActions}
          onClick={() => setShowAllActions((value) => !value)}
          className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 text-[11px] font-bold text-zinc-300 transition active:bg-zinc-800"
        >
          {showAllActions ? 'Recolher ações' : `Ver mais ${hiddenActions} ação${hiddenActions === 1 ? '' : 'ões'}`}
          <ChevronRight size={14} className={showAllActions ? '-rotate-90' : 'rotate-90'} />
        </button>
      )}
    </section>
  );
}
