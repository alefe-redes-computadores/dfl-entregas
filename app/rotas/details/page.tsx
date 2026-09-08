'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  MapPin,
  Package,
  Play,
  RotateCcw,
  User,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { firstValidTimestamp, type TimestampLike } from '@/lib/reports/time';
import { RouteOperationalMemory } from '@/components/intelligence/EntityOperationalMemory';

const fmt = (...values: TimestampLike[]) => {
  const date = firstValidTimestamp(...values);

  return date
    ? date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Não registrado';
};

export default function RouteDetailsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const date = params.get('date') || '';
  const routesReturn = date
    ? `/rotas?date=${encodeURIComponent(date)}`
    : '/rotas';
  const dateSuffix = date ? `&date=${encodeURIComponent(date)}` : '';

  const route = useAppStore((state) =>
    state.routes.find((item) => item.id === id),
  );
  const deliveries = useAppStore((state) =>
    state.deliveries
      .filter((item) => item.route_id === id)
      .sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999)),
  );
  const startRoute = useAppStore((state) => state.startRoute);
  const closeRoute = useAppStore((state) => state.closeRoute);
  const reopenRoute = useAppStore((state) => state.reopenRoute);

  const [busy, setBusy] = useState(false);

  if (!route) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-600">
          <Bike size={24} />
        </div>
        <h1 className="mt-4 font-heading text-xl font-black text-zinc-200">
          Rota não encontrada
        </h1>
        <p className="mt-1 max-w-[260px] text-sm text-zinc-600">
          Ela pode ter sido removida ou ainda não sincronizou.
        </p>
        <button
          onClick={() => router.replace(routesReturn)}
          className="mt-5 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-black text-zinc-200"
        >
          Voltar às rotas
        </button>
      </div>
    );
  }

  const pending = deliveries.filter((item) => !item.completed).length;
  const completed = deliveries.length - pending;
  const total = deliveries.reduce((sum, item) => sum + (item.value || 0), 0);
  const progress = deliveries.length
    ? Math.round((completed / deliveries.length) * 100)
    : 0;
  const routeStartedAt = firstValidTimestamp(
    route.started_at,
    route.departure_time,
  );
  const state =
    route.status === 'fechada' ? 'finalizada' : routeStartedAt ? 'rua' : 'montando';

  const action = async (kind: 'start' | 'close' | 'reopen') => {
    if (busy) return;

    setBusy(true);
    try {
      if (kind === 'start') await startRoute(route.id);
      else if (kind === 'close') await closeRoute(route.id);
      else await reopenRoute(route.id);

      toast.success(
        kind === 'start'
          ? 'Rota iniciada.'
          : kind === 'close'
            ? 'Rota finalizada.'
            : 'Rota reaberta.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a rota.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace(routesReturn)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          aria-label="Voltar às rotas"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
            Rota operacional
          </p>
          <h1 className="truncate font-heading text-xl font-black text-zinc-50">
            {route.name}
          </h1>
        </div>

        <button
          onClick={() =>
            router.push(`/rotas/editar?id=${route.id}${dateSuffix}`)
          }
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          aria-label="Editar rota"
        >
          <Edit3 size={17} />
        </button>
      </header>

      <section
        className={`rounded-[28px] border p-5 ${
          state === 'rua'
            ? 'border-sky-500/25 bg-sky-500/[.05]'
            : state === 'finalizada'
              ? 'border-emerald-500/25 bg-emerald-500/[.045]'
              : 'border-zinc-800 bg-zinc-900/50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              state === 'rua'
                ? 'bg-sky-500/15 text-sky-400'
                : state === 'finalizada'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            <Bike size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-black text-zinc-100">
                {state === 'finalizada'
                  ? 'Finalizada'
                  : state === 'rua'
                    ? 'Na rua'
                    : 'Montando'}
              </p>
              <span
                className={`h-2 w-2 rounded-full ${
                  state === 'rua'
                    ? 'bg-sky-400'
                    : state === 'finalizada'
                      ? 'bg-emerald-400'
                      : 'bg-zinc-600'
                }`}
              />
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
              <User size={13} />
              {route.motoboy_name}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-3">
            <Package size={15} className="text-sky-400" />
            <p className="mt-2 text-xl font-black text-zinc-100">
              {completed}/{deliveries.length}
            </p>
            <p className="text-[10px] text-zinc-600">Entregas concluídas</p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-3">
            <Wallet size={15} className="text-emerald-400" />
            <p className="mt-2 text-lg font-black text-emerald-400">
              R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-zinc-600">Valor bruto</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-zinc-500">Progresso da rota</span>
            <span className={pending ? 'text-amber-400' : 'text-emerald-400'}>
              {pending ? `${pending} pendente${pending === 1 ? '' : 's'}` : '100% concluída'}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${
                state === 'finalizada' ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <RouteOperationalMemory routeId={route.id} />

      <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-4">
        <div className="flex items-center gap-2">
          <Clock3 size={15} className="text-zinc-500" />
          <h2 className="font-black text-zinc-200">Linha do tempo</h2>
        </div>

        <div className="mt-4 divide-y divide-zinc-800/80">
          <TimelineRow
            label="Criada"
            value={fmt(route.created_at, route.started_at, route.departure_time)}
          />
          <TimelineRow
            label="Saída real"
            value={fmt(route.started_at, route.departure_time)}
          />
          <TimelineRow label="Encerrada" value={fmt(route.end_time)} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Sequência
            </p>
            <h2 className="mt-1 font-heading text-base font-black text-zinc-100">
              Paradas da rota
            </h2>
          </div>
          <span className="text-[10px] font-black text-zinc-600">
            {deliveries.length} parada{deliveries.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-2">
          {deliveries.map((delivery, index) => (
            <button
              key={delivery.id}
              onClick={() =>
                router.push(`/entregas/details?id=${delivery.id}${dateSuffix}`)
              }
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] ${
                delivery.completed
                  ? 'border-emerald-500/15 bg-emerald-500/[.025]'
                  : 'border-zinc-800 bg-zinc-900/45'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                  delivery.completed
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-zinc-200">
                  {delivery.customer_name ||
                    `Pedido ${delivery.order_id || 'sem número'}`}
                </p>
                <p className="mt-1 truncate text-[11px] text-zinc-600">
                  <MapPin size={10} className="mr-1 inline" />
                  {delivery.address_string || 'Endereço não informado'}
                </p>
              </div>

              {delivery.completed ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              ) : (
                <ChevronRight size={17} className="shrink-0 text-zinc-700" />
              )}
            </button>
          ))}

          {deliveries.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-9 text-center">
              <Package className="mx-auto text-zinc-700" size={22} />
              <p className="mt-3 text-xs font-bold text-zinc-500">
                Nenhuma entrega vinculada
              </p>
            </div>
          )}
        </div>
      </section>

      {route.status === 'fechada' ? (
        <button
          disabled={busy}
          onClick={() => action('reopen')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"
        >
          <RotateCcw size={18} />
          Reabrir rota
        </button>
      ) : !routeStartedAt ? (
        <button
          disabled={busy || deliveries.length === 0}
          onClick={() => action('start')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 font-black text-zinc-950 disabled:opacity-40"
        >
          <Play size={18} />
          {deliveries.length === 0 ? 'Adicione entregas para iniciar' : 'Iniciar rota'}
        </button>
      ) : (
        <button
          disabled={busy || pending > 0}
          onClick={() => action('close')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-40"
        >
          <CheckCircle2 size={18} />
          {pending > 0
            ? `${pending} entrega${pending === 1 ? '' : 's'} pendente${pending === 1 ? '' : 's'}`
            : 'Finalizar rota'}
        </button>
      )}
    </div>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <span className="text-xs font-bold text-zinc-600">{label}</span>
      <span className="text-right text-xs font-bold text-zinc-300">{value}</span>
    </div>
  );
}
