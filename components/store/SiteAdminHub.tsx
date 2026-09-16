'use client';

import {
  Bike,
  CheckCircle2,
  ExternalLink,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  isSiteOrderAwaitingConfirmation,
  isSiteOrderReleasedToLogistics,
} from '@/lib/integration/site-order';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

const SITE_ADMIN_URL = 'https://dafamilialanches.com.br/admin';

export function SiteAdminHub() {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);

  const stats = useMemo(() => {
    const routeIds = new Set(routes.map((route) => route.id));
    const site = deliveries.filter(
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

    const completed = site.filter((delivery) => delivery.completed).length;

    return {
      total: site.length,
      awaitingConfirmation,
      awaitingRoute,
      routed,
      completed,
    };
  }, [deliveries, routes]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-amber-400/20 bg-gradient-to-br from-amber-500/[.08] via-zinc-950 to-zinc-950">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400 text-zinc-950">
            <ShoppingBag size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-zinc-100">
                Administração do Site
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                DFL SITE
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              O Site continua sendo a autoridade comercial; aqui aparece apenas
              o reflexo operacional necessário para expedição e entrega.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric
            icon={<ShieldCheck size={15} />}
            value={stats.awaitingConfirmation}
            label="Confirmar"
            detail="Ainda travado no Site"
          />
          <Metric
            icon={<PackageCheck size={15} />}
            value={stats.awaitingRoute}
            label="Sem rota"
            detail="Liberado para logística"
          />
          <Metric
            icon={<Bike size={15} />}
            value={stats.routed}
            label="Em rota"
            detail="Vinculado à operação"
          />
          <Metric
            icon={<CheckCircle2 size={15} />}
            value={stats.completed}
            label="Concluídos"
            detail={`${stats.total} recebidos no total`}
          />
        </div>

        <a
          href={SITE_ADMIN_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-amber-400 px-4 py-3.5 text-zinc-950 active:scale-[.99]"
        >
          <span>
            <strong className="block text-sm font-black">
              Abrir administração completa
            </strong>
            <small className="block text-[10px] font-bold text-zinc-800/70">
              Admin oficial do Site · autoridade comercial
            </small>
          </span>
          <ExternalLink size={18} />
        </a>

        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
          Confirmar no Site libera a entrega para “Pedidos aguardando rota”.
          Vincular uma rota continua sendo uma decisão operacional do Entregas.
        </p>
      </div>
    </section>
  );
}

function Metric({
  icon,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3">
      <span className="text-amber-400">{icon}</span>
      <strong className="mt-2 block text-lg font-black text-zinc-100">
        {value}
      </strong>
      <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <p className="mt-1 text-[9px] leading-snug text-zinc-700">{detail}</p>
    </div>
  );
}
