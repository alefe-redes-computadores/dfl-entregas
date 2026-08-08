'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Users, Maximize2, Minimize2 } from 'lucide-react';

interface MotoboyChartProps {
  data: Array<{
    name: string;
    deliveries: number;
    revenue: number;
  }>;
}

export function MotoboyChart({ data }: MotoboyChartProps) {
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm font-medium text-zinc-200 mb-2 border-b border-zinc-700/50 pb-1">{label}</p>
          <p className="text-sm text-blue-400 font-semibold">{`${payload[0].value} Entregas`}</p>
          <p className="text-sm text-emerald-400 font-semibold">{`R$ ${payload[1].value.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  const sortedData = [...data].sort((a, b) => b.deliveries - a.deliveries);

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-zinc-200">Motoboys</h3>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      
      {/* Margem bottom aumentada para 45 para dar espaço ao texto inclinado */}
      <ResponsiveContainer width="100%" height={isExpanded ? '80%' : 300}>
        <BarChart data={sortedData} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          
          <XAxis 
            dataKey="name" 
            stroke="#71717a"
            tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: 500 }}
            angle={-35}
            textAnchor="end"
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis yAxisId="left" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={false} tickLine={false} />
          
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#a1a1aa' }} />
          
          <Bar yAxisId="left" dataKey="deliveries" name="Entregas" fill="#3b82f6" radius={[4, 4, 0, 0]} animationDuration={1500} />
          <Bar yAxisId="right" dataKey="revenue" name="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} animationDuration={1500} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-md p-6 animate-in fade-in duration-200">
        <div className="w-full h-full max-w-2xl mx-auto flex flex-col pt-10">
          {ChartContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[24px] p-6 shadow-sm overflow-hidden">
      {ChartContent}
    </div>
  );
}
