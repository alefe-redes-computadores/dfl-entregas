// components/reports/Charts/DayOfWeekChart.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { CalendarDays } from 'lucide-react';

interface DayOfWeekChartProps {
  data: Array<{
    day: string;
    deliveries: number;
    revenue: number;
  }>;
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-zinc-200">Dias da Semana</h3>
        </div>
        <div className="h-[300px] flex items-center justify-center text-zinc-500">
          Sem dados para exibir
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm font-medium text-zinc-200 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Entregas' ? entry.value : `R$ ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-pink-500" />
        <h3 className="text-lg font-semibold text-zinc-200">Dias da Semana</h3>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis 
            dataKey="day" 
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
          />
          <YAxis 
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="deliveries"
            name="Entregas"
            fill="#ec4899"
            radius={[4, 4, 0, 0]}
            animationDuration={1500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}