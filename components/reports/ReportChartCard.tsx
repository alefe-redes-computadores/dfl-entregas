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
  footer,
}: ReportChartCardProps) {
  const formatter = valueFormatter ?? ((value: number) => String(value));
  const chartData = data.map((item) => ({
    ...item,
    chartValue: item[dataKey] ?? 0,
  }));

  return (
    <section className="overflow-hidden rounded-[26px] border border-zinc-800/80 bg-zinc-900/55 shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-zinc-100">
            <span className="text-emerald-400">{icon}</span>
            <h2 className="text-base font-black tracking-tight">{title}</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
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
        <div className="px-5 py-12 text-center text-sm text-zinc-600">
          Nenhum dado confiável para esta análise.
        </div>
      ) : (
        <div className="h-[250px] w-full px-2 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 16, right: 14, left: -20, bottom: 0 }}>
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
              <BarChart data={chartData} margin={{ top: 16, right: 14, left: -20, bottom: 0 }}>
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
        <span>{footer ?? 'Abrir histórico e registros que formam esta análise'}</span>
        <ChevronRight size={15} />
      </button>
    </section>
  );
}
