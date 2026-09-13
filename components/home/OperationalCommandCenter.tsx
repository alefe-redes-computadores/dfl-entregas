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
import { buildPendingMotoboySettlements } from '@/lib/motoboy-settlement-tasks';

type ActionRow = {
  key: string;
  label: string;
  description: string;
  count: number;
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
  const confirmationBacklog = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );
  const motoboys = useAppStore((state) => state.motoboys);
  const operationalExpenses = useAppStore((state) => state.operationalExpenses);

  const openRoutes = routes.filter((route) => route.status === 'aberta');
  const pending = deliveries.filter((delivery) => !delivery.completed);

  const noAddress = pending.filter(
    (delivery) => !delivery.address_string?.trim(),
  );

  const addressOnly = pending.filter(
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

  const routeSpecificPending = externalPending.filter((item) => item.route_id);
  const firstPendingRoute = routeSpecificPending[0];

  const confirmationHref = firstPendingRoute?.route_id
    ? `/confirmacoes?route=${encodeURIComponent(
        firstPendingRoute.route_id,
      )}&routeName=${encodeURIComponent(
        firstPendingRoute.route_name || 'Rota finalizada',
      )}`
    : '/confirmacoes';

  const settlementTasks = buildPendingMotoboySettlements({
    motoboys,
    routes,
    deliveries,
    expenses: operationalExpenses,
  });
  const firstSettlementTask = settlementTasks[0];

  const rows = [
    {
      key: 'address',
      label: 'Completar endereço',
      description: 'Pedido sem endereço operacional',
      count: noAddress.length,
      href: '/entregas',
      icon: AlertTriangle,
      tone: 'red',
      priority: 100,
    },
    {
      key: 'ifood-external',
      label: 'Confirmar pedidos no iFood',
      description: 'Entrega concluída não confirma o pedido no portal',
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
      label: 'Completar código iFood',
      description: 'Pedido na operação ainda sem código de confirmação',
      count: missingCode.length,
      href: '/confirmacoes',
      icon: ShieldAlert,
      tone: 'amber',
      priority: 80,
    },
    {
      key: 'location',
      label: 'Revisar localização',
      description: 'Endereço existe, mas não há ponto preciso salvo',
      count: addressOnly.length,
      href: '/entregas',
      icon: MapPin,
      tone: 'sky',
      priority: 40,
    },
  ] satisfies ActionRow[];

  const visibleActionRows = rows
    .filter((item) => item.count > 0)
    .sort((a, b) => b.priority - a.priority);

  const critical = visibleActionRows.filter((item) => item.priority >= 80);
  const visibleRows = (critical.length > 0 ? critical : visibleActionRows).slice(0, 2);

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
        {visibleActionRows.length > visibleRows.length && (
          <span className="text-[9px] font-black text-zinc-700">
            +{visibleActionRows.length - visibleRows.length}
          </span>
        )}
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

              <span className="shrink-0 text-xs font-black">{item.count}</span>
              <ChevronRight size={14} className="shrink-0 opacity-60" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
