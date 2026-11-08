'use client';

import type { ReactNode } from 'react';
import {
  Bar,
  Cell,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronRight, Maximize2 } from 'lucide-react';
import type { ReportBucket } from '@/lib/reports/types';

interface ReportChartCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  data: ReportBucket[];
  dataKey?: 'count' | 'revenue' | 'average';
  chartType?: 'bar' | 'line';
  valueLabel: string;
  valueFormatter?: (value: number) => string;
  onExplore: () => void;
  onSelectBucket?: (bucket: ReportBucket) => void;
  footer?: string;
  /** Identidade das plataformas; somente o gráfico de origem usa essa paleta. */
  channelColors?: boolean;
}

export function ReportChartCard({
  title,
  description,
  icon,
  data,
  dataKey = 'count',
  chartType = 'bar',
  valueLabel,
  valueFormatter,
  onExplore,
  onSelectBucket,
  footer,
  channelColors = false,
}: ReportChartCardProps) {
  const formatter = valueFormatter ?? ((value: number) => String(value));
  const chartData = data.map((item) => ({
    ...item,
    chartValue: item[dataKey] ?? 0,
  }));

  const originColors: Record<string,string> = { 'iFood':'#ef4444', '99Food':'#facc15', Keeta:'#8b5cf6', Loja:'#10b981' };
  const mobileCategoryBars = chartType === 'bar' && (chartData.length >= 6 || chartData.some(item => item.label.length > 15));
  const visibleBars = mobileCategoryBars ? chartData.slice(0, 8) : chartData;

  const handleChartClick = (state: unknown) => {
    if (!onSelectBucket || !state || typeof state !== 'object') return;

    const activePayload = (
      state as { activePayload?: Array<{ payload?: ReportBucket }> }
    ).activePayload;
    const bucket = activePayload?.[0]?.payload;

    if (bucket?.key) onSelectBucket(bucket);
  };

  return (
    <section className="overflow-hidden rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3 px-3.5 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-100">
            <span className="text-emerald-400">{icon}</span>
            <h2 className="min-w-0 break-words text-sm font-black leading-snug tracking-tight sm:text-base">{title}</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
          {onSelectBucket && chartData.length > 0 && (
            <p className="mt-2 text-[10px] font-bold text-emerald-400/80">
              Toque em uma barra ou ponto para abrir os registros daquele recorte.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onExplore}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 transition active:scale-95"
          aria-label={`Explorar ${title}`}
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {chartData.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-zinc-500 sm:px-5">
          Nenhum dado confiável para esta análise.
        </div>
      ) : (
        <div className="h-[210px] min-w-0 w-full overflow-hidden px-1 pb-1 sm:h-[250px] sm:px-2" style={mobileCategoryBars ? { height: Math.max(245, visibleBars.length * 44 + 46) } : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart
                data={chartData}
                margin={{ top: 16, right: 14, left: -20, bottom: 0 }}
                onClick={handleChartClick}
                style={{ cursor: onSelectBucket ? 'pointer' : 'default' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  minTickGap={16}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#52525b', fontSize: 10 }}
                  allowDecimals={dataKey === 'average'}
                />
                <Tooltip
                  cursor={{ stroke: '#3f3f46' }}
                  contentStyle={{
                    background: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: 14,
                  }}
                  labelStyle={{ color: '#e4e4e7', fontWeight: 700 }}
                  formatter={(value) => [formatter(Number(value ?? 0)), valueLabel]}
                />
                <Line
                  type="monotone"
                  dataKey="chartValue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            ) : (
              <BarChart
                data={visibleBars}
                layout={mobileCategoryBars ? 'vertical' : 'horizontal'}
                margin={mobileCategoryBars ? { top: 10, right: 19, left: 10, bottom: 4 } : { top: 16, right: 14, left: -20, bottom: 0 }}
                onClick={handleChartClick}
                style={{ cursor: onSelectBucket ? 'pointer' : 'default' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey={mobileCategoryBars ? undefined : 'label'}
                  type={mobileCategoryBars ? 'number' : 'category'}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  minTickGap={8}
                />
                <YAxis
                  dataKey={mobileCategoryBars ? 'label' : undefined}
                  type={mobileCategoryBars ? 'category' : 'number'}
                  width={mobileCategoryBars ? 112 : undefined}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  tickFormatter={mobileCategoryBars ? (value: string) => value.length > 18 ? `${value.slice(0, 16)}…` : value : undefined}
                  allowDecimals={dataKey === 'average'}
                />
                <Tooltip
                  cursor={{ fill: '#27272a', opacity: 0.35 }}
                  contentStyle={{
                    background: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: 14,
                  }}
                  labelStyle={{ color: '#e4e4e7', fontWeight: 700 }}
                  formatter={(value) => [formatter(Number(value ?? 0)), valueLabel]}
                />
                <Bar dataKey="chartValue" fill="#38bdf8" radius={[5, 5, 0, 0]}>
                  {channelColors && visibleBars.map(bucket => <Cell key={bucket.key} fill={originColors[bucket.label] || '#71717a'} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'bar' && chartData.length > 0 && (
        <div className="grid min-w-0 gap-1.5 px-3 pb-3 sm:px-5" role="list" aria-label={`Valores legíveis: ${title}`}>
          {visibleBars.map((bucket) => (
            <div key={bucket.key} role="listitem" className="min-w-0">
              <button type="button" disabled={!onSelectBucket} onClick={() => onSelectBucket?.(bucket)}
                className="flex min-h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 text-left disabled:cursor-default">
                <span className="min-w-0 flex-1 break-words text-[11px] font-medium leading-snug text-zinc-300">{bucket.label}</span>
                <strong className="shrink-0 text-[11px] font-black tabular-nums text-zinc-100">{formatter(Number(bucket[dataKey] ?? 0))}</strong>
              </button>
            </div>
          ))}
          {chartData.length > visibleBars.length && <p className="text-[10px] text-zinc-500">Mais categorias disponíveis ao abrir o histórico.</p>}
        </div>
      )}

      <button
        type="button"
        onClick={onExplore}
        className="flex w-full items-center justify-between border-t border-zinc-800/70 px-5 py-3 text-left text-xs font-bold text-zinc-400 transition hover:bg-zinc-900 active:bg-zinc-800/70"
      >
        <span className="min-w-0 flex-1 break-words">{footer ?? 'Abrir histórico e registros que formam esta análise'}</span>
        <ChevronRight size={15} className="shrink-0" />
      </button>
    </section>
  );
}
