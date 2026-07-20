// components/reports/Charts/DailyEvolutionChart.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Calendar } from 'lucide-react';

interface DailyEvolutionChartProps {
  data: Array<{
    day: number;
    date: string;
    deliveries: number;
    revenue: number;
  }>;
}

export function DailyEvolutionChart({ data }: DailyEvolutionChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-zinc-200">Evolução Diária</h3>
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
          <p className="text-sm font-medium text-zinc-200 mb-2">{`Dia ${label}`}</p>
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
        <Calendar className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-zinc-200">Evolução Diária</h3>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="deliveriesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
          </defs>
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
            yAxisId="left"
            orientation="left"
          />
          <YAxis 
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
            yAxisId="right"
            orientation="right"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: '#a1a1aa', fontSize: 12, paddingTop: 10 }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="deliveries"
            name="Entregas"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#deliveriesGradient)"
            animationDuration={1500}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            name="Faturamento"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}