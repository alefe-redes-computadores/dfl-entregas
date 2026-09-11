// components/home/OperationalCommandCenter.tsx
'use client';

import { AlertTriangle, CheckCircle2, ChevronRight, CircleDot, MapPin, Route as RouteIcon, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Delivery, Route } from '@/types';
import { extractLatLngFromMapsUrl } from '@/lib/maps';

export function OperationalCommandCenter({ routes, deliveries }: { routes: Route[]; deliveries: Delivery[] }) {
  const router = useRouter();
  const openRoutes = routes.filter((route) => route.status === 'aberta');
  const pending = deliveries.filter((delivery) => !delivery.completed);
  const noAddress = pending.filter((delivery) => !delivery.address_string?.trim());
  const noLocation = pending.filter((delivery) => Boolean(delivery.address_string?.trim()) && !extractLatLngFromMapsUrl(delivery.maps_link));
  const missingCode = pending.filter((delivery) => delivery.origin === 'ifood' && !delivery.confirmation_code?.trim());

  const rows = [
    { key: 'address', label: 'Sem endereço', count: noAddress.length, href: '/entregas', icon: AlertTriangle },
    { key: 'location', label: 'Endereço sem coordenada', count: noLocation.length, href: '/entregas', icon: MapPin },
    { key: 'ifood', label: 'iFood sem código', count: missingCode.length, href: '/confirmacoes', icon: ShieldAlert },
  ].filter((item) => item.count > 0);
  const issues = rows.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className={`overflow-hidden rounded-[26px] border ${issues ? 'border-amber-500/20 bg-amber-500/[.045]' : 'border-emerald-500/20 bg-emerald-500/[.045]'}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${issues ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
          {issues ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Agora</p>
              <h2 className="mt-0.5 text-sm font-black text-zinc-100">{issues ? 'Atenção antes da saída' : 'Operação dentro do padrão'}</h2>
            </div>
            {issues > 0 && <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-300">{issues} {issues === 1 ? 'ajuste' : 'ajustes'}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-zinc-500">
            <span className="flex items-center gap-1"><RouteIcon size={11} />{openRoutes.length} {openRoutes.length === 1 ? 'rota aberta' : 'rotas abertas'}</span>
            <span className="flex items-center gap-1"><CircleDot size={10} />{pending.length} {pending.length === 1 ? 'pendente' : 'pendentes'}</span>
          </div>
        </div>
      </div>
      {issues > 0 && (
        <div className="border-t border-zinc-800/70 px-2 pb-2 pt-2">
          {rows.map(({ key, label, count, href, icon: Icon }) => (
            <button key={key} type="button" onClick={() => router.push(href)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-2.5 text-left transition-colors active:bg-zinc-900/70">
              <Icon size={15} className="shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1 text-[11px] font-bold text-zinc-300">{label}</span>
              <span className="shrink-0 text-[10px] font-black text-amber-300">{count}</span>
              <ChevronRight size={14} className="shrink-0 text-zinc-700" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
