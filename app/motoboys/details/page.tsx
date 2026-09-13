'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bike,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  PackageOpen,
  ReceiptText,
  Route as RouteIcon,
  UserRound,
} from 'lucide-react';

import { useAppStore } from '@/store/useAppStore';
import {
  operationalDateKey,
  routeOperationalDate,
} from '@/lib/motoboy-analytics';
import {
  buildMotoboyLedger,
  describePaymentRule,
} from '@/lib/motoboy-ledger';
import { MotoboyOperationalMemory } from '@/components/intelligence/EntityOperationalMemory';

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const monthKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');

  const motoboy = useAppStore((state) =>
    state.motoboys.find((item) => item.id === id),
  );
  const routes = useAppStore((state) => state.routes);
  const deliveries = useAppStore((state) => state.deliveries);
  const expenses = useAppStore((state) => state.operationalExpenses);

  const [month, setMonth] = useState(() => new Date());
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const ledger = useMemo(
    () =>
      motoboy
        ? buildMotoboyLedger({
            motoboy,
            routes,
            deliveries,
            expenses,
          })
        : null,
    [deliveries, expenses, motoboy, routes],
  );

  if (!motoboy || !ledger) {
    return (
      <div className="py-20 text-center">
        <p className="font-bold">Entregador não encontrado</p>
        <button
          onClick={() => router.replace('/motoboys')}
          className="mt-4 text-sm font-bold text-sky-400"
        >
          Voltar
        </button>
      </div>
    );
  }

  const selectedMonthKey = monthKey(month);
  const monthDays = ledger.days.filter((day) =>
    day.key.startsWith(selectedMonthKey),
  );

  const monthRoutes = monthDays.flatMap((day) => day.routes);
  const monthDeliveries = monthDays.flatMap((day) => day.deliveries);
  const monthCompleted = monthDeliveries.filter((delivery) => delivery.completed);
  const monthSettlement = monthDays.reduce(
    (sum, day) => sum + (day.settlement?.amount || 0),
    0,
  );
  const monthAdjustments = monthDays.reduce(
    (sum, day) =>
      sum +
      (day.settlement?.settlement_adjustments || []).reduce(
        (current, adjustment) => current + adjustment.amount,
        0,
      ),
    0,
  );

  const paymentRule = describePaymentRule(motoboy.payment_rule);

  const moveMonth = (delta: number) =>
    setMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + delta,
          1,
        ),
    );

  return (
    <div className="dfl-page">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace('/motoboys')}
          className="dfl-icon-button"
          aria-label="Voltar para motoboys"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-sky-400">
            Ficha do entregador
          </p>
          <h1 className="truncate font-heading text-xl font-black text-zinc-100">
            {motoboy.name}
          </h1>
        </div>

        <button
          onClick={() => router.push(`/motoboys/editar?id=${motoboy.id}`)}
          className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-zinc-950 active:scale-95"
        >
          <Edit3 size={15} />
          Editar
        </button>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center gap-3 p-4">
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl ${
              motoboy.active
                ? 'bg-sky-500/10 text-sky-400'
                : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            <UserRound size={23} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-zinc-100">
              {motoboy.active ? 'Ativo' : 'Inativo'}
            </p>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
              {motoboy.type || 'fixo'}
            </p>
          </div>

          {ledger.lastSettlement && (
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-wide text-zinc-700">
                Último acerto
              </p>
              <p className="mt-1 text-xs font-black text-emerald-400">
                {money(ledger.lastSettlement.amount)}
              </p>
              <p className="mt-0.5 text-[9px] text-zinc-600">
                {new Date(ledger.lastSettlement.occurred_at).toLocaleDateString(
                  'pt-BR',
                )}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-zinc-800 border-t border-zinc-800">
          <Stat value={String(ledger.linkedRoutes.length)} label="Rotas" />
          <Stat
            value={String(ledger.completedDeliveries.length)}
            label="Entregas"
          />
          <Stat
            value={String(ledger.days.length)}
            label="Dias rodados"
          />
        </div>
      </section>

      <button
        onClick={() => router.push(`/motoboys/acerto?id=${motoboy.id}`)}
        className="flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-emerald-500 text-sm font-black text-zinc-950 shadow-lg shadow-emerald-500/10 active:scale-[.98]"
      >
        <Calculator size={18} />
        Abrir acerto de caixa
      </button>

      <section className="rounded-[22px] border border-sky-500/15 bg-sky-500/[.035] p-4">
        <p className="text-[9px] font-black uppercase tracking-[.15em] text-sky-400">
          Regra de pagamento
        </p>
        <p className="mt-2 text-sm font-black leading-relaxed text-zinc-200">
          {paymentRule}
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          A ficha mostra somente a regra cadastrada. O valor do acerto é calculado
          por dia no fluxo de caixa, nunca usando o histórico acumulado.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.17em] text-zinc-600">
              Histórico financeiro
            </p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">
              Trabalho por dia
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => moveMonth(-1)}
              className="dfl-icon-button h-9 w-9"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="min-w-[105px] text-center">
              <CalendarDays size={13} className="mx-auto text-sky-400" />
              <p className="mt-0.5 text-[10px] font-black capitalize text-zinc-300">
                {month.toLocaleDateString('pt-BR', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>

            <button
              onClick={() => moveMonth(1)}
              className="dfl-icon-button h-9 w-9"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-2">
          <MonthMetric
            icon={Bike}
            label="Dias / rotas"
            value={`${monthDays.length} / ${monthRoutes.length}`}
          />
          <MonthMetric
            icon={PackageOpen}
            label="Entregas"
            value={String(monthCompleted.length)}
          />
          <MonthMetric
            icon={CircleDollarSign}
            label="Recebido"
            value={money(monthSettlement)}
            tone="green"
          />
          <MonthMetric
            icon={ReceiptText}
            label="Ajustes"
            value={money(monthAdjustments)}
            tone="amber"
          />
        </section>

        {monthDays.length > 0 ? (
          <div className="space-y-2">
            {monthDays.map((day) => {
              const open = expandedDays[day.key] === true;
              const completed = day.deliveries.filter(
                (delivery) => delivery.completed,
              ).length;

              return (
                <article
                  key={day.key}
                  className="overflow-hidden rounded-[22px] border border-zinc-800/80 bg-zinc-900/35"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDays((current) => ({
                        ...current,
                        [day.key]: !open,
                      }))
                    }
                    className="flex w-full items-center gap-3 p-3.5 text-left active:bg-zinc-900/60"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-400">
                      <CalendarDays size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black capitalize text-zinc-200">
                        {new Date(`${day.key}T12:00:00-03:00`).toLocaleDateString(
                          'pt-BR',
                          {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'short',
                          },
                        )}
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-zinc-600">
                        {day.routes.length} rota{day.routes.length === 1 ? '' : 's'} ·{' '}
                        {completed} entrega{completed === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {day.settlement ? (
                        <>
                          <p className="text-[9px] font-black uppercase text-emerald-500">
                            Acerto
                          </p>
                          <p className="mt-0.5 text-xs font-black text-emerald-400">
                            {money(day.settlement.amount)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[9px] font-black text-zinc-700">
                          Sem acerto
                        </p>
                      )}
                    </div>

                    <ChevronDown
                      size={15}
                      className={`text-zinc-700 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-zinc-800/70 p-2.5">
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-zinc-950/35 p-2.5">
                          <p className="text-[8px] font-black uppercase text-zinc-700">
                            Recebido pelo entregador
                          </p>
                          <p className="mt-1 text-[11px] font-black text-emerald-300">
                            {money(day.settlement?.amount || 0)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/motoboys/acerto?id=${motoboy.id}`)
                          }
                          className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.04] p-2.5 text-left"
                        >
                          <p className="text-[8px] font-black uppercase text-emerald-500">
                            Acerto do dia
                          </p>
                          <p className="mt-1 text-[10px] font-black text-emerald-300">
                            Abrir caixa
                          </p>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {day.routes
                          .sort(
                            (a, b) =>
                              new Date(routeOperationalDate(a) || 0).getTime() -
                              new Date(routeOperationalDate(b) || 0).getTime(),
                          )
                          .map((route) => {
                            const routeDeliveries = day.deliveries.filter(
                              (delivery) => delivery.route_id === route.id,
                            );
                            const done = routeDeliveries.filter(
                              (delivery) => delivery.completed,
                            ).length;

                            return (
                              <button
                                key={route.id}
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/rotas/details?id=${route.id}&date=${encodeURIComponent(
                                      day.key,
                                    )}`,
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-[16px] border border-zinc-800/70 bg-zinc-950/30 px-3 py-2.5 text-left active:bg-zinc-900"
                              >
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-900 text-sky-400">
                                  <RouteIcon size={14} />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-black text-zinc-300">
                                    {route.name}
                                  </p>
                                  <p className="mt-0.5 text-[9px] text-zinc-700">
                                    {routeOperationalDate(route)
                                      ? new Date(
                                          routeOperationalDate(route)!,
                                        ).toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          timeZone: 'America/Sao_Paulo',
                                        })
                                      : 'Sem horário'}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p className="text-[10px] font-black text-zinc-300">
                                    {done}/{routeDeliveries.length}
                                  </p>
                                  <p
                                    className={`mt-0.5 text-[8px] font-black ${
                                      route.status === 'fechada'
                                        ? 'text-emerald-500'
                                        : 'text-amber-500'
                                    }`}
                                  >
                                    {route.status === 'fechada'
                                      ? 'Finalizada'
                                      : 'Aberta'}
                                  </p>
                                </div>

                                <ChevronRight size={14} className="text-zinc-700" />
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dfl-empty">
            <Bike size={30} className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-black text-zinc-300">
              Nenhuma operação neste mês
            </p>
            <p className="mx-auto mt-1 max-w-[250px] text-[11px] text-zinc-600">
              Navegue pelos meses para consultar dias trabalhados, rotas e acertos.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-zinc-800/70 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-zinc-600">Movimentações financeiras</p>
            <p className="mt-1 text-[11px] text-zinc-500">Acertos e demais lançamentos ligados ao entregador</p>
          </div>
          <button type="button" onClick={() => router.push(`/despesas?motoboy=${encodeURIComponent(motoboy.id)}`)} className="rounded-xl border border-sky-500/20 bg-sky-500/[.05] px-3 py-2 text-[9px] font-black text-sky-300">Ver movimentações</button>
        </div>
      </section>

      <MotoboyOperationalMemory motoboyId={motoboy.id} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className="text-sm font-black text-zinc-200">{value}</p>
      <p className="mt-0.5 text-[9px] text-zinc-600">{label}</p>
    </div>
  );
}

function MonthMetric({
  icon: Icon,
  label,
  value,
  tone = 'sky',
}: {
  icon: typeof Bike;
  label: string;
  value: string;
  tone?: 'sky' | 'green' | 'amber';
}) {
  const color =
    tone === 'green'
      ? 'text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-400'
        : 'text-sky-400';

  return (
    <div className="rounded-[18px] border border-zinc-800/70 bg-zinc-900/35 p-3">
      <Icon size={14} className={color} />
      <p className="mt-2 truncate text-sm font-black text-zinc-200">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold text-zinc-600">{label}</p>
    </div>
  );
}

export default function MotoboyDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-zinc-600">Carregando...</div>
      }
    >
      <Content />
    </Suspense>
  );
}
