'use client';

import type { ReactNode } from 'react';
import {
  Bar,
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
}: ReportChartCardProps) {
  const formatter = valueFormatter ?? ((value: number) => String(value));
  const chartData = data.map((item) => ({
    ...item,
    chartValue: item[dataKey] ?? 0,
  }));

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
        <div className="h-[210px] min-w-0 w-full overflow-hidden px-1 pb-1 sm:h-[250px] sm:px-2">
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
                  minTickGap={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#52525b', fontSize: 10 }}
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
                <Bar dataKey="chartValue" fill="#38bdf8" radius={[5, 5, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
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
