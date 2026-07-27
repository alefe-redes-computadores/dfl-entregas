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
import { Timer, Maximize2, Minimize2 } from 'lucide-react';

interface LogisticsTimeChartProps {
  data: Array<{
    name: string;
    avgTimePerDelivery: number;
    totalDeliveries: number;
  }>;
}

export function LogisticsTimeChart({ data }: LogisticsTimeChartProps) {
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
          <p className="text-sm text-sky-400 font-semibold">{`${payload[0].value.toFixed(1)} min por entrega`}</p>
          <p className="text-xs text-zinc-400 mt-1">{`Baseado em ${payload[0].payload.totalDeliveries} entregas`}</p>
        </div>
      );
    }
    return null;
  };

  const ChartContent = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-sky-500" />
          <h3 className="text-lg font-bold text-zinc-200">Velocidade (Min/Entrega)</h3>
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors text-zinc-400">
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      
      <ResponsiveContainer width="100%" height={isExpanded ? '80%' : 260}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis type="number" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 12 }} hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#71717a" 
            tick={{ fill: '#e4e4e7', fontSize: 12, fontWeight: 500 }} 
            tickLine={false}
            axisLine={false}
            width={85} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: '#27272a', opacity: 0.4}} />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', color: '#a1a1aa' }} />
          <Bar dataKey="avgTimePerDelivery" name="Minutos por Entrega" fill="#38bdf8" radius={[0, 4, 4, 0]} animationDuration={1500} barSize={isExpanded ? 30 : 20} />
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
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-[24px] p-6 shadow-sm">
      {ChartContent}
    </div>
  );
}
