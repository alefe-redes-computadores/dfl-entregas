// components/reports/Charts/NeighborhoodChart.tsx
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
import { MapPin } from 'lucide-react';

interface NeighborhoodChartProps {
  data: Array<{
    name: string;
    count: number;
  }>;
}

export function NeighborhoodChart({ data }: NeighborhoodChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-semibold text-zinc-200">Bairros com Mais Entregas</h3>
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
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-sm text-purple-500">{`${payload[0].value} entregas`}</p>
        </div>
      );
    }
    return null;
  };

  const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold text-zinc-200">Bairros com Mais Entregas</h3>
        <span className="ml-auto text-xs text-zinc-500">Top 10</span>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={sortedData} 
          layout="vertical"
          margin={{ top: 10, right: 10, left: 50, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis 
            type="number"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
          />
          <YAxis 
            type="category"
            dataKey="name"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={{ stroke: '#27272a' }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            fill="#8b5cf6"
            radius={[0, 4, 4, 0]}
            animationDuration={1500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}