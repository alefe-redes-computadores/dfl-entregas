'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock3,
  CreditCard,
  MapPin,
  PackageOpen,
  Route as RouteIcon,
  Store,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { ReportChartCard } from '@/components/reports/ReportChartCard';
import { DataQualityCard } from '@/components/reports/DataQualityCard';
import { ReportDrilldownSheet } from '@/components/reports/ReportDrilldownSheet';
import { buildReportModel } from '@/lib/reports/buildReportModel';
import type {
  DrilldownSelection,
  ReportPeriodKey,
} from '@/lib/reports/types';

type TabType = 'geral' | 'financeiro' | 'operacao' | 'qualidade';

const PERIODS: Array<{ value: ReportPeriodKey; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '14d', label: 'Últimos 14 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'all', label: 'Todo período' },
];

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function variationSubtitle(value: number | null, label: string): string | undefined {
  if (value == null) return undefined;
  if (value === 0) return `Sem variação ${label}`;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% ${label}`;
}

export default function RelatoriosPage() {
  const router = useRouter();
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const customers = useAppStore((state) => state.customers);
  const fuelings = useAppStore((state) => state.fuelings);

  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>('7d');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [drilldown, setDrilldown] = useState<DrilldownSelection | null>(null);

  const model = useMemo(
    () =>
      buildReportModel({
        deliveries,
        routes,
        customers,
        fuelings,
        periodKey,
      }),
    [customers, deliveries, fuelings, periodKey, routes],
  );

  const currentPeriodLabel =
    PERIODS.find((period) => period.value === periodKey)?.label ?? 'Período';

  const topHour = [...model.hours].sort((a, b) => b.count - a.count)[0];
  const topNeighborhood = model.neighborhoods[0];
  const topMotoboy = model.motoboys[0];

  return (
    <div className="relative flex flex-col gap-5 pb-28">
      <header className="sticky top-0 z-30 -mx-2 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-50">
              Relatórios
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              dados reais · cobertura explícita
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPeriodOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 active:scale-95"
        >
          <CalendarDays size={14} />
          {currentPeriodLabel}
          <ChevronDown size={14} />
        </button>
      </header>

      <section className="mx-2 rounded-[24px] border border-zinc-800/80 bg-zinc-900/50 p-1.5">
        <div className="grid grid-cols-4 gap-1">
          <TabButton
            active={activeTab === 'geral'}
            onClick={() => setActiveTab('geral')}
            icon={<Activity size={13} />}
            label="Geral"
          />
          <TabButton
            active={activeTab === 'financeiro'}
            onClick={() => setActiveTab('financeiro')}
            icon={<Wallet size={13} />}
            label="Receita"
          />
          <TabButton
            active={activeTab === 'operacao'}
            onClick={() => setActiveTab('operacao')}
            icon={<RouteIcon size={13} />}
            label="Operação"
          />
          <TabButton
            active={activeTab === 'qualidade'}
            onClick={() => setActiveTab('qualidade')}
            icon={<BarChart3 size={13} />}
            label="Dados"
          />
        </div>
      </section>

      <main className="flex flex-col gap-4 px-2">
        <section className="grid grid-cols-2 gap-3">
          <SummaryCard
            title="Entregas"
            value={model.metrics.totalDeliveries}
            subtitle={variationSubtitle(
              model.metrics.deliveryVariation,
              'vs período anterior equivalente',
            )}
            icon={<PackageOpen size={20} />}
            accentColor="emerald"
          />
          <SummaryCard
            title="Faturamento"
            value={money(model.metrics.totalRevenue)}
            subtitle={variationSubtitle(
              model.metrics.revenueVariation,
              'vs período anterior equivalente',
            )}
            icon={<Wallet size={20} />}
            accentColor="amber"
          />
        </section>

        {model.metrics.ignoredDateCount > 0 && periodKey === 'all' && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
            {model.metrics.ignoredDateCount}{' '}
            {model.metrics.ignoredDateCount === 1 ? 'entrega não possui' : 'entregas não possuem'}{' '}
            timestamp de criação confiável. Elas continuam no volume e financeiro de
            “Todo período”, mas não entram em gráficos temporais.
          </div>
        )}

        {activeTab === 'geral' && (
          <>
            <ReportChartCard
              title="Evolução diária de entregas"
              description="Cada ponto representa uma data completa. Meses e anos nunca são misturados pelo número do dia."
              icon={<PackageOpen size={18} />}
              data={model.dailyVolume}
              chartType="line"
              dataKey="count"
              valueLabel="Entregas"
              onExplore={() =>
                setDrilldown({
                  kind: 'daily',
                  title: 'Histórico por dia',
                  subtitle:
                    'Selecione uma data para ver exatamente quais entregas formaram o ponto do gráfico.',
                })
              }
            />

            <ReportChartCard
              title="Horários de entrada dos pedidos"
              description="Volume real por hora de criação. Nenhuma faixa do dia é descartada silenciosamente."
              icon={<Clock3 size={18} />}
              data={model.hours}
              dataKey="count"
              valueLabel="Pedidos"
              onExplore={() =>
                setDrilldown({
                  kind: 'hour',
                  title: 'Histórico por horário',
                  subtitle:
                    'Os horários usam o timestamp de criação da entrega em America/Sao_Paulo.',
                })
              }
              footer={
                topHour
                  ? `Maior volume no período: ${topHour.label} · ${topHour.count} pedidos`
                  : undefined
              }
            />

            <ReportChartCard
              title="Dias da semana normalizados"
              description="Média de entregas por ocorrência de cada dia da semana no período; não privilegia um dia só porque apareceu mais vezes."
              icon={<CalendarDays size={18} />}
              data={model.weekdays}
              dataKey="average"
              valueLabel="Média por ocorrência"
              valueFormatter={(value) => value.toFixed(2)}
              onExplore={() =>
                setDrilldown({
                  kind: 'weekday',
                  title: 'Histórico por dia da semana',
                  subtitle:
                    'A análise mostra total, média e a amostra de ocorrências de cada dia.',
                })
              }
            />
          </>
        )}

        {activeTab === 'financeiro' && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <SummaryCard
                title="Ticket médio"
                value={money(model.metrics.averageTicket)}
                icon={<Banknote size={20} />}
                accentColor="blue"
              />
              <SummaryCard
                title="Pedidos com data"
                value={model.metrics.validDateCount}
                subtitle={`${model.metrics.ignoredDateCount} sem timestamp confiável`}
                icon={<CalendarDays size={20} />}
                accentColor="purple"
              />
            </section>

            <ReportChartCard
              title="Faturamento diário"
              description="Receita separada do volume para evitar dois eixos e interpretações confusas."
              icon={<Banknote size={18} />}
              data={model.dailyRevenue}
              chartType="line"
              dataKey="revenue"
              valueLabel="Faturamento"
              valueFormatter={money}
              onExplore={() =>
                setDrilldown({
                  kind: 'daily',
                  title: 'Faturamento por dia',
                  subtitle:
                    'Abra uma data para conferir os pedidos que compõem o valor.',
                })
              }
            />

            <ReportChartCard
              title="Formas de pagamento"
              description="Mostra volume real por método; o histórico permite conferir cada pedido."
              icon={<CreditCard size={18} />}
              data={model.payments}
              dataKey="count"
              valueLabel="Pedidos"
              onExplore={() =>
                setDrilldown({
                  kind: 'payment',
                  title: 'Pedidos por forma de pagamento',
                })
              }
            />

            <ReportChartCard
              title="Origem dos pedidos"
              description="Registros antigos sem origem permanecem como “Origem não registrada”; nunca viram iFood por suposição."
              icon={<Store size={18} />}
              data={model.origins}
              dataKey="count"
              valueLabel="Pedidos"
              onExplore={() =>
                setDrilldown({
                  kind: 'origin',
                  title: 'Pedidos por origem',
                })
              }
            />

            <section className="mt-2 border-t border-zinc-800/70 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-500">
                    Custos operacionais
                  </p>
                  <h2 className="mt-1 font-heading text-base font-black text-zinc-100">
                    Combustível
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/abastecimentos')}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black text-amber-400"
                >
                  Abrir histórico
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  title="Gasto combustível"
                  value={money(model.fuel.metrics.totalAmount)}
                  subtitle={variationSubtitle(
                    model.fuel.metrics.spendVariation,
                    'vs período anterior equivalente',
                  )}
                  icon={<Banknote size={20} />}
                  accentColor="amber"
                />
                <SummaryCard
                  title="Média por abastecimento"
                  value={money(model.fuel.metrics.averageFueling)}
                  subtitle={`${model.fuel.metrics.count} registro${model.fuel.metrics.count === 1 ? '' : 's'}`}
                  icon={<Store size={20} />}
                  accentColor="blue"
                />
                <SummaryCard
                  title="Litros registrados"
                  value={`${model.fuel.metrics.liters.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`}
                  subtitle={`${model.fuel.metrics.litersCoverageCount}/${model.fuel.metrics.count} com litros`}
                  icon={<Activity size={20} />}
                  accentColor="purple"
                />
                <SummaryCard
                  title="Preço médio / L"
                  value={
                    model.fuel.metrics.averagePricePerLiter
                      ? money(model.fuel.metrics.averagePricePerLiter)
                      : 'Sem amostra'
                  }
                  subtitle="Média ponderada pelos litros"
                  icon={<Wallet size={20} />}
                  accentColor="emerald"
                />
              </div>
            </section>

            <ReportChartCard
              title="Gasto diário com combustível"
              description="Valores efetivamente registrados no período. Não é estimativa e não representa sozinho o lucro da operação."
              icon={<Banknote size={18} />}
              data={model.fuel.dailySpend}
              chartType="line"
              dataKey="revenue"
              valueLabel="Combustível"
              valueFormatter={money}
              onExplore={() => router.push('/abastecimentos')}
              footer="Abrir histórico de abastecimentos"
            />

            <ReportChartCard
              title="Custo por tipo de combustível"
              description="Distribui o gasto real pelos combustíveis informados, sem completar dados ausentes."
              icon={<BarChart3 size={18} />}
              data={model.fuel.byFuelType}
              dataKey="revenue"
              valueLabel="Gasto"
              valueFormatter={money}
              onExplore={() => router.push('/abastecimentos')}
              footer="Conferir os registros que formam estes valores"
            />

            <ReportChartCard
              title="Custo por veículo informado"
              description="Separa o gasto por moto ou veículo. Registros sem identificação continuam visíveis como não informados."
              icon={<RouteIcon size={18} />}
              data={model.fuel.byVehicle.slice(0, 12)}
              dataKey="revenue"
              valueLabel="Gasto"
              valueFormatter={money}
              onExplore={() => router.push('/abastecimentos')}
              footer="Abrir histórico e revisar vínculos de veículo"
            />

            <section className="rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-400">
                    Cobertura do combustível
                  </p>
                  <h2 className="mt-1 font-black text-zinc-100">
                    Dados prontos para inteligência
                  </h2>
                </div>
                <Activity size={20} className="text-violet-400" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['Litros', model.fuel.metrics.litersCoverageCount],
                  ['Odômetro', model.fuel.metrics.odometerCoverageCount],
                  ['Veículo', model.fuel.metrics.vehicleCoverageCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-zinc-950/55 p-3">
                    <p className="text-[9px] font-bold text-zinc-600">{label}</p>
                    <p className="mt-1 text-base font-black text-zinc-100">
                      {Number(value)}/{model.fuel.metrics.count}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
                O app ainda não calcula km/L. Quilometragem isolada não basta para consumo confiável; precisamos saber quando o tanque foi realmente completado para comparar dois abastecimentos equivalentes.
              </p>
            </section>
          </>
        )}

        {activeTab === 'operacao' && (
          <>
            <ReportChartCard
              title="Bairros com cobertura cadastrada"
              description="Usa o bairro estruturado do cliente. Endereço com hífen não é usado para inventar bairro."
              icon={<MapPin size={18} />}
              data={model.neighborhoods.slice(0, 12)}
              dataKey="count"
              valueLabel="Entregas"
              onExplore={() =>
                setDrilldown({
                  kind: 'neighborhood',
                  title: 'Histórico por bairro',
                })
              }
              footer={
                topNeighborhood
                  ? `Maior volume cadastrado: ${topNeighborhood.label} · ${topNeighborhood.count}`
                  : 'Sem bairros estruturados suficientes para esta análise'
              }
            />

            <ReportChartCard
              title="Volume por motoboy"
              description="É volume operacional, não ranking de desempenho. Faturamento não é usado para dizer quem é mais eficiente."
              icon={<UserRound size={18} />}
              data={model.motoboys}
              dataKey="count"
              valueLabel="Entregas"
              onExplore={() =>
                setDrilldown({
                  kind: 'motoboy',
                  title: 'Histórico por motoboy',
                  subtitle:
                    'Quantidade de entregas vinculadas às rotas de cada motoboy no período.',
                })
              }
              footer={
                topMotoboy
                  ? `Maior volume: ${topMotoboy.label} · ${topMotoboy.count} entregas`
                  : undefined
              }
            />

            <section className="overflow-hidden rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <RouteIcon size={18} className="text-sky-400" />
                    <h2 className="font-black text-zinc-100">Duração das rotas confiáveis</h2>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Mostra duração da rota inteira. Não divide o tempo total pelo número de entregas e não chama isso de velocidade individual.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDrilldown({
                      kind: 'route',
                      title: 'Duração das rotas',
                      subtitle:
                        'Rotas suspeitas ficam fora apenas desta métrica e aparecem em Qualidade dos dados.',
                    })
                  }
                  className="rounded-full bg-zinc-950 p-2 text-zinc-400 active:scale-95"
                >
                  <RouteIcon size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {model.routeTimings.slice(0, 5).map((route) => (
                  <button
                    key={route.routeId}
                    type="button"
                    onClick={() =>
                      setDrilldown({
                        kind: 'route',
                        key: route.routeId,
                        title: 'Duração das rotas',
                      })
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/45 px-3 py-3 text-left"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{route.routeName}</div>
                      <div className="mt-0.5 text-[10px] text-zinc-600">
                        {route.motoboyName} · {route.deliveryCount} entregas
                      </div>
                    </div>
                    <div className="text-sm font-black text-sky-300">
                      {route.durationMinutes.toFixed(1)} min
                    </div>
                  </button>
                ))}
                {model.routeTimings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-3 py-8 text-center text-xs text-zinc-600">
                    Nenhuma rota fechada com duração confiável neste período.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'qualidade' && (
          <>
            <DataQualityCard
              issues={model.quality}
              totalDeliveries={model.metrics.totalDeliveries}
              onExplore={() =>
                setDrilldown({
                  kind: 'quality',
                  title: 'Qualidade dos dados',
                  subtitle:
                    'Cada problema informa exatamente qual análise deixa de usar aquele registro.',
                })
              }
            />

            <section className="rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 p-5">
              <h2 className="font-black text-zinc-100">Critérios desta reconstrução</h2>
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-500">
                <p>• `updated_at` nunca é usado como data de criação da entrega.</p>
                <p>• Datas ausentes não recebem `new Date()`.</p>
                <p>• Timezone é interpretado por `America/Sao_Paulo`, sem subtrair três horas manualmente.</p>
                <p>• Últimos 7 dias representam exatamente 7 datas de calendário, incluindo hoje.</p>
                <p>• Nenhum grupo é removido por ultrapassar 32 entregas.</p>
                <p>• Rotas curtas ou temporalmente impossíveis continuam no volume e financeiro, mas ficam fora de duração.</p>
                <p>• Origem ausente permanece desconhecida.</p>
                <p>• Horários entre 06h e 16h continuam existindo se houver registros reais.</p>
              </div>
            </section>
          </>
        )}
      </main>

      {periodOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/80 backdrop-blur-sm">
          <section className="rounded-t-[34px] border-t border-zinc-800 bg-zinc-950 p-6 pb-10">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-800" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-zinc-100">Selecionar período</h2>
              <button
                type="button"
                onClick={() => setPeriodOpen(false)}
                className="rounded-full bg-zinc-900 p-2 text-zinc-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {PERIODS.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => {
                    setPeriodKey(period.value);
                    setPeriodOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-sm font-bold ${
                    periodKey === period.value
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
                  }`}
                >
                  {period.label}
                  {periodKey === period.value && <Activity size={16} />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <ReportDrilldownSheet
        selection={drilldown}
        model={model}
        onClose={() => setDrilldown(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-2 text-[10px] font-bold transition ${
        active
          ? 'bg-zinc-800 text-emerald-300 shadow-sm'
          : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
